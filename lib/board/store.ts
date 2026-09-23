import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Verbatim copies of the house's own writer and roster; see vendor/SOURCE.json.
import { CLOSERS } from "./vendor/core/closure-marker.js";
import type { BoardEvent, BoardEventView, BoardThreadView, BoardView, OutboxEntry } from "./types";

/**
 * The Cockpit's side of the house board (HOUSE-0010, condition 4).
 *
 * Two files, both outside the deployed app directory on the VPS:
 *   - snapshot.json — the board as the Mac last pushed it. Replaced whole.
 *   - outbox.json   — what JJ wrote here, with the house's verdict once the
 *                     Mac bridge has run it through `operations/house-board.js`.
 *
 * Every write is checked here by the house writer itself, run against a
 * scratch copy of the thread, so roster, language, closure rights and id
 * idempotency are the same rules and the same code. The Mac runs the writer
 * again for real; its verdict is final and a refusal stays visible.
 */

export const ROSTER: readonly string[] = CLOSERS;

type HouseBoard = typeof import("./vendor/operations/house-board.js");
let houseModule: Promise<HouseBoard> | null = null;

/**
 * The writer is loaded at run time, not bundled: it resolves its own board
 * directory from `import.meta.url`, which the bundler cannot follow. The
 * Cockpit runs `next start` from the source tree, so the file is there.
 */
function loadHouse(): Promise<HouseBoard> {
    const file = path.join(process.cwd(), "lib/board/vendor/operations/house-board.js");
    return (houseModule ??= import(/* turbopackIgnore: true */ /* webpackIgnore: true */ pathToFileURL(file).href));
}

const MAX_CLOCK_SKEW_MS = 24 * 3_600_000;

interface Snapshot {
    version: 1;
    syncedAt: string;
    events: BoardEvent[];
}

function dir(): string {
    if (process.env.COCKPIT_BOARD_DIR) return process.env.COCKPIT_BOARD_DIR;
    if (process.env.COCKPIT_SNAPSHOT_DIR) return path.join(process.env.COCKPIT_SNAPSHOT_DIR, "board");
    return path.join(process.cwd(), ".runs", "board");
}
const snapshotPath = () => path.join(dir(), "snapshot.json");
const outboxPath = () => path.join(dir(), "outbox.json");

function readJson<T>(file: string, fallback: T): T {
    let raw: string;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
        throw error;
    }
    // A corrupt file is a loud failure, never an empty board.
    return JSON.parse(raw) as T;
}

function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(tmp, file);
}

const readSnapshot = () => readJson<Snapshot | null>(snapshotPath(), null);
const readOutbox = () => readJson<OutboxEntry[]>(outboxPath(), []);

// One writer at a time inside this process; the Cockpit runs as one process.
let queue: Promise<unknown> = Promise.resolve();
function serialise<T>(task: () => T | Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
}

function canonical(event: BoardEvent): string {
    const plain = event as unknown as Record<string, unknown>;
    return JSON.stringify(Object.keys(plain).sort().map((key) => [key, plain[key]]));
}

/** Events the house has not yet echoed back, in the order JJ wrote them. */
function unsyncedEvents(snapshot: Snapshot | null, outbox: OutboxEntry[]): BoardEvent[] {
    const known = new Set((snapshot?.events ?? []).map((event) => event.id));
    return outbox
        .filter((entry) => entry.status !== "rejected" && !known.has(entry.event.id))
        .map((entry) => entry.event);
}

export class BoardInputError extends Error {}

export type ComposeMode = "open" | "reply" | "close";

export interface ComposeInput {
    mode: ComposeMode;
    id: string;
    date: string;
    threadId: string;
    to?: string | string[];
    lang: string;
    body: string;
    tags?: string[];
}

/** Build JJ's event. `from` is always `jj`; nothing from the client can change it. */
export function buildEvent(input: ComposeInput, now = new Date()): BoardEvent {
    if (!["open", "reply", "close"].includes(input.mode)) throw new BoardInputError("board: unknown action");
    const date = Date.parse(input.date);
    if (!Number.isFinite(date) || Math.abs(date - now.getTime()) > MAX_CLOCK_SKEW_MS) {
        throw new BoardInputError("board: date must be an ISO timestamp within a day of now");
    }
    const event: BoardEvent = {
        id: String(input.id ?? ""),
        threadId: String(input.threadId ?? ""),
        date: new Date(date).toISOString(),
        kind: input.mode === "close" ? "close" : "message",
        from: "jj",
        lang: input.lang as BoardEvent["lang"],
        body: String(input.body ?? "").trim(),
    };
    if (event.kind === "message") {
        const to = Array.isArray(input.to) ? input.to.map(String) : String(input.to ?? "");
        event.to = Array.isArray(to) && to.length === 1 ? to[0] : to;
    }
    const tags = (input.tags ?? []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
    if (tags.length) event.tags = [...new Set(tags)];
    return event;
}

/**
 * Run the house writer against a scratch copy of the thread: exactly the
 * checks `postMessage` / `closeThread` make on the Mac.
 */
function precheck(house: HouseBoard, event: BoardEvent, threadEvents: BoardEvent[]): { written: boolean } {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ggo-board-"));
    try {
        if (threadEvents.length) {
            fs.writeFileSync(
                path.join(scratch, `${event.threadId}.jsonl`),
                threadEvents.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
            );
        }
        const { kind: _kind, ...rest } = event;
        return event.kind === "close" ? house.closeThread(rest, scratch) : house.postMessage(rest, scratch);
    } catch (error) {
        throw new BoardInputError(error instanceof Error ? error.message : String(error));
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}

export interface SubmitResult {
    queued: boolean;
    entry: OutboxEntry;
}

/** Queue one of JJ's writes. Idempotent on `id`; fails loud on anything the house would refuse. */
export function submit(input: ComposeInput, now = new Date()): Promise<SubmitResult> {
    return serialise(async () => {
        const event = buildEvent(input, now);
        const house = await loadHouse();
        const snapshot = readSnapshot();
        const outbox = readOutbox();

        const previous = outbox.find((entry) => entry.event.id === event.id);
        if (previous) {
            if (canonical(previous.event) !== canonical(event)) {
                throw new BoardInputError("board: event id already used with different content");
            }
            return { queued: false, entry: previous };
        }

        const threadEvents = [...(snapshot?.events ?? []), ...unsyncedEvents(snapshot, outbox)].filter(
            (entry) => entry.threadId === event.threadId
        );
        if (input.mode === "open" && threadEvents.length) {
            throw new BoardInputError(`board: thread ${event.threadId} already exists — reply to it instead`);
        }
        if (input.mode === "reply" && !threadEvents.length) {
            throw new BoardInputError(`board: thread ${event.threadId} does not exist`);
        }
        const { written } = precheck(house, event, threadEvents);
        if (!written) {
            // Already on the board with this exact content: nothing to queue.
            return {
                queued: false,
                entry: { event, status: "accepted", queuedAt: now.toISOString(), settledAt: null, reason: null },
            };
        }

        const entry: OutboxEntry = { event, status: "pending", queuedAt: now.toISOString(), settledAt: null, reason: null };
        writeJson(outboxPath(), [...outbox, entry]);
        return { queued: true, entry };
    });
}

/** What the Mac bridge must still run through the house writer, oldest first. */
export function pendingEvents(): BoardEvent[] {
    return readOutbox()
        .filter((entry) => entry.status === "pending")
        .map((entry) => entry.event);
}

export interface SyncAck {
    id: string;
    status: "accepted" | "rejected";
    reason?: string;
}

export interface SyncResult {
    syncedAt: string;
    events: number;
    acked: number;
    unknownAcks: string[];
}

/**
 * The Mac's push: verdicts on the outbox, then the whole board. Every event
 * must pass the house validator, or nothing is stored.
 */
export function applySync(payload: { acks?: SyncAck[]; events?: BoardEvent[] }, now = new Date()): Promise<SyncResult> {
    return serialise(async () => {
        const house = await loadHouse();
        if (!Array.isArray(payload.events)) throw new BoardInputError("board sync: events array required");
        const acks = payload.acks ?? [];
        if (!Array.isArray(acks)) throw new BoardInputError("board sync: acks must be an array");

        const seen = new Set<string>();
        payload.events.forEach((event, index) => {
            try {
                house.validateBoardEvent(event);
            } catch (error) {
                throw new BoardInputError(`board sync: event ${index} (${event?.id ?? "no id"}) — ${(error as Error).message}`);
            }
            const key = `${event.threadId} ${event.id}`;
            if (seen.has(key)) throw new BoardInputError(`board sync: duplicate event ${event.id} in ${event.threadId}`);
            seen.add(key);
        });

        const outbox = readOutbox();
        const unknownAcks: string[] = [];
        let acked = 0;
        for (const ack of acks) {
            if (ack?.status !== "accepted" && ack?.status !== "rejected") {
                throw new BoardInputError(`board sync: ack ${ack?.id} has no valid status`);
            }
            const entry = outbox.find((candidate) => candidate.event.id === ack.id);
            if (!entry) {
                unknownAcks.push(String(ack.id));
                continue;
            }
            entry.status = ack.status;
            entry.reason = ack.status === "rejected" ? String(ack.reason || "refused without a reason") : null;
            entry.settledAt = now.toISOString();
            acked += 1;
        }

        const syncedAt = now.toISOString();
        writeJson(snapshotPath(), { version: 1, syncedAt, events: payload.events } satisfies Snapshot);
        writeJson(outboxPath(), outbox);
        return { syncedAt, events: payload.events.length, acked, unknownAcks };
    });
}

function summarise(threadId: string, events: BoardEventView[]): BoardThreadView {
    const messages = events.filter((event) => event.kind === "message");
    const closure = events.find((event) => event.kind === "close") ?? null;
    const recipients = messages.flatMap((event) => (Array.isArray(event.to) ? event.to : event.to ? [event.to] : []));
    return {
        threadId,
        opener: messages[0]?.from ?? null,
        recipients: [...new Set(recipients)],
        participants: [...new Set(events.map((event) => event.from))],
        tags: [...new Set(events.flatMap((event) => event.tags ?? []))].sort(),
        lastDate: events.at(-1)?.date ?? null,
        closed: closure !== null,
        closedBy: closure?.from ?? null,
        pending: events.some((event) => event.pending),
        events,
    };
}

/** The whole board, open and closed, newest activity first. JJ's view. */
export function readBoard(): BoardView {
    const snapshot = readSnapshot();
    const outbox = readOutbox();
    const byThread = new Map<string, BoardEventView[]>();
    const add = (event: BoardEvent, pending: boolean) => {
        const list = byThread.get(event.threadId) ?? [];
        list.push({ ...event, pending });
        byThread.set(event.threadId, list);
    };
    for (const event of snapshot?.events ?? []) add(event, false);
    for (const event of unsyncedEvents(snapshot, outbox)) add(event, true);

    const threads = [...byThread.entries()]
        .map(([threadId, events]) => summarise(threadId, events))
        .sort((a, b) => Date.parse(b.lastDate ?? "") - Date.parse(a.lastDate ?? ""));
    return {
        syncedAt: snapshot?.syncedAt ?? null,
        threads,
        rejected: outbox.filter((entry) => entry.status === "rejected"),
        roster: ROSTER,
    };
}

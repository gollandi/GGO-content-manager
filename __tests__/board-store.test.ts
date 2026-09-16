// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applySync, pendingEvents, readBoard, submit, type ComposeInput } from "../lib/board/store";
import type { BoardEvent } from "../lib/board/types";

/**
 * La Bacheca — the Cockpit's half of the house board.
 *
 * JJ's writes must meet the same rules as `operations/house-board.js`
 * (roster, language, closure rights, id idempotency), always as `jj`, and
 * the Mac's push must never store a board the house writer would not read.
 */

const NOW = new Date("2026-09-16T20:00:00Z");
const IT_BODY = "Vorrei sapere se la bacheca funziona anche dal telefono, grazie.";
const EN_BODY = "Please tell me whether the board works from the phone as well.";

let root: string;
beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "ggo-board-test-"));
    process.env.COCKPIT_BOARD_DIR = root;
});
afterEach(() => {
    delete process.env.COCKPIT_BOARD_DIR;
    rmSync(root, { recursive: true, force: true });
});

const compose = (over: Partial<ComposeInput> = {}): ComposeInput => ({
    mode: "open",
    id: "jj-1",
    date: NOW.toISOString(),
    threadId: "bacheca-dal-telefono",
    to: "ettore",
    lang: "it",
    body: IT_BODY,
    ...over,
});

const agentEvent = (over: Partial<BoardEvent> = {}): BoardEvent => ({
    id: "ettore-1",
    threadId: "riparazione-coda",
    date: "2026-09-15T08:00:00.000Z",
    kind: "message",
    from: "ettore",
    to: "edmondo",
    lang: "en",
    body: "The repair touched your queue and it is now clean again.",
    ...over,
});

describe("submit", () => {
    it("queues a new thread as jj, whatever the client claims", async () => {
        const result = await submit({ ...compose(), from: "ambrogio" } as ComposeInput, NOW);
        expect(result.queued).toBe(true);
        expect(result.entry.event.from).toBe("jj");
        expect(pendingEvents()).toHaveLength(1);
        const board = readBoard();
        expect(board.threads[0]).toMatchObject({ threadId: "bacheca-dal-telefono", opener: "jj", pending: true });
    });

    it("is idempotent on id and refuses the same id with different content", async () => {
        await submit(compose(), NOW);
        const again = await submit(compose(), NOW);
        expect(again.queued).toBe(false);
        expect(pendingEvents()).toHaveLength(1);
        await expect(submit(compose({ body: `${IT_BODY} Ancora.` }), NOW)).rejects.toThrow(/different content/);
    });

    it("applies the house roster to recipients", async () => {
        await expect(submit(compose({ to: "mario" }), NOW)).rejects.toThrow(/to must be one of/);
        await expect(submit(compose({ to: ["house", "jj", "natascia"] }), NOW)).resolves.toMatchObject({ queued: true });
    });

    it("refuses a body that does not read as the declared language", async () => {
        await expect(submit(compose({ lang: "it", body: EN_BODY }), NOW)).rejects.toThrow(/does not read as Italian/);
        await expect(submit(compose({ lang: "fr" }), NOW)).rejects.toThrow(/Italian or English/);
        await expect(submit(compose({ lang: "en", body: EN_BODY }), NOW)).resolves.toMatchObject({ queued: true });
    });

    it("refuses slugs, stale dates and empty bodies", async () => {
        await expect(submit(compose({ threadId: "Not A Slug" }), NOW)).rejects.toThrow(/slug/);
        await expect(submit(compose({ date: "2026-09-01T00:00:00Z" }), NOW)).rejects.toThrow(/within a day/);
        await expect(submit(compose({ body: "   " }), NOW)).rejects.toThrow(/body required/);
    });

    it("keeps open and reply honest about whether the thread exists", async () => {
        await applySync({ events: [agentEvent()] }, NOW);
        await expect(submit(compose({ threadId: "riparazione-coda" }), NOW)).rejects.toThrow(/already exists/);
        await expect(submit(compose({ mode: "reply", threadId: "nessuna-traccia" }), NOW)).rejects.toThrow(/does not exist/);
        await expect(
            submit(compose({ mode: "reply", id: "jj-2", threadId: "riparazione-coda", to: "ettore" }), NOW)
        ).resolves.toMatchObject({ queued: true });
    });

    it("lets jj close any thread, once, and refuses replies after it", async () => {
        await applySync({ events: [agentEvent()] }, NOW);
        const close = compose({ mode: "close", id: "jj-close", threadId: "riparazione-coda", to: undefined, lang: "en", body: "Done, thank you." });
        const closed = await submit(close, NOW);
        expect(closed.entry.event).not.toHaveProperty("to");
        expect(closed.entry.event.kind).toBe("close");
        await expect(submit({ ...close, id: "jj-close-2" }, NOW)).rejects.toThrow(/already closed/);
        await expect(
            submit(compose({ mode: "reply", id: "jj-3", threadId: "riparazione-coda" }), NOW)
        ).rejects.toThrow(/is closed/);
        expect(readBoard().threads[0]).toMatchObject({ closed: true, closedBy: "jj", pending: true });
    });

    it("does not queue what the board already holds", async () => {
        const mine = agentEvent({ id: "jj-9", date: NOW.toISOString(), from: "jj", to: "ettore", lang: "it", body: IT_BODY });
        await applySync({ events: [mine] }, NOW);
        const result = await submit(compose({ mode: "reply", id: "jj-9", threadId: mine.threadId, date: mine.date }), NOW);
        expect(result.queued).toBe(false);
        expect(pendingEvents()).toHaveLength(0);
    });
});

describe("applySync", () => {
    it("stores the board, settles verdicts and keeps refusals visible", async () => {
        await submit(compose(), NOW);
        await submit(compose({ id: "jj-2", threadId: "seconda-domanda" }), NOW);
        const delivered = { ...(await submit(compose(), NOW)).entry.event };
        const result = await applySync(
            {
                acks: [
                    { id: "jj-1", status: "accepted" },
                    { id: "jj-2", status: "rejected", reason: "board: thread seconda-domanda is closed — open a new one" },
                    { id: "ghost", status: "accepted" },
                ],
                events: [agentEvent(), delivered],
            },
            NOW
        );
        expect(result).toMatchObject({ events: 2, acked: 2, unknownAcks: ["ghost"] });
        expect(pendingEvents()).toHaveLength(0);
        const board = readBoard();
        expect(board.syncedAt).toBe(NOW.toISOString());
        expect(board.threads.map((thread) => thread.threadId)).toEqual(["bacheca-dal-telefono", "riparazione-coda"]);
        expect(board.threads.every((thread) => !thread.pending)).toBe(true);
        expect(board.rejected).toHaveLength(1);
        expect(board.rejected[0].reason).toMatch(/closed/);
    });

    it("stores nothing if a single event would not pass the house validator", async () => {
        await applySync({ events: [agentEvent()] }, NOW);
        const before = readFileSync(path.join(root, "snapshot.json"), "utf8");
        await expect(
            applySync({ events: [agentEvent({ id: "x", from: "stranger" })] }, NOW)
        ).rejects.toThrow(/event 0 \(x\)/);
        await expect(applySync({ events: [agentEvent(), agentEvent()] }, NOW)).rejects.toThrow(/duplicate/);
        await expect(applySync({} as never, NOW)).rejects.toThrow(/events array/);
        expect(readFileSync(path.join(root, "snapshot.json"), "utf8")).toBe(before);
    });

    it("fails loud on a corrupt store rather than showing an empty board", async () => {
        await applySync({ events: [agentEvent()] }, NOW);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(path.join(root, "snapshot.json"), "{not json");
        expect(() => readBoard()).toThrow();
    });
});

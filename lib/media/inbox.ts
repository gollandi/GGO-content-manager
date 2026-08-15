import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { mediaConfig } from "../config";

/**
 * Il Carico — the media inbox on the server.
 *
 * JJ shoots on the phone; the file must land on the VPS without the Mac in
 * the path (the Mac's connection is what makes the night runs flaky). The
 * upload is chunked and resumable because a 4G upload of a 500 MB clip
 * fails often enough that a single POST is not a design, it is a hope.
 *
 * Layout under the media root:
 *
 *   staging/<id>/parts/000000.part …   chunks as they arrive
 *   staging/<id>/manifest.json         status "receiving"
 *   inbox/<id>.<ext>                   the assembled media
 *   inbox/<id>.json                    the manifest — WRITTEN LAST, by
 *                                      rename, so it is the atomic marker
 *                                      that the media beside it is whole
 *
 * The worker (Family C) watches inbox/*.json, never the media glob: a
 * manifest exists only once its file is complete, which removes the classic
 * race where a watcher picks up a half-written video.
 *
 * This module OWNS the filesystem contract. Ingest only — nothing here
 * publishes, and the three publish gates stay with JJ.
 */

/** Upload ids are server-minted: 32 hex chars, no caller-supplied paths. */
const ID_RE = /^[0-9a-f]{32}$/;

/** What the house can actually process — Greta/Titti's formats. */
export const ALLOWED_EXTENSIONS = [
    "mp4",
    "mov",
    "m4v",
    "webm",
    "mkv",
    "avi",
    // audio, for voice-over and transcript-only jobs
    "m4a",
    "mp3",
    "wav",
] as const;

/** What the material is for — routes the job downstream. */
export const MEDIA_KINDS = [
    "dual-roll",
    "talking-head",
    "b-roll",
    "voce",
    "altro",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];
export type UploadStatus = "receiving" | "ready" | "aborted";

export interface UploadManifest {
    id: string;
    /** Sanitised original name, kept for the human reading the inbox. */
    filename: string;
    /** Name on disk: `<id>.<ext>`. */
    storedAs: string;
    extension: string;
    kind: MediaKind;
    note: string;
    /** Who uploaded — the session email, so the inbox is attributable. */
    operator: string;
    declaredBytes: number;
    receivedBytes: number;
    chunkCount: number;
    status: UploadStatus;
    createdAt: string;
    completedAt: string | null;
}

export class MediaInboxError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = "MediaInboxError";
    }
}

/* ── paths ──────────────────────────────────────────────────────────────── */

function root(): string {
    return mediaConfig.root;
}

export function stagingDir(id: string): string {
    return path.join(root(), "staging", assertId(id));
}

function partsDir(id: string): string {
    return path.join(stagingDir(id), "parts");
}

export function inboxDir(): string {
    return path.join(root(), "inbox");
}

/** Throws unless the id is one we minted — the only traversal guard needed. */
export function assertId(id: string): string {
    if (!ID_RE.test(id)) {
        throw new MediaInboxError("Malformed upload id", 400);
    }
    return id;
}

/* ── validation ─────────────────────────────────────────────────────────── */

/**
 * Reduce whatever the phone sent to a name safe to sit in a shell script,
 * an ffmpeg argument, and a filesystem. Extension is returned separately
 * because it is the one part we validate against an allowlist.
 */
export function sanitiseFilename(raw: string): { name: string; extension: string } {
    const base = path.basename(raw ?? "").trim();
    const dot = base.lastIndexOf(".");
    const rawExt = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
    const extension = (ALLOWED_EXTENSIONS as readonly string[]).includes(rawExt) ? rawExt : "";
    if (!extension) {
        throw new MediaInboxError(
            `Unsupported file type${rawExt ? ` .${rawExt}` : ""} — accepted: ${ALLOWED_EXTENSIONS.join(", ")}`,
            415
        );
    }
    const stem = (dot > 0 ? base.slice(0, dot) : base)
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, 80);
    return { name: `${stem || "clip"}.${extension}`, extension };
}

function assertKind(kind: string): MediaKind {
    if (!(MEDIA_KINDS as readonly string[]).includes(kind)) {
        throw new MediaInboxError("Unknown media kind", 400);
    }
    return kind as MediaKind;
}

/* ── manifest io ────────────────────────────────────────────────────────── */

async function readManifestAt(file: string): Promise<UploadManifest | null> {
    try {
        return JSON.parse(await readFile(file, "utf8")) as UploadManifest;
    } catch {
        return null;
    }
}

/** Write via temp + rename so a reader never sees a partial manifest. */
async function writeManifestAt(file: string, manifest: UploadManifest): Promise<void> {
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
    await rename(tmp, file);
}

function stagingManifestPath(id: string): string {
    return path.join(stagingDir(id), "manifest.json");
}

function inboxManifestPath(id: string): string {
    return path.join(inboxDir(), `${assertId(id)}.json`);
}

/** The manifest wherever it currently lives (staging first, then inbox). */
export async function readManifest(id: string): Promise<UploadManifest | null> {
    return (
        (await readManifestAt(stagingManifestPath(id))) ??
        (await readManifestAt(inboxManifestPath(id)))
    );
}

/* ── the upload lifecycle ───────────────────────────────────────────────── */

export interface CreateUploadInput {
    filename: string;
    kind: string;
    note?: string;
    declaredBytes: number;
    operator: string;
}

/** Open an upload: mint the id, reserve staging, record intent. */
export async function createUpload(input: CreateUploadInput): Promise<UploadManifest> {
    const { name, extension } = sanitiseFilename(input.filename);
    const kind = assertKind(input.kind);

    const declaredBytes = Math.trunc(input.declaredBytes);
    if (!Number.isFinite(declaredBytes) || declaredBytes <= 0) {
        throw new MediaInboxError("Declared size must be a positive number of bytes", 400);
    }
    if (declaredBytes > mediaConfig.maxBytes) {
        throw new MediaInboxError(
            `File too large — limit is ${formatBytes(mediaConfig.maxBytes)}`,
            413
        );
    }

    const id = randomBytes(16).toString("hex");
    const manifest: UploadManifest = {
        id,
        filename: name,
        storedAs: `${id}.${extension}`,
        extension,
        kind,
        note: (input.note ?? "").trim().slice(0, 500),
        operator: input.operator,
        declaredBytes,
        receivedBytes: 0,
        chunkCount: 0,
        status: "receiving",
        createdAt: new Date().toISOString(),
        completedAt: null,
    };

    await mkdir(partsDir(id), { recursive: true });
    await mkdir(inboxDir(), { recursive: true });
    await writeManifestAt(stagingManifestPath(id), manifest);
    return manifest;
}

/**
 * Accept one chunk. Idempotent by index: a retried chunk overwrites its
 * part rather than appending, so a phone that loses signal mid-chunk and
 * resends is correct rather than corrupt.
 */
export async function writeChunk(
    id: string,
    index: number,
    body: Uint8Array
): Promise<UploadManifest> {
    const manifest = await readManifest(id);
    if (!manifest) throw new MediaInboxError("Unknown upload", 404);
    if (manifest.status !== "receiving") {
        throw new MediaInboxError(`Upload already ${manifest.status}`, 409);
    }
    if (!Number.isInteger(index) || index < 0 || index > MAX_CHUNKS) {
        throw new MediaInboxError("Bad chunk index", 400);
    }
    if (body.byteLength === 0) {
        throw new MediaInboxError("Empty chunk", 400);
    }
    if (body.byteLength > mediaConfig.maxChunkBytes) {
        throw new MediaInboxError("Chunk too large", 413);
    }

    const part = path.join(partsDir(id), `${String(index).padStart(6, "0")}.part`);
    const previous = await sizeOf(part);
    await writeFile(part, body);

    const received = manifest.receivedBytes - previous + body.byteLength;
    if (received > manifest.declaredBytes) {
        throw new MediaInboxError("Upload exceeds its declared size", 413);
    }

    const next: UploadManifest = {
        ...manifest,
        receivedBytes: received,
        chunkCount: previous > 0 ? manifest.chunkCount : manifest.chunkCount + 1,
    };
    await writeManifestAt(stagingManifestPath(id), next);
    return next;
}

/**
 * Assemble the parts in index order into the inbox, then publish the
 * manifest by rename. Order matters: the media file is whole before the
 * marker the worker watches for ever exists.
 */
export async function completeUpload(id: string): Promise<UploadManifest> {
    const manifest = await readManifest(id);
    if (!manifest) throw new MediaInboxError("Unknown upload", 404);
    if (manifest.status === "ready") return manifest;
    if (manifest.status !== "receiving") {
        throw new MediaInboxError(`Upload already ${manifest.status}`, 409);
    }

    const parts = (await readdir(partsDir(id)))
        .filter((f) => f.endsWith(".part"))
        .sort();
    if (parts.length === 0) throw new MediaInboxError("No chunks received", 400);

    await mkdir(inboxDir(), { recursive: true });
    const target = path.join(inboxDir(), manifest.storedAs);
    const tmp = `${target}.partial`;

    const out = createWriteStream(tmp);
    try {
        for (const part of parts) {
            await pipeline(createReadStream(path.join(partsDir(id), part)), out, { end: false });
        }
    } finally {
        // Settle the stream without masking whatever the loop threw: an
        // already-destroyed stream never emits "close", so waiting on it
        // unconditionally would hang instead of surfacing the real error.
        await new Promise<void>((resolve) => {
            if (out.closed || out.destroyed) return resolve();
            out.on("close", resolve);
            out.on("error", () => resolve());
            out.end();
        });
    }

    const assembled = await sizeOf(tmp);
    if (assembled !== manifest.receivedBytes) {
        await rm(tmp, { force: true });
        throw new MediaInboxError(
            `Assembled size ${assembled} does not match received ${manifest.receivedBytes}`,
            409
        );
    }

    // Media first…
    await rename(tmp, target);

    const done: UploadManifest = {
        ...manifest,
        status: "ready",
        completedAt: new Date().toISOString(),
    };
    // …then the marker the worker waits on.
    await writeManifestAt(inboxManifestPath(id), done);
    await rm(stagingDir(id), { recursive: true, force: true });
    return done;
}

/** Give up on an upload and reclaim its staging. */
export async function abortUpload(id: string): Promise<void> {
    const manifest = await readManifest(id);
    if (manifest?.status === "ready") {
        throw new MediaInboxError("Upload already completed", 409);
    }
    await rm(stagingDir(id), { recursive: true, force: true });
}

/** Everything in the inbox, newest first — what the page shows JJ. */
export async function listInbox(): Promise<UploadManifest[]> {
    let files: string[];
    try {
        files = await readdir(inboxDir());
    } catch {
        return [];
    }
    const manifests = await Promise.all(
        files
            .filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"))
            .map((f) => readManifestAt(path.join(inboxDir(), f)))
    );
    return manifests
        .filter((m): m is UploadManifest => m !== null)
        .sort((a, b) => (a.completedAt ?? a.createdAt) < (b.completedAt ?? b.createdAt) ? 1 : -1);
}

/* ── helpers ────────────────────────────────────────────────────────────── */

/** A 2 GiB file at the 5 MiB floor is ~410 parts; this is pure runaway guard. */
const MAX_CHUNKS = 100_000;

async function sizeOf(file: string): Promise<number> {
    try {
        return (await stat(file)).size;
    } catch {
        return 0;
    }
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

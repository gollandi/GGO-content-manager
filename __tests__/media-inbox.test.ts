import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Il Carico — the media inbox contract.
 *
 * Two things must hold. The bytes that come off the phone must be the bytes
 * on disk, reassembled in order; and nothing a phone can put in a filename
 * may write outside the inbox.
 *
 * mediaConfig reads its root at import time, so the env is set before the
 * module is imported.
 */

let media: typeof import("../lib/media/inbox");
let root: string;

beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ggo-carico-"));
    process.env.COCKPIT_MEDIA_ROOT = root;
    media = await import("../lib/media/inbox");
});

afterAll(async () => {
    await rm(root, { recursive: true, force: true });
});

const OPERATOR = "jj@ggomed.co.uk";

async function open(filename = "clip.mp4", size = 12) {
    return media.createUpload({
        filename,
        kind: "talking-head",
        note: "seconda take",
        declaredBytes: size,
        operator: OPERATOR,
    });
}

describe("sanitiseFilename", () => {
    it("keeps only the basename, so a path cannot travel", () => {
        expect(media.sanitiseFilename("../../../etc/passwd.mp4").name).toBe("passwd.mp4");
    });

    it("strips characters that would bite in a shell or ffmpeg argument", () => {
        const { name } = media.sanitiseFilename("le mie; riprese $(rm -rf).mov");
        expect(name).toBe("le-mie-riprese-rm-rf.mov");
    });

    it("refuses a type the house cannot process", () => {
        expect(() => media.sanitiseFilename("payload.php")).toThrow(/Unsupported file type/);
        expect(() => media.sanitiseFilename("noextension")).toThrow(/Unsupported file type/);
    });

    it("accepts the phone's own formats", () => {
        expect(media.sanitiseFilename("IMG_4821.MOV").extension).toBe("mov");
    });
});

describe("upload ids", () => {
    it("refuse anything we did not mint", () => {
        for (const bad of ["../escape", "..", "abc", "", "/etc/passwd", "a".repeat(31)]) {
            expect(() => media.assertId(bad)).toThrow(/Malformed upload id/);
        }
    });

    it("are hex and land inside the media root", async () => {
        const manifest = await open();
        expect(manifest.id).toMatch(/^[0-9a-f]{32}$/);
        expect(path.resolve(media.stagingDir(manifest.id)).startsWith(path.resolve(root))).toBe(true);
        await media.abortUpload(manifest.id);
    });
});

describe("the upload lifecycle", () => {
    it("reassembles the chunks in order, byte for byte", async () => {
        const payload = Buffer.from("il girato di questa mattina, in due pezzi");
        const manifest = await open("mattina.mp4", payload.length);
        const cut = 17;

        await media.writeChunk(manifest.id, 0, payload.subarray(0, cut));
        await media.writeChunk(manifest.id, 1, payload.subarray(cut));
        const done = await media.completeUpload(manifest.id);

        expect(done.status).toBe("ready");
        expect(done.receivedBytes).toBe(payload.length);

        const stored = await readFile(path.join(media.inboxDir(), done.storedAs));
        expect(stored.equals(payload)).toBe(true);
    });

    it("orders the media before its manifest, so the worker never sees half a file", async () => {
        const payload = Buffer.from("marker ordering");
        const manifest = await open("ordine.mp4", payload.length);
        await media.writeChunk(manifest.id, 0, payload);
        const done = await media.completeUpload(manifest.id);

        // The manifest is the marker the worker watches for; the media it
        // names must already be whole and the right size beside it.
        const marker = JSON.parse(
            await readFile(path.join(media.inboxDir(), `${done.id}.json`), "utf8")
        );
        const media_file = await stat(path.join(media.inboxDir(), marker.storedAs));
        expect(media_file.size).toBe(marker.receivedBytes);
        expect(marker.status).toBe("ready");
    });

    it("treats a resent chunk as a replacement, not an append", async () => {
        const manifest = await open("ripetuto.mp4", 8);
        await media.writeChunk(manifest.id, 0, Buffer.from("AAAA"));
        await media.writeChunk(manifest.id, 0, Buffer.from("BBBB")); // the retry
        const after = await media.writeChunk(manifest.id, 1, Buffer.from("CCCC"));

        expect(after.receivedBytes).toBe(8);
        const done = await media.completeUpload(manifest.id);
        const stored = await readFile(path.join(media.inboxDir(), done.storedAs));
        expect(stored.toString()).toBe("BBBBCCCC");
    });

    it("reclaims the staging directory once the file is in the inbox", async () => {
        const manifest = await open("pulizia.mp4", 4);
        await media.writeChunk(manifest.id, 0, Buffer.from("data"));
        await media.completeUpload(manifest.id);
        await expect(readdir(media.stagingDir(manifest.id))).rejects.toThrow();
    });

    it("refuses more bytes than were declared", async () => {
        const manifest = await open("bugiardo.mp4", 4);
        await expect(
            media.writeChunk(manifest.id, 0, Buffer.from("molto piu lungo del dichiarato"))
        ).rejects.toThrow(/exceeds its declared size/);
    });

    it("refuses a file larger than the ceiling", async () => {
        await expect(
            media.createUpload({
                filename: "enorme.mp4",
                kind: "b-roll",
                declaredBytes: 99 * 1024 * 1024 * 1024,
                operator: OPERATOR,
            })
        ).rejects.toThrow(/too large/);
    });

    it("refuses an unknown kind, so downstream routing stays a closed set", async () => {
        await expect(
            media.createUpload({
                filename: "clip.mp4",
                kind: "qualcos-altro",
                declaredBytes: 10,
                operator: OPERATOR,
            })
        ).rejects.toThrow(/Unknown media kind/);
    });

    it("will not complete an upload that received nothing", async () => {
        const manifest = await open("vuoto.mp4", 10);
        await expect(media.completeUpload(manifest.id)).rejects.toThrow(/No chunks/);
        await media.abortUpload(manifest.id);
    });

    it("will not accept chunks for an upload already completed", async () => {
        const manifest = await open("chiuso.mp4", 4);
        await media.writeChunk(manifest.id, 0, Buffer.from("data"));
        await media.completeUpload(manifest.id);
        await expect(media.writeChunk(manifest.id, 1, Buffer.from("x"))).rejects.toThrow(/already ready/);
    });

    it("abandons an upload and forgets its staging", async () => {
        const manifest = await open("abbandono.mp4", 4);
        await media.writeChunk(manifest.id, 0, Buffer.from("data"));
        await media.abortUpload(manifest.id);
        await expect(readdir(media.stagingDir(manifest.id))).rejects.toThrow();
    });
});

describe("listInbox", () => {
    it("reports the completed deposits, newest first", async () => {
        const uploads = await media.listInbox();
        expect(uploads.length).toBeGreaterThan(0);
        expect(uploads.every((u) => u.status === "ready")).toBe(true);
        const times = uploads.map((u) => u.completedAt ?? u.createdAt);
        expect([...times].sort().reverse()).toEqual(times);
    });

    it("records who deposited, so the inbox is attributable", async () => {
        const uploads = await media.listInbox();
        expect(uploads[0].operator).toBe(OPERATOR);
    });
});

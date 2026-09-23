import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Il Carico — the worker's half of the contract.
 *
 * The rule the worker exists to respect: it acts on manifests, never on the
 * media glob. These tests put a half-written video in the inbox WITHOUT a
 * manifest and prove the worker leaves it alone — that is the race that
 * would otherwise hand Greta a truncated file.
 *
 * ffmpeg is not assumed: the cases that need it are skipped when it is
 * absent, so the suite still means something on a developer's Mac.
 */

const WORKER = path.join(process.cwd(), "tools", "worker", "carico-worker.mjs");
const FFMPEG = process.env.COCKPIT_FFMPEG || "/usr/local/bin/ffmpeg";

let root: string;
let jobs: typeof import("../lib/media/jobs");

async function have(binary: string): Promise<boolean> {
    try {
        await run(binary, ["-version"]);
        return true;
    } catch {
        return false;
    }
}

const hasFfmpeg = await have(FFMPEG);

beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ggo-worker-"));
    await mkdir(path.join(root, "inbox"), { recursive: true });
    process.env.COCKPIT_MEDIA_ROOT = root;
    jobs = await import("../lib/media/jobs");
});

afterAll(async () => {
    await rm(root, { recursive: true, force: true });
});

/** Run one worker pass against the scratch root. */
async function pass(): Promise<string> {
    const { stdout } = await run(process.execPath, [WORKER], {
        env: { ...process.env, COCKPIT_MEDIA_ROOT: root, COCKPIT_FFMPEG: FFMPEG },
        maxBuffer: 8 * 1024 * 1024,
    });
    return stdout;
}

/** A real, tiny clip — ffmpeg's own test source, so probing means something. */
async function makeClip(file: string, args: string[] = []): Promise<void> {
    await run(FFMPEG, [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=1",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        ...args,
        "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
        file,
    ]);
}

async function publish(id: string, kind: string, storedAs: string): Promise<void> {
    await writeFile(
        path.join(root, "inbox", `${id}.json`),
        JSON.stringify({
            id,
            filename: storedAs,
            storedAs,
            extension: path.extname(storedAs).slice(1),
            kind,
            note: "",
            operator: "jj@ggomed.co.uk",
            declaredBytes: 1,
            receivedBytes: 1,
            chunkCount: 1,
            status: "ready",
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
        })
    );
}

describe("Il Carico worker — the manifest is the only trigger", () => {
    it("ignores media that has no manifest beside it", async () => {
        // A video mid-upload: bytes on disk, no manifest published yet.
        await writeFile(path.join(root, "inbox", "deadbeef".repeat(4) + ".mp4"), "half a video");
        await pass();
        expect(await jobs.listJobs()).toEqual([]);
    });

    it("ignores a manifest that is still receiving", async () => {
        const id = "a".repeat(32);
        await writeFile(
            path.join(root, "inbox", `${id}.json`),
            JSON.stringify({ id, status: "receiving", kind: "b-roll", storedAs: `${id}.mp4` })
        );
        await pass();
        expect((await jobs.listJobs()).some((j) => j.id === id)).toBe(false);
    });

    it.skipIf(!hasFfmpeg)("probes a b-roll clip and records a poster", async () => {
        const id = "b".repeat(32);
        await makeClip(path.join(root, "inbox", `${id}.mp4`));
        await publish(id, "b-roll", `${id}.mp4`);

        await pass();

        const job = (await jobs.listJobs()).find((j) => j.id === id);
        expect(job?.status).toBe("ready");
        expect(job?.probe?.video?.width).toBe(320);
        expect(job?.probe?.video?.height).toBe(180);
        expect(job?.outputs.map((o) => o.role)).toContain("poster");
        expect(job!.outputs.every((o) => o.bytes > 0)).toBe(true);
    }, 120_000);

    it.skipIf(!hasFfmpeg)("splits a side-by-side dual roll into two halves", async () => {
        const id = "c".repeat(32);
        // 640x120 — twice as wide as it is tall, i.e. side-by-side.
        await run(FFMPEG, [
            "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x120:rate=10:duration=1",
            "-c:v", "libx264", "-preset", "ultrafast",
            path.join(root, "inbox", `${id}.mp4`),
        ]);
        await publish(id, "dual-roll", `${id}.mp4`);

        await pass();

        const job = (await jobs.listJobs()).find((j) => j.id === id);
        expect(job?.status).toBe("ready");
        const roles = job!.outputs.map((o) => o.role);
        expect(roles).toContain("roll-a");
        expect(roles).toContain("roll-b");

        const made = await readdir(path.join(root, "ready", id));
        expect(made).toContain("roll-a.mp4");
        expect(made).toContain("roll-b.mp4");
    }, 180_000);

    it.skipIf(!hasFfmpeg)("leaves a single-camera dual roll whole for Titti to pair", async () => {
        const id = "d".repeat(32);
        await makeClip(path.join(root, "inbox", `${id}.mp4`)); // 320x120, not 2:1
        await publish(id, "dual-roll", `${id}.mp4`);

        await pass();

        const job = (await jobs.listJobs()).find((j) => j.id === id);
        expect(job?.outputs.map((o) => o.role)).not.toContain("roll-a");
        expect(job?.notes?.join(" ")).toMatch(/pair/i);
    }, 120_000);

    it.skipIf(!hasFfmpeg)("does not process the same upload twice", async () => {
        const id = "e".repeat(32);
        await makeClip(path.join(root, "inbox", `${id}.mp4`));
        await publish(id, "b-roll", `${id}.mp4`);

        await pass();
        const first = (await jobs.listJobs()).find((j) => j.id === id)!;
        await pass();
        const second = (await jobs.listJobs()).find((j) => j.id === id)!;

        expect(second.startedAt).toBe(first.startedAt);
    }, 180_000);

    it.skipIf(!hasFfmpeg)("records a failure instead of dying on unreadable media", async () => {
        const id = "f".repeat(32);
        await writeFile(path.join(root, "inbox", `${id}.mp4`), "this is not a video");
        await publish(id, "talking-head", `${id}.mp4`);

        await pass();

        const job = (await jobs.listJobs()).find((j) => j.id === id);
        expect(job?.status).toBe("failed");
        expect(job?.error).toBeTruthy();
    }, 120_000);
});

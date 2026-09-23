#!/usr/bin/env node
/**
 * Il Carico — the worker (second half of Family C).
 *
 * Il Carico lands footage in the inbox; this consumes it. It runs on the
 * VPS as `jj`, driven by a systemd timer, so the Mac is no longer needed
 * for ingest OR for the first pass over the material.
 *
 * THE CONTRACT, which this file exists to honour:
 *   the worker watches `inbox/*.json` and NEVER the media glob. A manifest
 *   is published by rename only after its media file is whole, so seeing
 *   the manifest is the proof that the file beside it is complete. Globbing
 *   the media would pick up half-written videos; that is the whole point.
 *
 * Per manifest, by kind:
 *   dual-roll     side-by-side 2x recording (OBS 3840x1080) → split into
 *                 two halves, Roll A / Roll B, ready for Titti. A clip that
 *                 is not side-by-side is left as `needs-pair`: pairing two
 *                 separate files is Titti's transcript-similarity job, not
 *                 something to guess at here.
 *   talking-head  probe + poster + 16 kHz mono audio + Whisper transcript
 *   voce          audio only + Whisper transcript
 *   b-roll/altro  probe + poster
 *
 * Output lands in `ready/<id>/`, with `job.json` as the record. Nothing
 * here writes to Sanity or Notion, and none of the three publish gates is
 * touched: JJ still reviews everything through Il Cancello.
 */

import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const MEDIA_ROOT = process.env.COCKPIT_MEDIA_ROOT || "/srv/ggo-media";
const INBOX = path.join(MEDIA_ROOT, "inbox");
const READY = path.join(MEDIA_ROOT, "ready");

const FFMPEG = process.env.COCKPIT_FFMPEG || "/usr/local/bin/ffmpeg";
const FFPROBE = process.env.COCKPIT_FFPROBE || "/usr/local/bin/ffprobe";
const WHISPER = process.env.COCKPIT_WHISPER || "/opt/whisper.cpp/build/bin/whisper-cli";
const WHISPER_MODEL = process.env.COCKPIT_WHISPER_MODEL || "/opt/whisper.cpp/models/ggml-base.bin";
const WHISPER_LANG = process.env.COCKPIT_WHISPER_LANG || "auto";

/** One pass processes at most this many manifests, so a backlog drains in
 *  timer-sized bites instead of one unbounded run. */
const MAX_PER_PASS = Number(process.env.COCKPIT_WORKER_BATCH || 3);

/** A single job that outlives its plausible runtime is stuck, not slow. */
const STUCK_AFTER_MS = Number(process.env.COCKPIT_WORKER_STUCK_MS || 6 * 60 * 60 * 1000);

const log = (...parts) => console.log(new Date().toISOString(), ...parts);

/* ── the pass ───────────────────────────────────────────────────────────── */

async function main() {
    await mkdir(READY, { recursive: true });

    // Manifests only. Never readdir(INBOX) for media.
    let entries;
    try {
        entries = (await readdir(INBOX)).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"));
    } catch {
        log("inbox not readable yet:", INBOX);
        return;
    }

    let done = 0;
    for (const entry of entries.sort()) {
        if (done >= MAX_PER_PASS) {
            log(`batch limit ${MAX_PER_PASS} reached — ${entries.length - done} manifest(s) left for the next pass`);
            break;
        }

        const manifest = await readJson(path.join(INBOX, entry));
        if (!manifest?.id || manifest.status !== "ready") continue;

        const claimed = await claim(manifest.id);
        if (!claimed) continue;

        done += 1;
        try {
            const job = await process_(manifest);
            await writeJson(jobPath(manifest.id), job);
            log(`done ${manifest.id} (${job.kind}) → ${job.outputs.length} output(s)`);
        } catch (err) {
            log(`FAILED ${manifest.id}:`, err?.message ?? err);
            await writeJson(jobPath(manifest.id), {
                id: manifest.id,
                kind: manifest.kind,
                filename: manifest.filename,
                status: "failed",
                error: String(err?.message ?? err).slice(0, 2000),
                outputs: [],
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
            });
        }
    }
}

/**
 * Claim by creating job.json exclusively — the filesystem decides the
 * winner, so a second worker (or an overlapping timer) cannot double-run
 * a job. A claim older than STUCK_AFTER_MS is treated as abandoned.
 */
async function claim(id) {
    const file = jobPath(id);
    await mkdir(path.dirname(file), { recursive: true });

    const existing = await readJson(file);
    if (existing) {
        if (existing.status !== "running") return false;
        const age = Date.now() - Date.parse(existing.startedAt ?? 0);
        if (age < STUCK_AFTER_MS) return false;
        log(`reclaiming stale job ${id} (running for ${Math.round(age / 60000)} min)`);
        await rm(file, { force: true });
    }

    try {
        const fh = await open(file, "wx");
        await fh.writeFile(JSON.stringify({ id, status: "running", startedAt: new Date().toISOString() }, null, 2));
        await fh.close();
        return true;
    } catch (err) {
        if (err?.code === "EEXIST") return false;
        throw err;
    }
}

async function process_(manifest) {
    const started = new Date().toISOString();
    const source = path.join(INBOX, manifest.storedAs);
    await access(source, constants.R_OK);

    const dir = jobDir(manifest.id);
    await mkdir(dir, { recursive: true });

    const probe = await probeMedia(source);
    const outputs = [];
    const notes = [];

    const hasVideo = Boolean(probe.video);
    const audioOnly = !hasVideo && Boolean(probe.audio);

    switch (manifest.kind) {
        case "dual-roll": {
            if (!hasVideo) throw new Error("dual-roll material has no video stream");
            const { width, height } = probe.video;
            // A side-by-side recording is markedly wider than 16:9. Anything
            // else is a single camera that Titti must pair by transcript.
            if (width >= height * 2) {
                outputs.push(await splitSideBySide(source, dir, probe.video));
                notes.push(`split ${width}x${height} into two ${width / 2}x${height} rolls`);
            } else {
                notes.push(
                    `${width}x${height} is not side-by-side — left whole for Titti to pair by transcript`
                );
            }
            if (hasVideo) outputs.push(await poster(source, dir));
            break;
        }
        case "talking-head": {
            if (hasVideo) outputs.push(await poster(source, dir));
            const wav = await extractAudio(source, dir);
            outputs.push(wav);
            outputs.push(...(await transcribe(wav.path, dir, notes)));
            break;
        }
        case "voce": {
            const wav = await extractAudio(source, dir);
            outputs.push(wav);
            outputs.push(...(await transcribe(wav.path, dir, notes)));
            break;
        }
        default: {
            // b-roll, altro: identify it and give JJ something to look at.
            if (hasVideo) outputs.push(await poster(source, dir));
            else if (audioOnly) notes.push("audio-only material — no poster");
            break;
        }
    }

    return {
        id: manifest.id,
        kind: manifest.kind,
        filename: manifest.filename,
        storedAs: manifest.storedAs,
        operator: manifest.operator,
        note: manifest.note,
        status: "ready",
        probe,
        outputs: outputs.flat().filter(Boolean),
        notes,
        startedAt: started,
        finishedAt: new Date().toISOString(),
    };
}

/* ── the operations ─────────────────────────────────────────────────────── */

async function probeMedia(file) {
    const { stdout } = await run(FFPROBE, [
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        file,
    ], { maxBuffer: 8 * 1024 * 1024 });

    const raw = JSON.parse(stdout);
    const video = raw.streams?.find((s) => s.codec_type === "video");
    const audio = raw.streams?.find((s) => s.codec_type === "audio");

    return {
        durationSeconds: Number(raw.format?.duration ?? 0),
        bytes: Number(raw.format?.size ?? 0),
        container: raw.format?.format_name ?? null,
        video: video
            ? {
                  codec: video.codec_name,
                  width: Number(video.width),
                  height: Number(video.height),
                  fps: rateToNumber(video.avg_frame_rate),
              }
            : null,
        audio: audio
            ? {
                  codec: audio.codec_name,
                  channels: Number(audio.channels ?? 0),
                  sampleRate: Number(audio.sample_rate ?? 0),
              }
            : null,
    };
}

function rateToNumber(rate) {
    if (!rate || typeof rate !== "string") return null;
    const [num, den] = rate.split("/").map(Number);
    if (!den) return num || null;
    return Number((num / den).toFixed(3));
}

/** Titti's SPLIT, done on the server: one 3840x1080 file → two 1920x1080. */
async function splitSideBySide(source, dir, video) {
    const half = Math.floor(video.width / 2);
    const left = path.join(dir, "roll-a.mp4");
    const right = path.join(dir, "roll-b.mp4");

    await ffmpeg([
        "-i", source,
        "-filter_complex",
        `[0:v]crop=${half}:${video.height}:0:0[a];[0:v]crop=${half}:${video.height}:${half}:0[b]`,
        "-map", "[a]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", left,
        "-map", "[b]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", right,
    ]);

    return [
        { role: "roll-a", path: left, bytes: await sizeOf(left) },
        { role: "roll-b", path: right, bytes: await sizeOf(right) },
    ];
}

async function poster(source, dir) {
    const out = path.join(dir, "poster.jpg");
    // A second in, to skip the black frame at 0 — but a clip shorter than
    // that seeks past its own end and writes nothing, so fall back to the
    // first frame rather than recording an empty poster.
    await ffmpeg(["-ss", "1", "-i", source, "-frames:v", "1", "-q:v", "3", out]);
    if ((await sizeOf(out)) === 0) {
        await ffmpeg(["-i", source, "-frames:v", "1", "-q:v", "3", out]);
    }
    const bytes = await sizeOf(out);
    return bytes > 0 ? { role: "poster", path: out, bytes } : null;
}

/** 16 kHz mono PCM — what Whisper wants, and small enough to keep. */
async function extractAudio(source, dir) {
    const out = path.join(dir, "audio.wav");
    await ffmpeg(["-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out]);
    return { role: "audio", path: out, bytes: await sizeOf(out) };
}

/**
 * Whisper is optional equipment: if the binary or model is missing the job
 * still delivers its media outputs, with the gap recorded in the notes.
 * A missing transcript is a smaller loss than a failed job.
 */
async function transcribe(wav, dir, notes) {
    for (const required of [WHISPER, WHISPER_MODEL]) {
        try {
            await access(required, constants.R_OK);
        } catch {
            notes.push(`no transcript — ${required} not installed`);
            return [];
        }
    }

    const stem = path.join(dir, "transcript");
    await run(WHISPER, [
        "-m", WHISPER_MODEL,
        "-f", wav,
        "-l", WHISPER_LANG,
        "-osrt", "-otxt",
        "-of", stem,
    ], { maxBuffer: 32 * 1024 * 1024, timeout: 3 * 60 * 60 * 1000 });

    const made = [];
    for (const [role, file] of [["transcript-srt", `${stem}.srt`], ["transcript-txt", `${stem}.txt`]]) {
        const bytes = await sizeOf(file);
        if (bytes > 0) made.push({ role, path: file, bytes });
    }
    if (made.length === 0) notes.push("whisper produced no transcript files");
    return made;
}

function ffmpeg(args) {
    // -nostdin: a worker under systemd has no terminal to consult.
    return run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...args], {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 3 * 60 * 60 * 1000,
    });
}

/* ── small helpers ──────────────────────────────────────────────────────── */

function jobDir(id) {
    return path.join(READY, id);
}

function jobPath(id) {
    return path.join(jobDir(id), "job.json");
}

async function readJson(file) {
    try {
        return JSON.parse(await readFile(file, "utf8"));
    } catch {
        return null;
    }
}

/** Temp + rename, so a reader never catches a half-written job record. */
async function writeJson(file, value) {
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await rename(tmp, file);
}

async function sizeOf(file) {
    try {
        return (await stat(file)).size;
    } catch {
        return 0;
    }
}

main().catch((err) => {
    log("worker pass failed:", err?.stack ?? err);
    process.exit(1);
});

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config";

/**
 * Il Carico — what the worker has finished.
 *
 * The worker (`tools/worker/carico-worker.mjs`) writes one `job.json` per
 * upload under `ready/<id>/`. This is the read side: the cockpit shows JJ
 * what came back from the material he sent up. Read-only, like the views —
 * nothing in the cockpit drives the worker, and no publish gate is here.
 */

export type JobStatus = "running" | "ready" | "failed";

export interface JobOutput {
    /** roll-a | roll-b | poster | audio | transcript-srt | transcript-txt */
    role: string;
    path: string;
    bytes: number;
}

export interface MediaJob {
    id: string;
    kind: string;
    filename: string;
    storedAs?: string;
    operator?: string;
    note?: string;
    status: JobStatus;
    error?: string;
    probe?: {
        durationSeconds: number;
        bytes: number;
        container: string | null;
        video: { codec: string; width: number; height: number; fps: number | null } | null;
        audio: { codec: string; channels: number; sampleRate: number } | null;
    };
    outputs: JobOutput[];
    notes?: string[];
    startedAt: string;
    finishedAt?: string;
}

function readyDir(): string {
    return path.join(mediaConfig.root, "ready");
}

/** Every job the worker has recorded, newest first. */
export async function listJobs(): Promise<MediaJob[]> {
    let ids: string[];
    try {
        ids = await readdir(readyDir());
    } catch {
        return [];
    }

    const jobs = await Promise.all(
        ids.map(async (id) => {
            try {
                const raw = await readFile(path.join(readyDir(), id, "job.json"), "utf8");
                return JSON.parse(raw) as MediaJob;
            } catch {
                return null;
            }
        })
    );

    return jobs
        .filter((j): j is MediaJob => j !== null && typeof j.id === "string")
        .sort((a, b) => ((a.finishedAt ?? a.startedAt) < (b.finishedAt ?? b.startedAt) ? 1 : -1));
}

/** Jobs keyed by upload id — how the inbox listing gets its status column. */
export async function jobsById(): Promise<Record<string, MediaJob>> {
    const jobs = await listJobs();
    return Object.fromEntries(jobs.map((job) => [job.id, job]));
}

/**
 * The neighbouring house — where ernesto-agents-house lives on disk, and the
 * one-shot ways the cockpit may invoke its pipeline.
 *
 * The cockpit is the only resident process; the house's logic stays in the
 * house (single source of truth, shared with its crons). Two invocation
 * shapes, both non-resident:
 *  - `kickstartJob(label)` — run an existing LaunchAgent NOW (the same job
 *    cron would run later); used for "seal and publish immediately".
 *  - `runHouseScript(rel, args)` — a one-shot `node` child process for CLIs
 *    like website-patch apply.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function ernestoHouseDir(): string {
    if (process.env.ERNESTO_HOUSE_DIR) return process.env.ERNESTO_HOUSE_DIR;
    // The clone moved from ~/Documents to ~/Developer (2026-08-08); accept
    // either so a future move only needs the env var.
    const candidates = [
        join(os.homedir(), "Developer", "GitHub", "ernesto-agents-house"),
        join(os.homedir(), "Documents", "GitHub", "ernesto-agents-house"),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

export function houseAvailable(): boolean {
    return existsSync(ernestoHouseDir());
}

/** LaunchAgent labels the cockpit is allowed to kickstart. Nothing else. */
const KICKABLE_JOBS = new Set([
    "co.uk.ggomed.agents-house.notion-to-sanity-sync",
    "co.uk.ggomed.agents-house.social-approved-publish",
]);

export async function kickstartJob(label: string): Promise<{ ok: boolean; error?: string }> {
    if (!KICKABLE_JOBS.has(label)) return { ok: false, error: `job not kickable: ${label}` };
    try {
        const uid = typeof process.getuid === "function" ? process.getuid() : 501;
        await execFileAsync("launchctl", ["kickstart", `gui/${uid}/${label}`], { timeout: 15_000 });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/** House script allow-list: relative path → permitted. */
const RUNNABLE_SCRIPTS = new Set(["operations/website-patch.js"]);

export async function runHouseScript(
    rel: string,
    args: string[],
    { timeoutMs = 120_000 } = {}
): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
    if (!RUNNABLE_SCRIPTS.has(rel)) {
        return { ok: false, stdout: "", stderr: "", error: `script not runnable: ${rel}` };
    }
    const cwd = ernestoHouseDir();
    const script = join(cwd, rel);
    if (!existsSync(script)) {
        return { ok: false, stdout: "", stderr: "", error: `script not found: ${script}` };
    }
    try {
        const { stdout, stderr } = await execFileAsync("node", [script, ...args], {
            cwd,
            timeout: timeoutMs,
            maxBuffer: 4 * 1024 * 1024,
        });
        return { ok: true, stdout, stderr };
    } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        return {
            ok: false,
            stdout: e.stdout ?? "",
            stderr: e.stderr ?? "",
            error: e.message ?? String(err),
        };
    }
}

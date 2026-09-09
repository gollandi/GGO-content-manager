/** Private, disposable read projections. Never consulted by decision/write paths.
 * One Next server owns refreshes; the VPS timer calls that server over loopback.
 * The process-global registry also deduplicates separate Next route bundles.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

export type SnapshotKey = "cancello" | "house";
export interface SnapshotFreshness { ageSeconds: number; stale: boolean; refreshing: boolean }
type Envelope<T> = { version: 1; source: string; generation: string; at: number; checksum: string; data: T };
type Flight = { generation: string; force: boolean; promise: Promise<unknown> };
type Registry = { flights: Map<string, Flight>; failedAt: Map<string, number> };
const root = globalThis as typeof globalThis & { __ggoCockpitSnapshotsV1?: Registry };
const registry = root.__ggoCockpitSnapshotsV1 ??= { flights: new Map(), failedAt: new Map() };
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60_000;

export function snapshotsEnabled(): boolean { return Boolean(process.env.COCKPIT_SNAPSHOT_DIR); }
function directory(): string {
    const dir = process.env.COCKPIT_SNAPSHOT_DIR;
    if (!dir || !path.isAbsolute(dir)) throw new Error("COCKPIT_SNAPSHOT_DIR must be an absolute private path");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
}
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function source(): string {
    return digest(JSON.stringify({ cwd: process.cwd(), environment: Object.entries(process.env)
        .filter(([key]) => /^(NOTION_|SANITY_|NEXT_PUBLIC_SANITY_|REVIEW_DASHBOARD_|COCKPIT_|ERNESTO_)/.test(key))
        .sort(([a], [b]) => a.localeCompare(b)) }));
}
function atomicWrite(file: string, text: string): void {
    const tmp = `${file}.${randomUUID()}.tmp`;
    try {
        writeFileSync(tmp, text, { mode: 0o600, flag: "wx" });
        renameSync(tmp, file);
    } finally { rmSync(tmp, { force: true }); }
}
function generation(dir: string): string {
    try { return readFileSync(path.join(dir, "generation"), "utf8"); }
    catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return "initial";
        throw err;
    }
}

/** Synchronous fencing: once a mutation returns, old disk/in-flight data is unusable. */
export function invalidateSnapshots(): void {
    if (!snapshotsEnabled()) return;
    const dir = directory();
    atomicWrite(path.join(dir, "generation"), randomUUID());
    for (const key of ["cancello", "house"]) registry.failedAt.delete(path.join(dir, `${key}.json`));
}

export async function snapshot<T extends { generatedAt: string }>(
    key: SnapshotKey,
    fetcher: () => Promise<T>,
    options: { ttlMs: number; revalidate?: boolean; force?: boolean; valid: (value: T) => boolean },
): Promise<T & { readModel: SnapshotFreshness }> {
    const dir = directory();
    const file = path.join(dir, `${key}.json`);
    const revision = generation(dir);
    const identity = source();
    let entry: Envelope<T> | undefined;
    try {
        const candidate = JSON.parse(readFileSync(file, "utf8")) as Envelope<T>;
        const age = Date.now() - candidate.at;
        if (candidate.version === 1 && candidate.source === identity && candidate.generation === revision &&
            Number.isFinite(age) && age >= 0 && age < MAX_AGE_MS &&
            candidate.checksum === digest(JSON.stringify(candidate.data)) &&
            Number.isFinite(Date.parse(candidate.data.generatedAt)) && options.valid(candidate.data)) entry = candidate;
    } catch (err) {
        // Missing/corrupt snapshots are cache misses. Permission/I/O failures must be visible.
        if (!(err instanceof SyntaxError) && !(err instanceof TypeError) &&
            (err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const decorate = (data: T, at: number, refreshing: boolean) => ({
        ...data,
        readModel: { ageSeconds: Math.max(0, Math.floor((Date.now() - at) / 1000)),
            stale: Date.now() - at >= options.ttlMs, refreshing },
    });
    const refresh = (): Promise<T> => {
        const current = registry.flights.get(file);
        if (current?.generation === revision && (!options.force || current.force)) return current.promise as Promise<T>;
        // Finish an invalidated crawl before starting the replacement. This bounds
        // upstream work even when decisions arrive during a long Notion read.
        const promise = (async () => {
            if (current) await current.promise.catch(() => {});
            if (generation(dir) !== revision) throw new Error("Snapshot invalidated; retry the read");
            const data = await fetcher();
            if (!options.valid(data)) throw new Error(`Incomplete ${key} snapshot; keeping the previous complete state`);
            if (generation(dir) !== revision) throw new Error("Snapshot invalidated; retry the read");
            const envelope: Envelope<T> = { version: 1, source: identity, generation: revision,
                at: Date.now(), checksum: digest(JSON.stringify(data)), data };
            // No await between generation check and atomic rename in the single server process.
            atomicWrite(file, JSON.stringify(envelope));
            registry.failedAt.delete(file);
            return data;
        })().catch((err) => {
            registry.failedAt.set(file, Date.now());
            throw err;
        }).finally(() => {
            if (registry.flights.get(file)?.promise === promise) registry.flights.delete(file);
        });
        registry.flights.set(file, { generation: revision, force: Boolean(options.force), promise });
        return promise;
    };
    if (entry && !options.revalidate) {
        const stale = Date.now() - entry.at >= options.ttlMs;
        if (stale && Date.now() - (registry.failedAt.get(file) ?? 0) >= FAILURE_BACKOFF_MS) {
            void refresh().catch(() => console.error(`[snapshot] ${key} refresh failed; retained last complete state`));
        }
        return decorate(entry.data, entry.at, registry.flights.has(file));
    }
    const data = await refresh();
    return decorate(data, Date.now(), false);
}

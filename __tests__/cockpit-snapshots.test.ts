// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { snapshot, invalidateSnapshots } from "../lib/cockpit/snapshots";
import { cached, invalidateCache, withFreshReads } from "../lib/cache";

let dir: string;
const value = (count: number) => ({ generatedAt: new Date().toISOString(), count });
const options = { ttlMs: 100, valid: (v: ReturnType<typeof value>) => Number.isInteger(v.count) && v.count >= 0 };
function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-snapshot-test-"));
    vi.stubEnv("COCKPIT_SNAPSHOT_DIR", dir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });

describe("private persistent cockpit projections", () => {
    it("restores a snapshot in a fresh module without any upstream read; file is private", async () => {
        await snapshot("house", async () => value(7), options);
        expect(statSync(path.join(dir, "house.json")).mode & 0o777).toBe(0o600);
        vi.resetModules();
        const restarted = await import("../lib/cockpit/snapshots");
        const source = vi.fn(async () => value(9));
        expect((await restarted.snapshot("house", source, options)).count).toBe(7);
        expect(source).not.toHaveBeenCalled();
    });
    it("serves all stale visitors while one refresh is pending, including another route bundle", async () => {
        await snapshot("house", async () => value(7), options);
        vi.advanceTimersByTime(101);
        const pending = deferred<ReturnType<typeof value>>();
        const source = vi.fn(() => pending.promise);
        vi.resetModules();
        const otherBundle = await import("../lib/cockpit/snapshots");
        const results = await Promise.all([snapshot("house", source, options), otherBundle.snapshot("house", source, options)]);
        expect(results.map((r) => r.count)).toEqual([7, 7]);
        expect(results[0].readModel).toMatchObject({ stale: true, refreshing: true });
        expect(source).toHaveBeenCalledOnce();
        pending.resolve(value(8));
        await snapshot("house", source, { ...options, revalidate: true });
    });
    it("never replaces a complete snapshot with incomplete data and backs off failing refreshes", async () => {
        await snapshot("house", async () => value(7), options);
        vi.advanceTimersByTime(101);
        const source = vi.fn(async () => value(-1));
        await expect(snapshot("house", source, { ...options, revalidate: true })).rejects.toThrow("Incomplete");
        const result = await snapshot("house", source, options);
        expect(result.count).toBe(7);
        expect(result.readModel).toMatchObject({ stale: true, refreshing: false });
        expect(source).toHaveBeenCalledOnce();
    });
    it("fences disk and running reads after a decision; an old crawl cannot resurrect data", async () => {
        await snapshot("house", async () => value(7), options);
        const pending = deferred<ReturnType<typeof value>>();
        const old = snapshot("house", () => pending.promise, { ...options, revalidate: true });
        const rejected = expect(old).rejects.toThrow("invalidated");
        invalidateSnapshots();
        const newer = snapshot("house", async () => value(10), options);
        pending.resolve(value(8));
        await rejected;
        expect((await newer).count).toBe(10);
        expect((await snapshot("house", async () => value(99), options)).count).toBe(10);
    });
    it("an explicit full refresh waits for its own fresh crawl, while duplicate full refreshes share it", async () => {
        const pending = deferred<ReturnType<typeof value>>();
        const ordinary = snapshot("cancello", () => pending.promise, { ...options, revalidate: true });
        const source = vi.fn(async () => value(9));
        const full = snapshot("cancello", source, { ...options, revalidate: true, force: true });
        const duplicate = snapshot("cancello", source, { ...options, revalidate: true, force: true });
        expect(source).not.toHaveBeenCalled();
        pending.resolve(value(8));
        expect((await ordinary).count).toBe(8);
        expect((await full).count).toBe(9);
        expect((await duplicate).count).toBe(9);
        expect(source).toHaveBeenCalledOnce();
    });
    it("a source mutation invalidates both projections, including on the next module load", async () => {
        await snapshot("house", async () => value(7), options);
        await snapshot("cancello", async () => value(7), options);
        invalidateCache("editorial:content-needs");
        vi.resetModules();
        const next = await import("../lib/cockpit/snapshots");
        expect((await next.snapshot("house", async () => value(9), options)).count).toBe(9);
        expect((await next.snapshot("cancello", async () => value(9), options)).count).toBe(9);
    });
    it("refuses incompatible workspace data, corruption and snapshots older than 24 hours", async () => {
        await snapshot("house", async () => value(7), options);
        vi.stubEnv("NOTION_API_KEY", "different-fixture-workspace");
        expect((await snapshot("house", async () => value(8), options)).count).toBe(8);
        const file = path.join(dir, "house.json");
        const corrupt = JSON.parse(readFileSync(file, "utf8"));
        corrupt.data.count = 999;
        writeFileSync(file, JSON.stringify(corrupt));
        expect((await snapshot("house", async () => value(9), options)).count).toBe(9);
        vi.advanceTimersByTime(24 * 60 * 60_000 + 1);
        expect((await snapshot("house", async () => value(10), options)).count).toBe(10);
    });
    it("does not reuse data from a future clock or incompatible schema", async () => {
        await snapshot("house", async () => value(7), options);
        vi.setSystemTime(new Date("2026-09-08T10:00:00Z"));
        expect((await snapshot("house", async () => value(8), options)).count).toBe(8);
        const file = path.join(dir, "house.json");
        const old = JSON.parse(readFileSync(file, "utf8")); old.version = 0;
        writeFileSync(file, JSON.stringify(old));
        expect((await snapshot("house", async () => value(9), options)).count).toBe(9);
    });
    it("rejects a relative persistence path", async () => {
        vi.stubEnv("COCKPIT_SNAPSHOT_DIR", "public/snapshots");
        await expect(snapshot("house", async () => value(7), options)).rejects.toThrow("absolute private path");
    });
    it("background preparation awaits real source data instead of persisting old SWR values", async () => {
        invalidateCache();
        await cached("source", async () => "old", 100);
        const pending = deferred<string>();
        const fresh = withFreshReads(() => cached("source", () => pending.promise, 100));
        expect(await cached("source", async () => "wrong", 100)).toBe("old");
        pending.resolve("new");
        expect(await fresh).toBe("new");
        expect(await cached("source", async () => "wrong", 100)).toBe("new");
    });
});

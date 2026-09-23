import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cached, invalidateCache, getCacheStats } from "../lib/cache";

beforeEach(() => {
  invalidateCache(); // clear between tests
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("cached", () => {
  it("serves every stale reader immediately while one refresh is pending", async () => {
    vi.useFakeTimers();
    await cached("shared", async () => "old", 100);
    vi.advanceTimersByTime(101);
    const next = deferred<string>();
    const fetcher = vi.fn(() => next.promise);
    const results: string[] = [];
    const readers = Array.from({ length: 8 }, () => cached("shared", fetcher, 100).then((value) => results.push(value)));
    await Promise.resolve();
    await Promise.resolve();
    expect(results).toEqual(Array(8).fill("old"));
    expect(fetcher).toHaveBeenCalledOnce();
    next.resolve("new");
    await Promise.all(readers);
  });

  it("shares a cold request and releases the slot after a failure", async () => {
    const next = deferred<string>();
    const fetcher = vi.fn(() => next.promise);
    const readers = [cached("cold", fetcher), cached("cold", fetcher)];
    const settled = Promise.allSettled(readers);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
    next.reject(new Error("upstream unavailable"));
    expect((await settled).every((result) => result.status === "rejected")).toBe(true);
    expect(await cached("cold", async () => "recovered")).toBe("recovered");
  });

  it("does not resurrect invalidated data or release a newer request's slot", async () => {
    const old = deferred<string>();
    const fresh = deferred<string>();
    const oldRead = cached("decision", () => old.promise);
    await Promise.resolve();
    invalidateCache("decision");
    const freshFetcher = vi.fn(() => fresh.promise);
    const freshRead = cached("decision", freshFetcher);
    await Promise.resolve();
    old.resolve("obsolete");
    await oldRead;
    expect(getCacheStats()).toEqual([]);
    const joiner = cached("decision", freshFetcher);
    fresh.resolve("current");
    expect(await Promise.all([freshRead, joiner])).toEqual(["current", "current"]);
    expect(freshFetcher).toHaveBeenCalledOnce();
    expect(await cached("decision", async () => "wrong")).toBe("current");
  });

  it("retains stale data on background failure and retries only once for later readers", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await cached("retry", async () => "old", 100);
    vi.advanceTimersByTime(101);
    const failed = vi.fn().mockRejectedValue(new Error("offline"));
    await cached("retry", failed, 100);
    await vi.advanceTimersByTimeAsync(0);
    expect(console.error).toHaveBeenCalledOnce();
    const next = deferred<string>();
    const fetcher = vi.fn(() => next.promise);
    expect(await cached("retry", fetcher, 100)).toBe("old");
    expect(await cached("retry", fetcher, 100)).toBe("old");
    expect(fetcher).toHaveBeenCalledOnce();
    next.resolve("new");
    await vi.advanceTimersByTimeAsync(0);
  });

  it("blocks on a single fresh read beyond the existing stale window", async () => {
    vi.useFakeTimers();
    await cached("expired", async () => "old", 100);
    vi.advanceTimersByTime(24 * 60 * 60_000);
    const next = deferred<string>();
    const fetcher = vi.fn(() => next.promise);
    let resolved = false;
    const read = cached("expired", fetcher, 100).then((value) => { resolved = true; return value; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    next.resolve("new");
    expect(await read).toBe("new");
  });
  it("calls the fetcher on first request", async () => {
    const fetcher = vi.fn().mockResolvedValue("data-1");
    const result = await cached("key-1", fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toBe("data-1");
  });

  it("returns cached value on second call within TTL", async () => {
    const fetcher = vi.fn().mockResolvedValue("data-1");

    await cached("key-2", fetcher, 60_000);
    const result = await cached("key-2", fetcher, 60_000);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toBe("data-1");
  });

  it("re-fetches after TTL expires", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");

    await cached("key-3", fetcher, 1); // 1ms TTL

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 10));

    // Beyond stale window? No — default stale is 24h.
    // This should return stale "old" and trigger background refresh.
    const result = await cached("key-3", fetcher, 1);

    // Stale-while-revalidate: returns old data immediately
    expect(result).toBe("old");
    // But a background refresh was triggered
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fetches synchronously when no cache entry exists", async () => {
    const fetcher = vi.fn().mockResolvedValue(42);
    const result = await cached("key-4", fetcher);

    expect(result).toBe(42);
  });
});

describe("invalidateCache", () => {
  it("removes a specific key", async () => {
    const fetcher = vi.fn().mockResolvedValue("v1");
    await cached("k1", fetcher);
    await cached("k2", fetcher);

    invalidateCache("k1");

    const stats = getCacheStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].key).toBe("k2");
  });

  it("clears all entries when called without key", async () => {
    const fetcher = vi.fn().mockResolvedValue("v1");
    await cached("a", fetcher);
    await cached("b", fetcher);

    invalidateCache();

    expect(getCacheStats()).toHaveLength(0);
  });
});

describe("getCacheStats", () => {
  it("uses each entry's configured TTL", async () => {
    vi.useFakeTimers();
    await cached("short", async () => 1, 100);
    await cached("long", async () => 2, 1000);
    vi.advanceTimersByTime(100);
    expect(getCacheStats().map(({ key, stale }) => ({ key, stale }))).toEqual([
      { key: "short", stale: true }, { key: "long", stale: false },
    ]);
  });
  it("returns age and stale status", async () => {
    const fetcher = vi.fn().mockResolvedValue("data");
    await cached("stats-key", fetcher);

    const stats = getCacheStats();

    expect(stats).toHaveLength(1);
    expect(stats[0].key).toBe("stats-key");
    expect(stats[0].ageSeconds).toBeGreaterThanOrEqual(0);
    expect(stats[0].stale).toBe(false);
  });
});

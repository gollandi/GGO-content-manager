import { describe, it, expect, beforeEach, vi } from "vitest";
import { cached, invalidateCache, getCacheStats } from "../lib/cache";

beforeEach(() => {
  invalidateCache(); // clear between tests
});

describe("cached", () => {
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

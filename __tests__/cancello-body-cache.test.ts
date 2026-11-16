// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBodyCache } from "../lib/cancello/body-cache";

const REVISION = "2026-09-08T10:00:00.000Z";
afterEach(() => vi.useRealTimers());

describe("versioned Desk body reads", () => {
  it("reuses unchanged bodies but immediately reads a changed page revision", async () => {
    const cache = createBodyCache();
    const fetcher = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("edited");
    expect(await cache.reader()("page", REVISION, fetcher)).toBe("old");
    expect(await cache.reader()("page", REVISION, fetcher)).toBe("old");
    expect(await cache.reader()("page", "2026-09-08T10:01:00.000Z", fetcher)).toBe("edited");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("bypasses bodies for an explicit refresh and after the age limit", async () => {
    vi.useFakeTimers();
    const cache = createBodyCache({ ttlMs: 100 });
    const fetcher = vi.fn().mockResolvedValueOnce("one").mockResolvedValueOnce("two").mockResolvedValueOnce("three");
    await cache.reader()("page", REVISION, fetcher);
    expect(await cache.reader(true)("page", REVISION, fetcher)).toBe("two");
    vi.advanceTimersByTime(100);
    expect(await cache.reader()("page", REVISION, fetcher)).toBe("three");
  });

  it("never caches a body whose revision is under two minutes old", async () => {
    // Notion rounds last_edited_time to the minute: an append later in the
    // same minute keeps the same revision, so a young body may be partial.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T10:01:30.000Z"));
    const cache = createBodyCache();
    const fetcher = vi.fn().mockResolvedValueOnce("partial").mockResolvedValueOnce("whole").mockResolvedValue("later");
    const young = "2026-11-16T10:01:00.000Z";
    expect(await cache.reader()("page", young, fetcher)).toBe("partial");
    expect(await cache.reader()("page", young, fetcher)).toBe("whole");
    vi.setSystemTime(new Date("2026-11-16T10:03:01.000Z"));
    expect(await cache.reader()("page", young, fetcher)).toBe("later");
    expect(await cache.reader()("page", young, fetcher)).toBe("later");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("never caches a failure or an unknown page revision", async () => {
    const cache = createBodyCache();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("body");
    await expect(cache.reader()("page", REVISION, fetcher)).rejects.toThrow("offline");
    expect(await cache.reader()("page", REVISION, fetcher)).toBe("body");
    await cache.reader()("unknown", "", fetcher);
    await cache.reader()("unknown", "", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("cannot refill the cache from a crawl created before invalidation", async () => {
    const cache = createBodyCache();
    const oldReader = cache.reader();
    cache.clear();
    await oldReader("page", REVISION, async () => "obsolete");
    expect(await cache.reader()("page", REVISION, async () => "current")).toBe("current");
  });

  it("cannot refill from a body request already in flight at invalidation", async () => {
    const cache = createBodyCache();
    let resolve!: (value: string) => void;
    const read = cache.reader()("page", REVISION, () => new Promise<string>((yes) => { resolve = yes; }));
    cache.clear();
    resolve("obsolete");
    await read;
    expect(await cache.reader()("page", REVISION, async () => "current")).toBe("current");
  });

  it("evicts least recently used bodies and skips oversized entries", async () => {
    const cache = createBodyCache({ maxEntries: 2 });
    const fetcher = vi.fn().mockResolvedValue("body");
    const read = cache.reader();
    await read("a", REVISION, fetcher);
    await read("b", REVISION, fetcher);
    await read("a", REVISION, fetcher);
    await read("c", REVISION, fetcher);
    await read("b", REVISION, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(4);
    const large = vi.fn().mockResolvedValue("x".repeat(20_001));
    await read("large", REVISION, large);
    await read("large", REVISION, large);
    expect(large).toHaveBeenCalledTimes(2);
  });
});

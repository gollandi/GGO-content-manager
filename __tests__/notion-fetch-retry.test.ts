import { afterEach, describe, it, expect, vi } from "vitest";
import { withNotionRetry } from "../lib/notion/fetch-retry";

type FakeResponse = { status: number; headers: { get(name: string): string | null } };

const res = (status: number, retryAfter?: string): FakeResponse => ({
  status,
  headers: { get: (name) => (name === "retry-after" && retryAfter ? retryAfter : null) },
});

// Keep waits at ~1ms so the suite stays fast.
const fastOpts = { baseDelayMs: 1, maxDelayMs: 2, minIntervalMs: 0 };
afterEach(() => vi.useRealTimers());

describe("withNotionRetry", () => {
  it("passes a success through untouched, one call only", async () => {
    const base = vi.fn().mockResolvedValue(res(200));
    const fetcher = withNotionRetry(base, fastOpts);
    const out = await fetcher("https://api.notion.com/v1/x");
    expect(out.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-429 errors (a retried 5xx write could execute twice)", async () => {
    const base = vi.fn().mockResolvedValue(res(502));
    const fetcher = withNotionRetry(base, fastOpts);
    const out = await fetcher("https://api.notion.com/v1/x");
    expect(out.status).toBe(502);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and returns the eventual success", async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200));
    const fetcher = withNotionRetry(base, fastOpts);
    const out = await fetcher("https://api.notion.com/v1/x");
    expect(out.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("honours Retry-After even when it exceeds the fallback cap", async () => {
    vi.useFakeTimers();
    const base = vi.fn().mockResolvedValueOnce(res(429, "12")).mockResolvedValueOnce(res(200));
    const fetcher = withNotionRetry(base, fastOpts);
    const read = fetcher("https://api.notion.com/v1/x");
    await vi.advanceTimersByTimeAsync(11_999);
    expect(base).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect((await read).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("paces concurrent requests instead of sending a burst", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const base = vi.fn(async () => { starts.push(Date.now()); return res(200); });
    const fetcher = withNotionRetry(base);
    const reads = Array.from({ length: 6 }, (_, i) => fetcher(String(i)));
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all(reads);
    expect(starts.map((at) => at - starts[0])).toEqual([0, 400, 800, 1200, 1600, 2000]);
  });

  it("pauses other callers even when the throttled request exhausts its retries", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const base = vi.fn(async () => { starts.push(Date.now()); return starts.length === 1 ? res(429, "10") : res(200); });
    const fetcher = withNotionRetry(base, { maxRetries: 0 });
    const reads = [fetcher("first"), fetcher("second"), fetcher("third")];
    await vi.advanceTimersByTimeAsync(9999);
    expect(base).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(401);
    expect((await Promise.all(reads)).map((r) => r.status)).toEqual([429, 200, 200]);
    expect(starts.map((at) => at - starts[0])).toEqual([0, 10_000, 10_400]);
  });

  it("handles an explicit overload response with the same cooldown", async () => {
    vi.useFakeTimers();
    const base = vi.fn().mockResolvedValueOnce(res(529, "1")).mockResolvedValueOnce(res(200));
    const read = withNotionRetry(base, fastOpts)("overloaded");
    await vi.advanceTimersByTimeAsync(999);
    expect(base).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect((await read).status).toBe(200);
  });

  it("does not dispatch a queued write after its deadline", async () => {
    vi.useFakeTimers();
    const base = vi.fn().mockResolvedValue(res(429, "120"));
    const fetcher = withNotionRetry(base, { ...fastOpts, maxDurationMs: 1000 });
    const first = fetcher("first").catch((error: Error) => error.name);
    await vi.advanceTimersByTimeAsync(0);
    const queued = fetcher("queued-write").catch((error: Error) => error.name);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await Promise.all([first, queued])).toEqual(["TimeoutError", "TimeoutError"]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(base).toHaveBeenCalledOnce();
  });

  it("removes cancelled semaphore waiters without consuming a slot", async () => {
    let release!: (response: FakeResponse) => void;
    const base = vi.fn().mockImplementationOnce(() => new Promise<FakeResponse>((resolve) => { release = resolve; })).mockResolvedValue(res(200));
    const fetcher = withNotionRetry<RequestInit, FakeResponse>(base, { ...fastOpts, maxConcurrent: 1 });
    const first = fetcher("first");
    await vi.waitFor(() => expect(base).toHaveBeenCalledOnce());
    const controller = new AbortController();
    const cancelled = fetcher("cancelled", { signal: controller.signal }).catch((error: Error) => error.name);
    controller.abort();
    expect(await cancelled).toBe("AbortError");
    release(res(200));
    await first;
    expect((await fetcher("next")).status).toBe(200);
    expect(base.mock.calls.map(([url]) => url)).toEqual(["first", "next"]);
  });

  it("passes cancellation to an in-flight request without retrying an ambiguous effect", async () => {
    vi.useFakeTimers();
    const base = vi.fn((_url: string, init?: RequestInit) => new Promise<FakeResponse>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const read = withNotionRetry(base, { ...fastOpts, maxDurationMs: 1000 })("write", { method: "POST", body: "fixture" }).catch((error: Error) => error.name);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await read).toBe("TimeoutError");
    expect(base).toHaveBeenCalledOnce();
    expect(base.mock.calls[0][1]).toMatchObject({ method: "POST", body: "fixture" });
  });

  it("gives up after maxRetries and returns the last 429", async () => {
    const base = vi.fn().mockResolvedValue(res(429));
    const fetcher = withNotionRetry(base, { ...fastOpts, maxRetries: 3 });
    const out = await fetcher("https://api.notion.com/v1/x");
    expect(out.status).toBe(429);
    expect(base).toHaveBeenCalledTimes(4); // first attempt + 3 retries
  });

  it("gates concurrency: never more than maxConcurrent requests in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const base = vi.fn().mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return res(200);
    });
    const fetcher = withNotionRetry(base, { ...fastOpts, maxConcurrent: 2 });
    await Promise.all(Array.from({ length: 8 }, (_, i) => fetcher(`https://api.notion.com/v1/${i}`)));
    expect(peak).toBe(2);
    expect(base).toHaveBeenCalledTimes(8);
  });
});

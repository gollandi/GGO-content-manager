import { describe, it, expect, vi } from "vitest";
import { withNotionRetry } from "../lib/notion/fetch-retry";

type FakeResponse = { status: number; headers: { get(name: string): string | null } };

const res = (status: number, retryAfter?: string): FakeResponse => ({
  status,
  headers: { get: (name) => (name === "retry-after" && retryAfter ? retryAfter : null) },
});

// Keep waits at ~1ms so the suite stays fast.
const fastOpts = { baseDelayMs: 1, maxDelayMs: 2 };

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

  it("caps a Retry-After header at maxDelayMs", async () => {
    // Header asks for 120s; maxDelayMs 2ms means the test finishing at all proves the cap.
    const base = vi.fn().mockResolvedValueOnce(res(429, "120")).mockResolvedValueOnce(res(200));
    const fetcher = withNotionRetry(base, fastOpts);
    const out = await fetcher("https://api.notion.com/v1/x");
    expect(out.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
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

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

let dir: string;
let guard: typeof import("../lib/llm/guard");
const body = (model = "claude-sonnet-5", extra: Record<string, unknown> = {}) =>
    JSON.stringify({ model, max_tokens: 100, messages: [{ role: "user", content: "ciao" }], ...extra });
const okJson = (stop = "end_turn", usage = { input_tokens: 1000, output_tokens: 100 }) => () =>
    Promise.resolve(new Response(JSON.stringify({ stop_reason: stop, usage, content: [] }), { status: 200, headers: { "content-type": "application/json" } }));
const post = (b: string) => ["https://api.anthropic.com/v1/messages", { method: "POST", body: b }] as const;
const settle = () => new Promise((r) => setTimeout(r, 5));

beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-llm-guard-"));
    vi.stubEnv("COCKPIT_LLM_GUARD_DIR", dir);
    vi.resetModules(); delete (globalThis as Record<string, unknown>).__ggoLlmGuard;
    guard = await import("../lib/llm/guard");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe("il Guardiano — every model call passes through one ledger", () => {
    it("records usage and estimated cost of a plain call, persisted to disk", async () => {
        const inner = vi.fn(okJson());
        const f = guard.guardedFetch("test-room", inner as unknown as typeof fetch);
        const res = await f(...post(body()));
        expect(res.status).toBe(200); await settle();
        const s = guard.summary();
        expect(s.today.calls).toBe(1);
        expect(s.today.byOrigin["test-room"].inputTokens).toBe(1000);
        expect(s.today.usd).toBeCloseTo((1000 * 3 + 100 * 15) / 1e6, 6);
        expect(readFileSync(path.join(dir, "ledger.ndjson"), "utf8").split("\n").filter(Boolean)).toHaveLength(1);
    });
    it("leaves non-message traffic alone", async () => {
        const inner = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
        const f = guard.guardedFetch("test-room", inner as unknown as typeof fetch);
        await f("https://api.anthropic.com/v1/models", { method: "GET" });
        expect(guard.summary().today.calls).toBe(0);
    });
    it("accounts for a streamed call from its SSE frames without disturbing the caller's stream", async () => {
        const frames = [
            `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 500, cache_read_input_tokens: 200 } } })}\n\n`,
            `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "ok" } })}\n\n`,
            `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "max_tokens" }, usage: { output_tokens: 100 } })}\n\n`,
        ];
        const stream = new ReadableStream<Uint8Array>({ start(c) { for (const fr of frames) c.enqueue(new TextEncoder().encode(fr)); c.close(); } });
        const inner = vi.fn(() => Promise.resolve(new Response(stream, { status: 200 })));
        const f = guard.guardedFetch("runner", inner as unknown as typeof fetch);
        const res = await f(...post(body("claude-opus-4-8", { stream: true })));
        expect(await res.text()).toBe(frames.join("")); await settle();
        const e = guard.summary().recent[0];
        expect(e).toMatchObject({ origin: "runner", outcome: "max_tokens", inputTokens: 500, outputTokens: 100, cacheReadTokens: 200 });
    });
    it("blocks an identical request body once it has been repeated the allowed number of times", async () => {
        const inner = vi.fn(okJson());
        const f = guard.guardedFetch("briefing", inner as unknown as typeof fetch);
        for (let i = 0; i < 3; i += 1) { await f(...post(body())); await settle(); }
        expect((await f(...post(body()))).headers.get("x-llm-guard")).toBe("repeat");
        expect(inner).toHaveBeenCalledTimes(3);
        const s = guard.summary();
        expect(s.blocked).toHaveLength(1);
        expect(s.flags[0].code).toBe("repeat");
        // A different body is still admitted; the block survives a fresh module.
        await f(...post(body("claude-sonnet-5", { max_tokens: 101 })));
        vi.resetModules(); delete (globalThis as Record<string, unknown>).__ggoLlmGuard;
        const again = await import("../lib/llm/guard");
        expect((await again.guardedFetch("briefing", inner as unknown as typeof fetch)(...post(body()))).headers.get("x-llm-guard")).toBe("blocked");
        again.lift({ all: true });
        expect(again.summary().blocked).toHaveLength(0);
    });
    it("blocks a truncated answer one repeat earlier: paying twice for the same broken output is enough", async () => {
        const inner = vi.fn(okJson("max_tokens"));
        const f = guard.guardedFetch("briefing", inner as unknown as typeof fetch);
        for (let i = 0; i < 2; i += 1) { await f(...post(body())); await settle(); }
        expect((await f(...post(body()))).headers.get("x-llm-guard")).toBe("repeat");
    });
    it("pauses an origin that bursts, and stops everything at the daily budget", async () => {
        vi.stubEnv("COCKPIT_LLM_BURST_CALLS", "3");
        const inner = vi.fn(okJson());
        const f = guard.guardedFetch("citofono-edmondo", inner as unknown as typeof fetch);
        for (let i = 0; i < 3; i += 1) { await f(...post(body("claude-sonnet-5", { seq: i }))); await settle(); }
        expect((await f(...post(body("claude-sonnet-5", { seq: 9 })))).headers.get("x-llm-guard")).toBe("burst");
        expect(guard.summary().tripped[0].origin).toBe("citofono-edmondo");
        vi.stubEnv("COCKPIT_LLM_DAILY_USD", "0.001");
        expect((await guard.guardedFetch("runner", inner as unknown as typeof fetch)(...post(body()))).headers.get("x-llm-guard")).toBe("daily_budget");
    });
    it("honours the kill switch", async () => {
        vi.stubEnv("COCKPIT_LLM_KILL_SWITCH", "1");
        const inner = vi.fn(okJson());
        expect((await guard.guardedFetch("runner", inner as unknown as typeof fetch)(...post(body()))).headers.get("x-llm-guard")).toBe("kill_switch");
        expect(inner).not.toHaveBeenCalled();
    });
    it("builds a real SDK client whose calls are guarded", async () => {
        vi.stubEnv("COCKPIT_LLM_KILL_SWITCH", "1");
        const client = guard.guardedAnthropic("runner", { apiKey: "fixture" });
        const failure = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 5, messages: [{ role: "user", content: "x" }] }).catch((e: unknown) => e);
        expect(guard.isGuardRefusal(failure)).toBe(true);
        expect((failure as { status: number }).status).toBe(403);
        expect(String((failure as Error).message)).toMatch(/switched off/);
    });
});

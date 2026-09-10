/**
 * Il Guardiano — the ONE choke point for every Anthropic call the cockpit makes.
 *
 * Every client is built through `guardedAnthropic(origin)`, which installs a
 * `fetch` wrapper on the SDK. Before a request leaves the process the wrapper
 * checks a persisted ledger against four policies; after the response it
 * records what the call cost. A refused call throws `LlmGuardError` and the
 * caller's ordinary error path applies (the factual fallback for briefs, an
 * error event for a run). Nothing here writes to Notion or Sanity.
 *
 * Policies (all env-tunable, defaults in `policy()`):
 *   kill switch   COCKPIT_LLM_KILL_SWITCH=1        refuse everything
 *   daily budget  COCKPIT_LLM_DAILY_USD            estimated USD per UTC day, all origins
 *   burst         COCKPIT_LLM_BURST_CALLS          calls per origin in 10 minutes, then the origin trips for an hour
 *   repeat        COCKPIT_LLM_REPEAT_LIMIT         identical request bodies in 24 h, then that body is blocked
 *                                                  (a body whose last answer was truncated or failed blocks one repeat earlier)
 *
 * Every refusal is recorded as a flag; `/api/llm/guard` shows the flags, the
 * day's spend and what is blocked. Blocks lift only through that route.
 */
import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export type GuardCode = "kill_switch" | "daily_budget" | "burst" | "repeat" | "blocked";

export const GUARD_ERROR_TYPE = "llm_guard";
/** True when an SDK error is the guard's own refusal (a 403 it produced), not the API's. */
export function isGuardRefusal(error: unknown): error is { status: 403; error: { error: { type: string; code: GuardCode; message: string } } } {
    const e = error as { status?: unknown; error?: { error?: { type?: unknown } } } | null;
    return !!e && e.status === 403 && e.error?.error?.type === GUARD_ERROR_TYPE;
}
export class LlmGuardError extends Error {
    constructor(public readonly code: GuardCode, message: string) { super(message); this.name = "LlmGuardError"; }
}

export interface LedgerEntry {
    at: string; origin: string; model: string; fp: string;
    outcome: "end_turn" | "max_tokens" | "other" | "error";
    inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number;
    usd: number;
}
export interface GuardFlag { at: string; code: GuardCode; origin: string; detail: string; fp?: string }
interface GuardState {
    version: 1;
    blocked: Record<string, { at: string; origin: string; reason: string }>;
    tripped: Record<string, { until: string; reason: string }>;
    flags: GuardFlag[];
}

const DAY_MS = 86_400_000;
const WINDOW_MS = 2 * DAY_MS;
const MAX_FLAGS = 200;

/** USD per million tokens: [input, output]. Cache read 0.1×in, cache write 2×in (1h). */
const RATES: Record<string, [number, number]> = {
    "claude-opus-4-8": [5, 25], "claude-sonnet-5": [3, 15], "claude-haiku-4-5": [1, 5], "claude-fable-5-1": [10, 50],
};
const UNKNOWN_RATE: [number, number] = [10, 50]; // price an unknown model as if expensive: the budget errs on the side of stopping

export function policy() {
    const num = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v >= 0 ? v : fallback; };
    return {
        killSwitch: process.env.COCKPIT_LLM_KILL_SWITCH === "1",
        dailyUsd: num("COCKPIT_LLM_DAILY_USD", 8),
        burstCalls: num("COCKPIT_LLM_BURST_CALLS", 20),
        burstWindowMs: 10 * 60_000,
        tripMs: 60 * 60_000,
        repeatLimit: Math.max(2, num("COCKPIT_LLM_REPEAT_LIMIT", 3)),
    };
}

export function estimateUsd(model: string, u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
    const [inRate, outRate] = RATES[model] ?? UNKNOWN_RATE;
    return (u.inputTokens * inRate + u.outputTokens * outRate + u.cacheReadTokens * inRate * 0.1 + u.cacheWriteTokens * inRate * 2) / 1_000_000;
}

function dir(): string {
    if (process.env.COCKPIT_LLM_GUARD_DIR) return process.env.COCKPIT_LLM_GUARD_DIR;
    if (process.env.COCKPIT_SNAPSHOT_DIR) return path.join(process.env.COCKPIT_SNAPSHOT_DIR, "llm-guard");
    return path.join(process.cwd(), ".runs", "llm-guard");
}
const ledgerPath = () => path.join(dir(), "ledger.ndjson");
const statePath = () => path.join(dir(), "state.json");

const globals = globalThis as typeof globalThis & { __ggoLlmGuard?: { entries: LedgerEntry[]; state: GuardState; loaded: string | null } };
const mem = globals.__ggoLlmGuard ??= { entries: [], state: { version: 1, blocked: {}, tripped: {}, flags: [] }, loaded: null };

function load(): void {
    const d = dir();
    if (mem.loaded === d) return;
    mem.loaded = d; mem.entries = []; mem.state = { version: 1, blocked: {}, tripped: {}, flags: [] };
    try {
        if (existsSync(statePath())) {
            const s = JSON.parse(readFileSync(statePath(), "utf8"));
            if (s?.version === 1) mem.state = { version: 1, blocked: s.blocked ?? {}, tripped: s.tripped ?? {}, flags: Array.isArray(s.flags) ? s.flags : [] };
        }
        if (existsSync(ledgerPath())) {
            const cutoff = Date.now() - WINDOW_MS;
            for (const line of readFileSync(ledgerPath(), "utf8").split("\n")) {
                if (!line) continue;
                try { const e = JSON.parse(line) as LedgerEntry; if (Date.parse(e.at) >= cutoff) mem.entries.push(e); } catch { /* skip a torn line */ }
            }
        }
    } catch (error) { console.warn("[llm-guard] ledger unreadable, starting empty:", (error as Error).message); }
}
function persistState(): void {
    try {
        mkdirSync(dir(), { recursive: true, mode: 0o700 });
        const tmp = `${statePath()}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(mem.state), { mode: 0o600 });
        renameSync(tmp, statePath());
    } catch (error) { console.warn("[llm-guard] state not persisted:", (error as Error).message); }
}
function append(entry: LedgerEntry): void {
    mem.entries.push(entry);
    const cutoff = Date.now() - WINDOW_MS;
    if (mem.entries.length > 5000) mem.entries = mem.entries.filter((e) => Date.parse(e.at) >= cutoff);
    try {
        mkdirSync(dir(), { recursive: true, mode: 0o700 });
        appendFileSync(ledgerPath(), JSON.stringify(entry) + "\n", { mode: 0o600 });
    } catch (error) { console.warn("[llm-guard] ledger not persisted:", (error as Error).message); }
}
function flag(f: Omit<GuardFlag, "at">): void {
    mem.state.flags.push({ at: new Date().toISOString(), ...f });
    if (mem.state.flags.length > MAX_FLAGS) mem.state.flags.splice(0, mem.state.flags.length - MAX_FLAGS);
    console.warn(`[llm-guard] ${f.code} (${f.origin}): ${f.detail}`);
    persistState();
}

export function fingerprint(origin: string, body: unknown): string {
    return createHash("sha256").update(JSON.stringify([origin, body])).digest("hex");
}

const startOfUtcDay = (now: number) => now - (now % DAY_MS);

/** Refuse or admit one request. Exported for tests and for callers that must check before an expensive stream. */
export function admit(origin: string, fp: string, now = Date.now()): void {
    load();
    const p = policy();
    if (p.killSwitch) { flag({ code: "kill_switch", origin, detail: "COCKPIT_LLM_KILL_SWITCH is on", fp }); throw new LlmGuardError("kill_switch", "LLM calls are switched off (COCKPIT_LLM_KILL_SWITCH)."); }
    if (mem.state.blocked[fp]) throw new LlmGuardError("blocked", `This exact request is blocked: ${mem.state.blocked[fp].reason}`);
    const trip = mem.state.tripped[origin];
    if (trip && Date.parse(trip.until) > now) throw new LlmGuardError("burst", `${origin} is paused until ${trip.until}: ${trip.reason}`);

    const spentToday = mem.entries.filter((e) => Date.parse(e.at) >= startOfUtcDay(now)).reduce((s, e) => s + e.usd, 0);
    if (spentToday >= p.dailyUsd) {
        flag({ code: "daily_budget", origin, detail: `estimated $${spentToday.toFixed(2)} today ≥ budget $${p.dailyUsd}`, fp });
        throw new LlmGuardError("daily_budget", `Daily LLM budget reached ($${spentToday.toFixed(2)} of $${p.dailyUsd}).`);
    }
    const recent = mem.entries.filter((e) => e.origin === origin && Date.parse(e.at) >= now - p.burstWindowMs).length;
    if (recent >= p.burstCalls) {
        const until = new Date(now + p.tripMs).toISOString();
        mem.state.tripped[origin] = { until, reason: `${recent} calls in ${p.burstWindowMs / 60_000} minutes` };
        flag({ code: "burst", origin, detail: `${recent} calls in ${p.burstWindowMs / 60_000} minutes; paused until ${until}`, fp });
        throw new LlmGuardError("burst", `${origin} made ${recent} calls in ${p.burstWindowMs / 60_000} minutes; paused for an hour.`);
    }
    const same = mem.entries.filter((e) => e.fp === fp && Date.parse(e.at) >= now - DAY_MS);
    const last = same[same.length - 1];
    const limit = last && last.outcome !== "end_turn" ? p.repeatLimit - 1 : p.repeatLimit;
    if (same.length >= limit) {
        const reason = `identical request repeated ${same.length} times in 24 h (last outcome: ${last?.outcome ?? "none"})`;
        mem.state.blocked[fp] = { at: new Date(now).toISOString(), origin, reason };
        flag({ code: "repeat", origin, detail: reason, fp });
        throw new LlmGuardError("repeat", `Loop detected for ${origin}: ${reason}. Blocked until lifted from /api/llm/guard.`);
    }
}

export function record(entry: Omit<LedgerEntry, "at" | "usd"> & { at?: string }): LedgerEntry {
    load();
    const full: LedgerEntry = { at: entry.at ?? new Date().toISOString(), ...entry, usd: estimateUsd(entry.model, entry) };
    append(full);
    return full;
}

export function summary(now = Date.now()) {
    load();
    const day = mem.entries.filter((e) => Date.parse(e.at) >= startOfUtcDay(now));
    const byOrigin: Record<string, { calls: number; usd: number; inputTokens: number; outputTokens: number; truncated: number; errors: number }> = {};
    for (const e of day) {
        const o = byOrigin[e.origin] ??= { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0, truncated: 0, errors: 0 };
        o.calls += 1; o.usd += e.usd; o.inputTokens += e.inputTokens; o.outputTokens += e.outputTokens;
        if (e.outcome === "max_tokens") o.truncated += 1; if (e.outcome === "error") o.errors += 1;
    }
    return {
        policy: policy(),
        today: { calls: day.length, usd: Number(day.reduce((s, e) => s + e.usd, 0).toFixed(4)), byOrigin },
        blocked: Object.entries(mem.state.blocked).map(([fp, b]) => ({ fp, ...b })),
        tripped: Object.entries(mem.state.tripped).filter(([, t]) => Date.parse(t.until) > now).map(([origin, t]) => ({ origin, ...t })),
        flags: mem.state.flags.slice(-50).reverse(),
        recent: mem.entries.slice(-30).reverse(),
    };
}

/** Lift blocks: a single fingerprint, a tripped origin, or everything. JJ-only, through the route. */
export function lift(target: { fp?: string; origin?: string; all?: boolean }): void {
    load();
    if (target.all) { mem.state.blocked = {}; mem.state.tripped = {}; }
    if (target.fp) delete mem.state.blocked[target.fp];
    if (target.origin) delete mem.state.tripped[target.origin];
    persistState();
}

// ── The fetch wrapper ──────────────────────────────────────────────────────

interface UsageShape { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
const zero = () => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
function fold(into: ReturnType<typeof zero>, u: UsageShape | undefined) {
    if (!u) return;
    if (typeof u.input_tokens === "number") into.inputTokens = u.input_tokens;
    if (typeof u.output_tokens === "number") into.outputTokens = u.output_tokens;
    if (typeof u.cache_read_input_tokens === "number") into.cacheReadTokens = u.cache_read_input_tokens;
    if (typeof u.cache_creation_input_tokens === "number") into.cacheWriteTokens = u.cache_creation_input_tokens;
}
const outcomeOf = (stop: unknown): LedgerEntry["outcome"] => stop === "end_turn" ? "end_turn" : stop === "max_tokens" ? "max_tokens" : "other";

/** Read a teed SSE body to the end and account for it; never throws into the caller's stream. */
async function accountStream(body: ReadableStream<Uint8Array>, base: { origin: string; model: string; fp: string }) {
    const usage = zero(); let stop: unknown = null; let buffer = "";
    try {
        const reader = body.getReader(); const decoder = new TextDecoder();
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1);
                if (!line.startsWith("data:")) continue;
                try {
                    const ev = JSON.parse(line.slice(5));
                    if (ev.type === "message_start") fold(usage, ev.message?.usage);
                    else if (ev.type === "message_delta") { fold(usage, ev.usage); if (ev.delta?.stop_reason) stop = ev.delta.stop_reason; }
                } catch { /* partial frame */ }
            }
        }
    } catch { /* the consumer's own read already surfaced the failure */ }
    record({ ...base, outcome: stop === null ? "error" : outcomeOf(stop), ...usage });
}

export function guardedFetch(origin: string, inner: typeof fetch = fetch): typeof fetch {
    return async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        if (method !== "POST" || !/\/v1\/messages(\?|$)/.test(url) || typeof init?.body !== "string") return inner(input, init);
        let body: { model?: string; stream?: boolean } = {};
        try { body = JSON.parse(init.body); } catch { /* the API will reject it */ }
        const model = body.model ?? "unknown";
        const fp = fingerprint(origin, body);
        try { admit(origin, fp); }
        catch (error) {
            if (!(error instanceof LlmGuardError)) throw error;
            // A 403 with our own body: the SDK raises PermissionDeniedError at once, without retrying,
            // and `isGuardRefusal` recognises it at the call site.
            return new Response(JSON.stringify({ type: "error", error: { type: GUARD_ERROR_TYPE, code: error.code, message: error.message } }),
                { status: 403, headers: { "content-type": "application/json", "x-llm-guard": error.code } });
        }
        let response: Response;
        try { response = await inner(input, init); }
        catch (error) { record({ origin, model, fp, outcome: "error", ...zero() }); throw error; }
        if (!response.ok) { record({ origin, model, fp, outcome: "error", ...zero() }); return response; }
        if (body.stream && response.body) {
            const [forCaller, forLedger] = response.body.tee();
            void accountStream(forLedger, { origin, model, fp });
            return new Response(forCaller, { status: response.status, statusText: response.statusText, headers: response.headers });
        }
        const clone = response.clone();
        void clone.json().then((message: { usage?: UsageShape; stop_reason?: unknown }) => {
            const usage = zero(); fold(usage, message?.usage);
            record({ origin, model, fp, outcome: outcomeOf(message?.stop_reason), ...usage });
        }).catch(() => record({ origin, model, fp, outcome: "error", ...zero() }));
        return response;
    };
}

/** The only sanctioned way to build an Anthropic client in this app. `origin` names the room or job. */
export function guardedAnthropic(origin: string, options: ClientOptions = {}): Anthropic {
    return new Anthropic({ ...options, fetch: guardedFetch(origin, options.fetch ?? fetch) });
}

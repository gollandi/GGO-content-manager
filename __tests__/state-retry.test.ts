// @vitest-environment node
import { expect, it, vi } from "vitest";
import { isTransientStateFailure, retryAfterSeconds } from "../lib/cancello/state-retry";
import { readState } from "../tools/media-sync/read-state.mjs";

it("asks again only while the state is rebuilt or the proxy answers for a restart", () => {
    expect(isTransientStateFailure(503, { code: "CANCELLO_STATE_TIMEOUT" })).toBe(true);
    expect(isTransientStateFailure(502, {})).toBe(true);
    expect(isTransientStateFailure(504, null)).toBe(true);
    expect(isTransientStateFailure(503, {})).toBe(false);
    expect(isTransientStateFailure(500, { code: "CANCELLO_STATE_TIMEOUT" })).toBe(false);
    expect(isTransientStateFailure(401, {})).toBe(false);
    expect(retryAfterSeconds("12")).toBe(12);
    expect(retryAfterSeconds(null)).toBe(30);
    expect(retryAfterSeconds("soon")).toBe(30);
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    ({ ok: status < 400, status, headers: new Headers(headers), json: async () => body }) as Response;
const rebuilding = () => json(503, { code: "CANCELLO_STATE_TIMEOUT", error: "x" }, { "retry-after": "30" });

function clockedSleep() {
    let t = 0;
    return { now: () => t, sleep: vi.fn(async (ms: number) => { t += ms; }) };
}

it("media-sync waits out a rebuilding state, honouring Retry-After", async () => {
    const c = clockedSleep();
    const fetchImpl = vi.fn()
        .mockResolvedValueOnce(rebuilding()).mockResolvedValueOnce(rebuilding())
        .mockResolvedValueOnce(json(200, { desk: [], calendar: [] }));
    const state = await readState({ url: "http://cockpit/state", token: "t", fetchImpl, ...c });
    expect(state).toEqual({ desk: [], calendar: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(c.sleep.mock.calls).toEqual([[30_000], [30_000]]);
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ authorization: "Bearer t" });
});

it("media-sync gives up at its deadline, and at once on any other failure", async () => {
    const c = clockedSleep();
    const always = vi.fn(async () => rebuilding());
    await expect(readState({ url: "u", token: "t", fetchImpl: always, deadlineMs: 100_000, ...c }))
        .rejects.toThrow("state read failed (HTTP 503 CANCELLO_STATE_TIMEOUT, attempt 4)");
    expect(c.sleep).toHaveBeenCalledTimes(3);

    const denied = vi.fn(async () => json(401, { error: "Unauthorized" }));
    await expect(readState({ url: "u", token: "t", fetchImpl: denied, ...clockedSleep() }))
        .rejects.toThrow("state read failed (HTTP 401, attempt 1)");

    const proxyPage = vi.fn(async () => ({ ok: false, status: 502, headers: new Headers(), json: async () => { throw new SyntaxError("<html>"); } }) as unknown as Response);
    await expect(readState({ url: "u", token: "t", fetchImpl: proxyPage, ...clockedSleep() }))
        .rejects.toThrow("state read failed (HTTP 502, attempt 1)");

    const offline = vi.fn(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }); });
    await expect(readState({ url: "u", token: "t", fetchImpl: offline, ...clockedSleep() }))
        .rejects.toThrow("state read failed (ECONNREFUSED, attempt 1)");
});

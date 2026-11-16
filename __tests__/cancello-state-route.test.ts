// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { load, within, TimeoutError } = vi.hoisted(() => {
    class TimeoutError extends Error {
        readonly name = "CancelloStateTimeoutError";
        constructor(readonly timeoutMs: number) { super("Lo stato del Cancello non è pronto entro 25 s"); }
    }
    return { load: vi.fn(), within: vi.fn(), TimeoutError };
});
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: vi.fn() }));
vi.mock("../lib/briefing/warm", () => ({ warmBriefings: vi.fn() }));
vi.mock("../lib/house/state", () => ({ getHouseState: vi.fn() }));
vi.mock("../lib/cancello/state", () => ({
    loadCancelloState: load, loadCancelloStateWithin: within, CancelloStateTimeoutError: TimeoutError,
}));
import { GET } from "../app/api/review-dashboard/state/route";

const read = (query = "") => GET(new NextRequest(`http://localhost/api/review-dashboard/state${query}`, {
    headers: { Authorization: "Bearer read-only-fixture" },
}));

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("COCKPIT_SERVICE_TOKEN", "read-only-fixture");
});
afterEach(() => { vi.unstubAllEnvs(); });

it("an interactive read waits only within the deadline", async () => {
    within.mockResolvedValue({ generatedAt: "fixture", warnings: [] });
    const response = await read("?refresh=1");
    expect(response.status).toBe(200);
    expect(within).toHaveBeenCalledWith(undefined, { refresh: true });
    expect(load).not.toHaveBeenCalled();
});

it("a read past its deadline is a named 503 with a retry hint, not a hang", async () => {
    within.mockRejectedValue(new TimeoutError(25_000));
    const response = await read();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
        code: "CANCELLO_STATE_TIMEOUT",
        error: expect.stringContaining("non è pronto"),
    });
});

it("any other failure stays a 500", async () => {
    within.mockRejectedValue(new Error("Incomplete cancello snapshot"));
    const response = await read();
    expect(response.status).toBe(500);
});

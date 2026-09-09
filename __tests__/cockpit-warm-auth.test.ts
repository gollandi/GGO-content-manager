// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { requireAuth, requireWriter, load, house, decide } = vi.hoisted(() => ({
    requireAuth: vi.fn(), requireWriter: vi.fn(), load: vi.fn(), house: vi.fn(), decide: vi.fn(),
}));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth, requireWriter }));
vi.mock("../lib/cancello/state", () => ({ loadCancelloState: load }));
vi.mock("../lib/house/state", () => ({ getHouseState: house }));
vi.mock("../lib/cancello/decision", () => ({ applyCancelloDecision: decide }));
import { GET } from "../app/api/review-dashboard/state/route";
import { POST } from "../app/api/review-dashboard/decision/route";
beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("COCKPIT_SERVICE_TOKEN", "read-only-fixture");
    requireAuth.mockResolvedValue({ authenticated: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    requireWriter.mockResolvedValue({ authenticated: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    house.mockResolvedValue({ generatedAt: "fixture", errors: [], privateData: "must not escape" });
    load.mockResolvedValue({ generatedAt: "fixture", warnings: [], privateData: "must not escape" });
});
afterEach(() => { vi.unstubAllEnvs(); });
it("refuses an unauthenticated or incorrect-bearer warm-up without touching upstream", async () => {
    for (const token of ["", "wrong"]) {
        const response = await GET(new NextRequest("http://localhost/api/review-dashboard/state?warm=1", { headers: { Authorization: `Bearer ${token}` } }));
        expect(response.status).toBe(401);
    }
    expect(house).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled();
});
it("a read-only bearer prepares both projections and returns only operational metadata", async () => {
    const response = await GET(new NextRequest("http://localhost/api/review-dashboard/state?warm=1", { headers: { Authorization: "Bearer read-only-fixture" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ ok: true, errors: 0, warnings: 0 });
    expect(house).toHaveBeenCalledWith({ revalidate: true });
    expect(load).toHaveBeenCalledOnce(); expect(decide).not.toHaveBeenCalled();
});
it("the same service bearer cannot approve or publish without a human writer session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/review-dashboard/decision", {
        method: "POST", headers: { Authorization: "Bearer read-only-fixture", "Content-Type": "application/json" },
        body: JSON.stringify({ rowId: "fixture", target: "calendar", decision: "approve", publishNow: true }),
    }));
    expect(response.status).toBe(401); expect(decide).not.toHaveBeenCalled();
});
it("a failed warm-up is an error, not a healthy empty dashboard", async () => {
    house.mockRejectedValue(new Error("Incomplete house snapshot"));
    const response = await GET(new NextRequest("http://localhost/api/review-dashboard/state?warm=1", { headers: { Authorization: "Bearer read-only-fixture" } }));
    expect(response.status).toBe(500); expect(load).not.toHaveBeenCalled();
});

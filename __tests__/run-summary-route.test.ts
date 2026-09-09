// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { auth, load, events, exists, summarise } = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), events: vi.fn(), exists: vi.fn(), summarise: vi.fn() }));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: auth }));
vi.mock("../lib/runner/store", () => ({ loadMeta: load, loadEvents: events, runExists: exists }));
vi.mock("../lib/briefing/run-summary", () => ({ getRunSummary: summarise }));
import { GET } from "../app/api/ernesto/runs/[id]/route";
beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue({ authenticated: true }); exists.mockReturnValue(true); load.mockReturnValue({ summary: "fixture" }); events.mockReturnValue([]); summarise.mockResolvedValue({ status: "basic", paragraphs: ["Una bozza resta da rivedere."] }); });
it("refuses an unauthenticated summary read before loading run data", async () => {
    auth.mockResolvedValue({ authenticated: false, response: NextResponse.json({}, { status: 401 }) });
    const response = await GET(new NextRequest("http://localhost/api/ernesto/runs/fixture?summary=1"), { params: Promise.resolve({ id: "fixture" }) });
    expect(response.status).toBe(401); expect(load).not.toHaveBeenCalled(); expect(summarise).not.toHaveBeenCalled();
});
it("polls just the summary without repeatedly reading or returning the full event journal", async () => {
    const response = await GET(new NextRequest("http://localhost/api/ernesto/runs/fixture?summary=1"), { params: Promise.resolve({ id: "fixture" }) });
    expect((await response.json()).narrative.status).toBe("basic"); expect(events).not.toHaveBeenCalled();
});
it("preserves the full replay contract when no summary option was requested", async () => {
    const response = await GET(new NextRequest("http://localhost/api/ernesto/runs/fixture"), { params: Promise.resolve({ id: "fixture" }) });
    expect(await response.json()).toEqual({ meta: { summary: "fixture" }, events: [] }); expect(summarise).not.toHaveBeenCalled();
});

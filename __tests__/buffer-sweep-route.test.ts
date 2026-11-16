// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { sweep, invalidate } = vi.hoisted(() => ({ sweep: vi.fn(), invalidate: vi.fn() }));
vi.mock("../lib/cancello/buffer-send", () => ({ sweepOrderedRows: sweep }));
vi.mock("../lib/cancello/state", () => ({ invalidateCancelloCache: invalidate }));
import { POST } from "../app/api/review-dashboard/buffer-sweep/route";

const call = () => POST(new NextRequest("http://localhost/api/review-dashboard/buffer-sweep", {
    method: "POST", headers: { Authorization: "Bearer sweep-fixture" },
}));

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("COCKPIT_BUFFER_SWEEP_TOKEN", "sweep-fixture"); });
afterEach(() => { vi.unstubAllEnvs(); });

it("a quiet sweep leaves the snapshots alone", async () => {
    sweep.mockResolvedValue({ considered: 2, rows: [], changed: false });
    expect((await call()).status).toBe(200);
    expect(invalidate).not.toHaveBeenCalled();
});

it("a sweep that wrote something fences the snapshots", async () => {
    sweep.mockResolvedValue({ considered: 1, rows: [], changed: true });
    await call();
    expect(invalidate).toHaveBeenCalledOnce();
});

it("a sweep that failed part-way fences too: it may have written before failing", async () => {
    sweep.mockRejectedValue(new Error("Sanity write-back failed"));
    expect((await call()).status).toBe(500);
    expect(invalidate).toHaveBeenCalledOnce();
});

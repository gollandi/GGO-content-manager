// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, standing } = vi.hoisted(() => ({ auth: vi.fn(), standing: vi.fn() }));
vi.mock("../lib/auth/config", () => ({ auth }));
vi.mock("../lib/auth/users", () => ({ storeStanding: standing }));

import { requireAuth, requireUploader, requireAdmin } from "../lib/auth/api-guard";
import { viewFor } from "../lib/cancello/view";
import { noteSignInFailure, resetSignInThrottle, signInThrottled } from "../lib/auth/throttle";

const session = (user: Record<string, unknown>) => ({ user });

beforeEach(() => { auth.mockReset(); standing.mockReset(); });

describe("requireAuth asks the store again on every call", () => {
    it("never consults the store for the admin, so a broken store cannot lock the owner out", async () => {
        auth.mockResolvedValue(session({ email: "owner@example.com", name: "Operator", role: "admin" }));
        standing.mockImplementation(() => { throw new Error("must not be called"); });
        const r = await requireAdmin();
        expect(r.authenticated).toBe(true);
        expect(standing).not.toHaveBeenCalled();
    });

    it("refuses a collaborator switched off after signing in", async () => {
        auth.mockResolvedValue(session({ email: "d@example.com", name: "Diletta", role: "social", collaborator: true }));
        standing.mockReturnValue({ kind: "revoked" });
        const r = await requireAuth();
        expect(r.authenticated).toBe(false);
        if (!r.authenticated) expect(r.response.status).toBe(401);
    });

    it("refuses a collaborator's token whose record has gone", async () => {
        auth.mockResolvedValue(session({ email: "d@example.com", name: "Diletta", role: "social", collaborator: true }));
        standing.mockReturnValue({ kind: "absent" });
        expect((await requireAuth()).authenticated).toBe(false);
    });

    it("takes the role and name from the store, not the token", async () => {
        auth.mockResolvedValue(session({ email: "d@example.com", name: "old", role: "editor", collaborator: true }));
        standing.mockReturnValue({ kind: "active", role: "social", name: "Diletta" });
        const r = await requireAuth();
        expect(r).toEqual(expect.objectContaining({ authenticated: true, role: "social", name: "Diletta" }));
    });

    it("lets the social role upload but not administer", async () => {
        auth.mockResolvedValue(session({ email: "d@example.com", name: "Diletta", role: "social", collaborator: true }));
        standing.mockReturnValue({ kind: "active", role: "social", name: "Diletta" });
        expect((await requireUploader()).authenticated).toBe(true);
        const admin = await requireAdmin();
        expect(admin.authenticated).toBe(false);
        if (!admin.authenticated) expect(admin.response.status).toBe(403);
    });
});

describe("the Cancello state a role is shown", () => {
    const state = {
        wall: [{ rowId: "w" }], desk: [{ rowId: "d" }], calendar: [{ rowId: "c" }], website: [{ rowId: "x" }],
        generatedAt: "t", cached: false, warnings: ["desk warning"],
    } as never;

    it("gives the social role the calendar only", () => {
        const v = viewFor(state, "social");
        expect(v.calendar).toHaveLength(1);
        expect([v.wall, v.desk, v.website, v.warnings]).toEqual([[], [], [], []]);
    });

    it("leaves the service token and the admin's view unchanged", () => {
        expect(viewFor(state, null)).toBe(state);
        expect(viewFor(state, "admin")).toEqual(state);
    });
});

describe("the sign-in brake", () => {
    afterEach(() => resetSignInThrottle());
    it("pauses an address after eight wrong passwords in fifteen minutes, then lets it try again", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 7; i++) noteSignInFailure("d@example.com", t0 + i);
        expect(signInThrottled("d@example.com", t0 + 10)).toBe(false);
        noteSignInFailure("d@example.com", t0 + 8);
        expect(signInThrottled("d@example.com", t0 + 10)).toBe(true);
        expect(signInThrottled("other@example.com", t0 + 10)).toBe(false);
        expect(signInThrottled("d@example.com", t0 + 15 * 60 * 1000 + 10)).toBe(false);
    });
});

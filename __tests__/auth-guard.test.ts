// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, standing, contract } = vi.hoisted(() => ({ auth: vi.fn(), standing: vi.fn(), contract: vi.fn() }));
vi.mock("../lib/auth/config", () => ({ auth }));
vi.mock("../lib/auth/users", () => ({ storeStanding: standing }));
vi.mock("../lib/contracts/store", () => ({ contractStanding: contract }));

import { requireAuth, requireUploader, requireAdmin } from "../lib/auth/api-guard";
import { viewFor } from "../lib/cancello/view";
import { noteSignInFailure, resetSignInThrottle, signInThrottled } from "../lib/auth/throttle";

const session = (user: Record<string, unknown>) => ({ user });

beforeEach(() => { auth.mockReset(); standing.mockReset(); contract.mockReset(); contract.mockReturnValue({ kind: "accepted" }); });
afterEach(() => vi.unstubAllEnvs());

describe("requireAuth asks the store again on every call", () => {
    it("never consults the store for the admin, so a broken store cannot lock the owner out", async () => {
        vi.stubEnv("COCKPIT_USER_EMAIL", "owner@example.com");
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
    it("pauses an address and client after eight wrong passwords, leaving the same address from elsewhere free", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 7; i++) noteSignInFailure("d@example.com", "203.0.113.9", t0 + i);
        expect(signInThrottled("d@example.com", "203.0.113.9", t0 + 10)).toBe(false);
        noteSignInFailure("d@example.com", "203.0.113.9", t0 + 8);
        expect(signInThrottled("d@example.com", "203.0.113.9", t0 + 10)).toBe(true);
        // The collaborator, signing in from their own connection, is not locked out.
        expect(signInThrottled("d@example.com", "198.51.100.7", t0 + 10)).toBe(false);
        expect(signInThrottled("d@example.com", "203.0.113.9", t0 + 15 * 60 * 1000 + 10)).toBe(false);
    });
    it("still caps a guesser who rotates their address", () => {
        for (let i = 0; i < 40; i++) noteSignInFailure("d@example.com", `198.51.100.${i}`, 1_000_000 + i);
        expect(signInThrottled("d@example.com", "192.0.2.1", 1_000_100)).toBe(true);
    });
    it("reads the client address from the hop nginx appended, not one the client claimed", async () => {
        const { clientIp } = await import("../lib/auth/credentials");
        const req = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.7, 203.0.113.9" } });
        expect(clientIp(req)).toBe("203.0.113.9");
        expect(clientIp(undefined)).toBe("unknown");
    });
});

describe("media a role may fetch", () => {
    it("lists the recorded paths of the calendar rows shown, and nothing else", async () => {
        const { calendarMediaPaths } = await import("../lib/cancello/view");
        const paths = calendarMediaPaths({
            wall: [], desk: [{ media: [{ kind: "image", url: "/media?path=%2Fsrv%2Fdesk.jpg" }] }], website: [],
            calendar: [{ media: [
                { kind: "image", url: "/media?path=%2Fsrv%2Fggomed-media%2Fa%20b.png" },
                { kind: "video", url: "/video?path=%2Fsrv%2Fggomed-media%2Fc.mp4" },
                { kind: "image", url: "https://cdn.sanity.io/x.png" },
            ] }],
            generatedAt: "t", cached: false, warnings: [],
        } as never);
        expect([...paths].sort()).toEqual(["/srv/ggomed-media/a b.png", "/srv/ggomed-media/c.mp4"]);
    });
});

describe("no data before the agreement", () => {
    const diletta = () => {
        auth.mockResolvedValue(session({ email: "d@example.com", name: "Diletta", role: "social", collaborator: true }));
        standing.mockReturnValue({ kind: "active", role: "social", name: "Diletta", houseHandle: "diletta" });
    };

    it("refuses every guarded route until the agreement is signed", async () => {
        diletta();
        for (const kind of ["required", "unassigned"]) {
            contract.mockReturnValue({ kind });
            for (const guard of [requireAuth, requireUploader]) {
                const r = await guard();
                expect(r.authenticated).toBe(false);
                if (!r.authenticated) {
                    expect(r.response.status).toBe(403);
                    expect((await r.response.json()).code).toBe("CONTRACT_REQUIRED");
                }
            }
        }
    });

    it("refuses when the agreement cannot be read (fails closed)", async () => {
        diletta();
        contract.mockImplementation(() => { throw new Error("disk gone"); });
        expect((await requireAuth()).authenticated).toBe(false);
    });

    it("lets the onboarding routes read and sign, and never asks it of the owner", async () => {
        diletta();
        contract.mockReturnValue({ kind: "required" });
        expect((await requireAuth({ contract: "pending-ok" })).authenticated).toBe(true);
        vi.stubEnv("COCKPIT_USER_EMAIL", "owner@example.com");
        auth.mockResolvedValue(session({ email: "owner@example.com", name: "JJ", role: "admin" }));
        contract.mockImplementation(() => { throw new Error("must not be called"); });
        expect((await requireAdmin()).authenticated).toBe(true);
    });

    it("opens once it is signed", async () => {
        diletta();
        contract.mockReturnValue({ kind: "accepted" });
        expect((await requireAuth()).authenticated).toBe(true);
    });
});

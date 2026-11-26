// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const m = vi.hoisted(() => ({
    requireAuth: vi.fn(), requireAdmin: vi.fn(), within: vi.fn(), load: vi.fn(),
    retrieve: vi.fn(), update: vi.fn(), sendRow: vi.fn(),
}));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: m.requireAuth, requireAdmin: m.requireAdmin }));
vi.mock("../lib/briefing/warm", () => ({ warmBriefings: vi.fn() }));
vi.mock("../lib/house/state", () => ({ getHouseState: vi.fn() }));
vi.mock("../lib/cancello/state", () => ({
    loadCancelloState: m.load, loadCancelloStateWithin: m.within, invalidateCancelloCache: vi.fn(),
    CancelloStateTimeoutError: class extends Error {},
}));
vi.mock("../lib/notion/client", () => ({ notion: { pages: { retrieve: m.retrieve, update: m.update, create: vi.fn() } } }));
vi.mock("../lib/config", () => ({ notionConfig: { dbs: { ernestoDesk: () => "desk-db", contentCalendar: () => "calendar-db" } } }));
vi.mock("../lib/cancello/patches", () => ({ findPatchForAsset: vi.fn(() => null) }));
vi.mock("../lib/cancello/house", () => ({ kickstartJob: vi.fn(), runHouseScript: vi.fn() }));
vi.mock("../lib/cancello/buffer-send", () => ({
    sendRow: m.sendRow, liveDeps: { getRow: vi.fn(async () => ({ orderedBy: "JJ" })) },
    isOrderedByJJ: (r: { orderedBy: string | null }) => r.orderedBy === "JJ",
}));

import { POST as decide } from "../app/api/review-dashboard/decision/route";
import { GET as stateRead } from "../app/api/review-dashboard/state/route";
import { GET as media } from "../app/api/review-dashboard/media/route";
import { GET as listCollaborators, POST as invite } from "../app/api/collaborators/route";
import { POST as access } from "../app/api/collaborators/access/route";
import { POST as redeem } from "../app/api/auth-invite/redeem/route";
import { POST as inviteContract } from "../app/api/auth-invite/contract/route";
import { acceptanceFor, installContract } from "./helpers/contract-fixture";
import { readRecords } from "../lib/contracts/store";
import { crossSiteWrite } from "../lib/auth/gate";

const social = { authenticated: true, email: "d@example.com", name: "Diletta", role: "social" };
const owner = { authenticated: true, email: "owner@example.com", name: "JJ", role: "admin" };
const forbidden = { authenticated: false, response: new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 }) };
const json = (url: string, body: unknown) => new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const state = {
    wall: [{ rowId: "w" }], desk: [{ rowId: "d" }], website: [{ rowId: "x" }], warnings: [], generatedAt: "t", cached: false,
    calendar: [{ rowId: "c", media: [{ kind: "image", url: "/media?path=%2Ftmp%2Fshown.png" }] }],
};
let dir: string;

beforeEach(() => {
    for (const f of Object.values(m)) f.mockReset();
    m.update.mockResolvedValue({});
    m.within.mockResolvedValue(state);
    dir = mkdtempSync(path.join(tmpdir(), "ggo-routes-"));
    vi.stubEnv("COCKPIT_AUTH_DIR", dir);
    delete (globalThis as Record<string, unknown>).__ggoUserStoreQueue;
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe("the decision route passes the session's actor", () => {
    it("refuses a collaborator's approve with 403 and writes nothing", async () => {
        m.requireAuth.mockResolvedValue(social);
        const res = await decide(json("http://x/api/review-dashboard/decision", { rowId: "c", target: "calendar", decision: "approve" }));
        expect(res.status).toBe(403);
        expect(m.update).not.toHaveBeenCalled();
        expect(m.sendRow).not.toHaveBeenCalled();
    });
    it("lets the owner approve as before", async () => {
        m.requireAuth.mockResolvedValue(owner);
        m.sendRow.mockResolvedValue({ outcome: "awaiting-staging", posts: [] });
        const res = await decide(json("http://x/api/review-dashboard/decision", { rowId: "c", target: "calendar", decision: "approve" }));
        expect(res.status).toBe(200);
        expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ properties: { Status: { select: { name: "Approved" } } } }));
    });
});

describe("the state route as the social role sees it", () => {
    it("returns calendar rows only, refuses warming and never forces a re-crawl", async () => {
        m.requireAuth.mockResolvedValue(social);
        const body = await (await stateRead(new NextRequest("http://x/api/review-dashboard/state?refresh=1"))).json();
        expect([body.desk, body.wall, body.website]).toEqual([[], [], []]);
        expect(body.calendar).toHaveLength(1);
        expect(m.within).toHaveBeenCalledWith(undefined, { refresh: false });
        expect((await stateRead(new NextRequest("http://x/api/review-dashboard/state?warm=1"))).status).toBe(403);
    });
    it("still lets the owner force a re-crawl", async () => {
        m.requireAuth.mockResolvedValue(owner);
        await stateRead(new NextRequest("http://x/api/review-dashboard/state?refresh=1"));
        expect(m.within).toHaveBeenCalledWith(undefined, { refresh: true });
    });
});

describe("the media route as the social role sees it", () => {
    it("refuses a path that no shown calendar row records, and says so when the list is unavailable", async () => {
        m.requireAuth.mockResolvedValue(social);
        expect((await media(new NextRequest("http://x/api/review-dashboard/media?path=%2Ftmp%2Fdesk.png"))).status).toBe(403);
        m.within.mockRejectedValue(new Error("slow"));
        expect((await media(new NextRequest("http://x/api/review-dashboard/media?path=%2Ftmp%2Fshown.png"))).status).toBe(503);
    });
});

describe("collaborator management and the invitation", () => {
    it("is admin-only", async () => {
        m.requireAdmin.mockResolvedValue(forbidden);
        expect((await listCollaborators()).status).toBe(403);
        expect((await invite(json("http://x/api/collaborators", { email: "a@b.co", name: "A", role: "social" }))).status).toBe(403);
        expect((await access(json("http://x/api/collaborators/access", { email: "a@b.co", disabled: true }))).status).toBe(403);
    });

    it("puts the token in the #fragment, lets it be redeemed once without a session, then refuses it", async () => {
        m.requireAdmin.mockResolvedValue(owner);
        const made = await (await invite(json("http://cockpit.test/api/collaborators", { email: "d@example.com", name: "Diletta", role: "social" }))).json();
        expect(made.link).toMatch(/\/invito#[A-Za-z0-9_-]{40,}$/);
        expect(made.link).not.toContain("?");
        const token = made.link.split("#")[1];
        installContract(dir, "d@example.com");
        const { view } = await (await inviteContract(json("http://x/api/auth-invite/contract", { token }))).json();
        const acceptance = acceptanceFor(view);
        const first = await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass", acceptance }));
        expect(first.status).toBe(200);
        expect(first.headers.get("referrer-policy")).toBe("no-referrer");
        expect((await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass", acceptance }))).status).toBe(404);
    });

    it("sets no password without the agreement, and none on a draft", async () => {
        m.requireAdmin.mockResolvedValue(owner);
        const made = await (await invite(json("http://cockpit.test/api/collaborators", { email: "d@example.com", name: "Diletta", role: "social" }))).json();
        const token = made.link.split("#")[1];
        // No agreement prepared yet: the invitation says so and sets nothing.
        expect((await inviteContract(json("http://x/api/auth-invite/contract", { token }))).status).toBe(409);
        installContract(dir, "d@example.com", { status: "PENDING_JJ_FINAL_READ" });
        const { view } = await (await inviteContract(json("http://x/api/auth-invite/contract", { token }))).json();
        expect(view.signable).toBe(false);
        expect(view.notSignableReason).toMatch(/not final yet/);
        expect((await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass", acceptance: acceptanceFor(view) }))).status).toBe(422);
        installContract(dir, "d@example.com");
        const final = (await (await inviteContract(json("http://x/api/auth-invite/contract", { token }))).json()).view;
        expect((await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass" }))).status).toBe(422);
        expect((await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass", acceptance: acceptanceFor(final, "Someone Else") }))).status).toBe(422);
        expect((await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass", acceptance: { ...acceptanceFor(final), sha256: "0".repeat(64) } }))).status).toBe(422);
        expect(readRecords()).toHaveLength(0);
        // The link still works once the agreement is signed.
        const ok = await redeem(json("http://x/api/auth-invite/redeem", { token, password: "a long enough pass", acceptance: acceptanceFor(final, "test contractor") }));
        expect(ok.status).toBe(200);
        const [record] = readRecords();
        expect(record).toMatchObject({ signatory_role: "contractor", signatory_email: "d@example.com", contract_sha256: final.sha256, auth_evidence: { method: "invitation", mfa: false } });
        expect(record.auth_evidence.invite_token_id).toMatch(/^[0-9a-f]{16}$/);
        expect(JSON.stringify(record)).not.toContain(token);
    });
});

describe("cross-site writes are refused", () => {
    const base = { pathname: "/api/review-dashboard/decision", allowedOrigins: ["https://cockpit.ggo-suite.co.uk"] };
    it("refuses a POST from a sibling host and accepts the cockpit's own", () => {
        expect(crossSiteWrite({ ...base, method: "POST", origin: "https://evil.ggo-suite.co.uk", secFetchSite: "same-site" })).toBe(true);
        expect(crossSiteWrite({ ...base, method: "POST", origin: "https://cockpit.ggo-suite.co.uk", secFetchSite: "same-origin" })).toBe(false);
        expect(crossSiteWrite({ ...base, method: "GET", origin: "https://evil.ggo-suite.co.uk", secFetchSite: "cross-site" })).toBe(false);
        expect(crossSiteWrite({ ...base, method: "POST", origin: null, secFetchSite: null })).toBe(false);
        expect(crossSiteWrite({ ...base, pathname: "/api/auth/callback/credentials", method: "POST", origin: "https://evil.example", secFetchSite: "cross-site" })).toBe(false);
    });
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { acceptanceFor, installContract } from "./helpers/contract-fixture";

const m = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: m.requireAuth }));

let dir: string;
const req = (q = "") => new NextRequest(`https://cockpit.test/api/contract/signed${q}`, { headers: { "x-forwarded-for": "198.51.100.4" } });
const downloads = () => {
    const p = path.join(dir, "contract-downloads.jsonl");
    return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};

beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-signed-route-"));
    vi.stubEnv("COCKPIT_AUTH_DIR", dir);
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).__ggoContractQueue;
    m.requireAuth.mockReset();
    installContract(dir, "d@example.com");
    const store = await import("../lib/contracts/store");
    const accept = await import("../lib/contracts/accept");
    const s = store.contractStanding("d@example.com");
    if (s.kind !== "required") throw new Error("setup");
    await accept.acceptContract(acceptanceFor(s.view), { email: "d@example.com", storeName: "Diletta", method: "session", inviteTokenId: null, ip: "203.0.113.7", userAgent: "test" });
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe("GET /api/contract/signed", () => {
    it("gives the collaborator their own copy as a PDF, and logs the download", async () => {
        m.requireAuth.mockResolvedValue({ authenticated: true, role: "social", email: "D@example.com" });
        const { GET } = await import("../app/api/contract/signed/route");
        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/pdf");
        expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="[a-z0-9-]+-v[\d.]+-signed\.pdf"$/);
        expect(res.headers.get("cache-control")).toContain("no-store");
        const body = Buffer.from(await res.arrayBuffer());
        expect(body.subarray(0, 5).toString()).toBe("%PDF-");
        expect(downloads()).toEqual([expect.objectContaining({ by: "d@example.com", contractor: "d@example.com", ip: "198.51.100.4" })]);
    });

    it("refuses another person's copy to a collaborator", async () => {
        m.requireAuth.mockResolvedValue({ authenticated: true, role: "social", email: "d@example.com" });
        const { GET } = await import("../app/api/contract/signed/route");
        const res = await GET(req("?email=someone@example.com"));
        expect(res.status).toBe(403);
        expect(downloads()).toEqual([]);
    });

    it("lets JJ download a collaborator's copy, logged as his", async () => {
        m.requireAuth.mockResolvedValue({ authenticated: true, role: "admin", email: "owner@example.com" });
        const { GET } = await import("../app/api/contract/signed/route");
        const res = await GET(req("?email=d@example.com"));
        expect(res.status).toBe(200);
        expect(downloads()).toEqual([expect.objectContaining({ by: "owner@example.com", contractor: "d@example.com" })]);
    });

    it("answers 404 when nothing is signed, and 503 without logging when the copy cannot be made", async () => {
        m.requireAuth.mockResolvedValue({ authenticated: true, role: "admin", email: "owner@example.com" });
        const { GET } = await import("../app/api/contract/signed/route");
        expect((await GET(req("?email=nobody@example.com"))).status).toBe(404);
        const copies = path.join(dir, "contract-copies");
        const [file] = (await import("node:fs")).readdirSync(copies);
        writeFileSync(path.join(copies, file), "tampered");
        const res = await GET(req("?email=d@example.com"));
        expect(res.status).toBe(503);
        expect(downloads()).toEqual([]);
    });
});

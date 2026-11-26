// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { acceptanceFor, CONTRACT_ID, installContract } from "./helpers/contract-fixture";
import { ContractError, parseContract, render, sameName, sha256 } from "../lib/contracts/contract";

let dir: string;
let store: typeof import("../lib/contracts/store");
let accept: typeof import("../lib/contracts/accept");

beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-contracts-"));
    vi.stubEnv("COCKPIT_AUTH_DIR", dir);
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).__ggoContractQueue;
    store = await import("../lib/contracts/store");
    accept = await import("../lib/contracts/accept");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const ctx = { email: "d@example.com", storeName: "Diletta", method: "session" as const, inviteTokenId: null, ip: "203.0.113.7", userAgent: "test" };

describe("parsing and rendering", () => {
    it("fills every variable and refuses an unfilled one", () => {
        const md = readFileSync(path.join(__dirname, "fixtures/contracts/v1.0.md"), "utf8");
        const c = parseContract(md);
        expect(render(c)).toContain("It starts on 1 January 2030.");
        expect(() => render({ ...c, body: c.body + "\n{{missing}}" })).toThrow(ContractError);
    });

    it("refuses front matter it does not understand", () => {
        expect(() => parseContract("---\ncontract_id: x-y-z\nweird line\n---\nbody")).toThrow(/not understood/);
        expect(() => parseContract("no front matter")).toThrow(/front matter/);
    });

    it("matches a typed signature without caring for case or accents", () => {
        expect(sameName("maria della rossa", "Maria Della Rossa")).toBe(true);
        expect(sameName("Mària  Della-Rossa", "Maria Della Rossa")).toBe(true);
        expect(sameName("Maria", "Maria Della Rossa")).toBe(false);
    });
});

describe("acceptance records", () => {
    it("records the exact text, with the server's time and the client address, in a 0600 chain", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        expect(s.kind).toBe("required");
        if (s.kind !== "required") return;
        const r = await accept.acceptContract(acceptanceFor(s.view), { ...ctx, now: new Date("2026-11-27T09:00:00Z") });
        expect(r.accepted_at_utc).toBe("2026-11-27T09:00:00.000Z");
        expect(r.ip_address).toBe("203.0.113.7");
        expect(r.variables_snapshot.start_date).toBe("1 January 2030");
        expect(store.archivedText(r.contract_sha256)).toBe(s.view.text);
        expect(sha256(s.view.text)).toBe(r.contract_sha256);
        expect(statSync(path.join(dir, "contract-records.jsonl")).mode & 0o777).toBe(0o600);
        expect(store.contractStanding("d@example.com").kind).toBe("accepted");
        // Signing twice adds nothing.
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        expect(store.readRecords()).toHaveLength(1);
    });

    it("detects a tampered record and refuses to append after it", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        const p = path.join(dir, "contract-records.jsonl");
        writeFileSync(p, readFileSync(p, "utf8").replace("203.0.113.7", "198.51.100.1"));
        expect(store.verifyChain()).not.toBeNull();
        // Everyone's standing fails closed, and nothing more can be signed.
        expect(() => store.contractStanding("d@example.com")).toThrow(/do not verify/);
        await expect(accept.acceptContract(acceptanceFor(s.view), ctx)).rejects.toThrow(/do not verify/);
    });

    it("a new FINAL version asks again; a newer draft does not take access away", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        const d = path.join(dir, "contracts", CONTRACT_ID);
        const v2 = readFileSync(path.join(d, "v1.0.md"), "utf8").replace("contract_version: '1.0'", "contract_version: '1.1'").replace("100 example units", "120 example units");
        writeFileSync(path.join(d, "v1.1.md"), v2.replace("status: FINAL", "status: DRAFT"));
        writeFileSync(path.join(d, "v1.1.copy.json"), readFileSync(path.join(d, "v1.0.copy.json")));
        expect(store.contractStanding("d@example.com").kind).toBe("accepted");
        writeFileSync(path.join(d, "v1.1.md"), v2);
        const again = store.contractStanding("d@example.com");
        expect(again.kind).toBe("required");
        if (again.kind === "required") expect(again.view.version).toBe("1.1");
    });

    it("JJ countersigns the version signed, once; the signed copy carries both signatures", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        expect(store.signedCopy("d@example.com", s.view.sha256)).toContain("Awaiting GGO Med's signature.");
        const jj = { email: "owner@example.com", name: "JJ", ip: "192.0.2.1", userAgent: "t" };
        await expect(accept.countersign("d@example.com", s.view.sha256, "Someone", jj)).rejects.toThrow(/director/);
        await expect(accept.countersign("d@example.com", "0".repeat(64), "Giangiacomo Ollandini", jj)).rejects.toThrow(/not the version/);
        await accept.countersign("d@example.com", s.view.sha256, "Giangiacomo Ollandini", jj);
        await expect(accept.countersign("d@example.com", s.view.sha256, "Giangiacomo Ollandini", jj)).rejects.toThrow(/Already/);
        const copy = store.signedCopy("d@example.com", s.view.sha256);
        expect(copy).toContain("For GGO Med Ltd: Giangiacomo Ollandini");
        expect(copy).not.toContain("Awaiting");
        const standing = store.contractStanding("d@example.com");
        expect(standing.kind === "accepted" && standing.countersigned).toBe(true);
        expect(store.verifyChain()).toBeNull();
    });

    it("a head one record behind (a crash between the two renames) is tolerated and repaired", async () => {
        installContract(dir, "d@example.com");
        installContract(dir, "e@example.com");
        writeFileSync(path.join(dir, "contracts", "assignments.json"), JSON.stringify({
            "d@example.com": { contract_id: CONTRACT_ID, signatory_name: "Test Contractor" },
            "e@example.com": { contract_id: CONTRACT_ID, signatory_name: "Test Contractor" },
        }));
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        const first = await accept.acceptContract(acceptanceFor(s.view), ctx);
        await accept.acceptContract(acceptanceFor(s.view), { ...ctx, email: "e@example.com" });
        writeFileSync(path.join(dir, "contract-records.head"), first.record_sha256 + "\n");
        expect(store.integrityProblem()).toBeNull();
        writeFileSync(path.join(dir, "contract-records.head"), "f".repeat(64) + "\n");
        expect(store.integrityProblem()).toMatch(/head/);
    });

    it("a truncated log no longer matches its head, and access stops", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        writeFileSync(path.join(dir, "contract-records.jsonl"), "");
        expect(store.integrityProblem()).toMatch(/head/);
        expect(() => store.contractStanding("d@example.com")).toThrow(/head/);
    });

    it("a version edited in place after signing is refused, not signed under the old label", async () => {
        installContract(dir, "d@example.com");
        installContract(dir, "e@example.com");
        // One assignment file: put both people on it.
        writeFileSync(path.join(dir, "contracts", "assignments.json"), JSON.stringify({
            "d@example.com": { contract_id: CONTRACT_ID, signatory_name: "Test Contractor" },
            "e@example.com": { contract_id: CONTRACT_ID, signatory_name: "Test Contractor" },
        }));
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        const p = path.join(dir, "contracts", CONTRACT_ID, "v1.0.md");
        writeFileSync(p, readFileSync(p, "utf8").replace("100 example units", "90 example units"));
        const e = store.contractStanding("e@example.com");
        if (e.kind !== "required") throw new Error("setup");
        await expect(accept.acceptContract(acceptanceFor(e.view), { ...ctx, email: "e@example.com" })).rejects.toThrow(/new version number/);
    });

    it("a first name alone is not a signature", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await expect(accept.acceptContract(acceptanceFor(s.view, "Diletta"), { ...ctx, storeName: "Diletta" })).rejects.toThrow(/full name/);
        await expect(accept.acceptContract(acceptanceFor(s.view, "Test"), ctx)).rejects.toThrow(/full name/);
    });

    it("refuses to sign when the archived copy would not match", async () => {
        await expect(store.appendRecord({} as never, "text")).rejects.toThrow(/does not match the hash/);
    });
});

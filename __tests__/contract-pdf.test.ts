// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { acceptanceFor, installContract } from "./helpers/contract-fixture";
import { sha256 } from "../lib/contracts/contract";
import { inlineRuns, parseAgreement, renderSignedPdf } from "../lib/contracts/pdf";

/** The streams of every object of a given /Type, inflated. */
function streamsOfType(pdf: Buffer, type: string): Buffer[] {
    const out: Buffer[] = [];
    const s = pdf.toString("latin1");
    const re = new RegExp(`/Type /${type}\\b[\\s\\S]*?>>\\s*stream\\r?\\n`, "g");
    for (let m = re.exec(s); m; m = re.exec(s)) {
        const start = m.index + m[0].length;
        const end = s.indexOf("endstream", start);
        const raw = pdf.subarray(start, end);
        const header = s.slice(m.index, start);
        out.push(/FlateDecode/.test(header) ? inflateSync(raw) : raw);
    }
    return out;
}

const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("reading the agreement's Markdown", () => {
    it("turns headings, numbered clauses, bullets and the schedule break into blocks", () => {
        const blocks = parseAgreement([
            "# AGREEMENT", "", "*Services*", "", "## Parties", "", "(1) ACME LTD, a company", "", "### 1. Definitions", "",
            "1.1 In this Agreement:", "", "- \"Approval\" means approval.", "- \"Services\" means Schedule 1.", "",
            "---", "", "## Schedule 1", "", "1. Channels. Instagram.", "", "A line", "that continues.",
        ].join("\n"));
        expect(blocks).toEqual([
            { kind: "title", text: "AGREEMENT" },
            { kind: "para", label: null, text: "*Services*" },
            { kind: "section", text: "Parties" },
            { kind: "para", label: "(1)", text: "ACME LTD, a company" },
            { kind: "clause", text: "1. Definitions" },
            { kind: "para", label: "1.1", text: "In this Agreement:" },
            { kind: "bullet", text: "\"Approval\" means approval." },
            { kind: "bullet", text: "\"Services\" means Schedule 1." },
            { kind: "break" },
            { kind: "section", text: "Schedule 1" },
            { kind: "para", label: "1.", text: "Channels. Instagram." },
            { kind: "para", label: null, text: "A line that continues." },
        ]);
    });

    it("keeps every character of the words: only the emphasis markers become typography", () => {
        expect(inlineRuns("a **b** c *d* e_f_g 81-2")).toEqual([
            { text: "a ", face: "regular" }, { text: "b", face: "bold" }, { text: " c ", face: "regular" },
            { text: "d", face: "italic" }, { text: " e_f_g 81-2", face: "regular" },
        ]);
    });
});

describe("the signed copy as a PDF", () => {
    let dir: string;
    let store: typeof import("../lib/contracts/store");
    let accept: typeof import("../lib/contracts/accept");
    beforeEach(async () => {
        dir = mkdtempSync(path.join(tmpdir(), "ggo-contract-pdf-"));
        vi.stubEnv("COCKPIT_AUTH_DIR", dir);
        vi.resetModules();
        delete (globalThis as Record<string, unknown>).__ggoContractQueue;
        store = await import("../lib/contracts/store");
        accept = await import("../lib/contracts/accept");
    });
    afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

    const ctx = { email: "d@example.com", storeName: "Diletta", method: "session" as const, inviteTokenId: null, ip: "203.0.113.7", userAgent: "test" };

    it("carries the exact signed text inside it, whose hash is the one signed", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        const data = store.signedCopyData("d@example.com", s.view.sha256);
        expect(data.countersigned).toBe(false);
        expect(data.records.map((r) => r.signatory_role)).toEqual(["contractor"]);

        const pdf = await renderSignedPdf(data, { now: new Date("2030-01-02T03:04:05Z") });
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        expect(pages(pdf)).toBeGreaterThanOrEqual(1);
        const [attached] = streamsOfType(pdf, "EmbeddedFile");
        expect(attached.toString("utf8")).toBe(data.text);
        expect(sha256(attached.toString("utf8"))).toBe(s.view.sha256);
        // The hash is in the document's own metadata as well as on every page.
        expect(pdf.toString("latin1")).toContain(s.view.sha256);
    });

    it("shows the countersignature once JJ has signed", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        await accept.countersign("d@example.com", s.view.sha256, "Giangiacomo Ollandini", { email: "owner@example.com", name: "JJ", ip: "192.0.2.1", userAgent: "t" });
        const data = store.signedCopyData("d@example.com", s.view.sha256);
        expect(data.countersigned).toBe(true);
        expect(data.records.map((r) => r.signatory_role).sort()).toEqual(["company", "contractor"]);
        const pdf = await renderSignedPdf(data);
        expect(pdf.length).toBeLessThan(400_000); // the logo is embedded once, the fonts subset
    });

    it("refuses a copy whose archived text no longer matches its hash", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(path.join(dir, "contract-copies", `${s.view.sha256}.md`), "tampered");
        expect(() => store.signedCopyData("d@example.com", s.view.sha256)).toThrow(/does not match/);
    });
});

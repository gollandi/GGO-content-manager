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

/** Render and collect what was drawn on each page. */
async function traced(data: Parameters<typeof renderSignedPdf>[0]) {
    const drawn: string[][] = [];
    const pdf = await renderSignedPdf(data, { trace: (t, p) => { (drawn[p] ??= []).push(t); } });
    return { pdf, drawn };
}

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
            { kind: "para", label: null, text: "A line\nthat continues." },
        ]);
    });

    it("never invents a clause number, merges two clauses or drops a signing blank", () => {
        expect(parseAgreement("3.5 hours a week are expected.")).toEqual([{ kind: "para", label: null, text: "3.5 hours a week are expected." }]);
        expect(parseAgreement("2.1 First clause.\n2.2 Second clause.")).toEqual([
            { kind: "para", label: "2.1", text: "First clause." },
            { kind: "para", label: "2.2", text: "Second clause." },
        ]);
        expect(parseAgreement("ACME Ltd\n1 High Street\nLondon")).toEqual([{ kind: "para", label: null, text: "ACME Ltd\n1 High Street\nLondon" }]);
        expect(parseAgreement("Signed:\n\n________")).toEqual([
            { kind: "para", label: null, text: "Signed:" },
            { kind: "para", label: null, text: "________" },
        ]);
    });

    it("leaves asterisks that are not emphasis exactly as written", () => {
        const plain = (t: string) => inlineRuns(t).map((r) => r.text).join("");
        expect(inlineRuns("rate 2*3*4 units")).toEqual([{ text: "rate 2*3*4 units", face: "regular" }]);
        expect(plain("a \\*literal\\* b")).toBe("a *literal* b");
        expect(plain("snake_case_name and 5 * 3")).toBe("snake_case_name and 5 * 3");
    });

    it("keeps every character of the words: only the emphasis markers become typography", () => {
        expect(inlineRuns("a **b** c *d* e_f_g 81-2")).toEqual([
            { text: "a ", face: "regular" }, { text: "b", face: "bold" }, { text: " c ", face: "regular" },
            { text: "d", face: "italic" }, { text: " e_f_g 81-2", face: "regular" },
        ]);
    });
});

describe("laying out written line breaks", () => {
    it("starts every written line at the paragraph's edge, even after emphasis", async () => {
        const text = "# T\n\n1.1 The **Contractor** shall\nsend notices to\n**ACME Ltd**\n1 High Street\n";
        const placed: { text: string; x: number | null }[] = [];
        await renderSignedPdf({ text, contractSha: "a".repeat(64), records: [], countersigned: false, chainHead: "none" },
            { trace: (t, _p, x) => placed.push({ text: t, x }) });
        const x = (t: string) => placed.find((p) => p.text === t)?.x;
        const edge = x("The ");
        expect(edge).toEqual(expect.any(Number));
        for (const line of ["send notices to", "ACME Ltd", "1 High Street"]) expect(x(line)).toBe(edge);
    });

    it("says GGO Med has not yet countersigned until it has", async () => {
        const drawn: string[] = [];
        await renderSignedPdf({ text: "# T\n", contractSha: "a".repeat(64), records: [], countersigned: false, chainHead: "none" },
            { trace: (t) => drawn.push(t) });
        expect(drawn.join(" ")).toContain("GGO Med Ltd has not yet countersigned it.");
        expect(drawn.join(" ")).not.toContain("Both parties");
    });

    it("leaves no empty page for two breaks in a row", async () => {
        const pagesDrawn = new Set<number>();
        const pdf = await renderSignedPdf({ text: "# T\n\nA.\n\n---\n\n---\n\n## Schedule\n\nB.\n", contractSha: "a".repeat(64), records: [], countersigned: false, chainHead: "none" },
            { trace: (t, p) => { if (t === "B." || t === "A.") pagesDrawn.add(p); } });
        expect([...pagesDrawn]).toEqual([0, 1]);
        expect(pages(pdf)).toBe(2); // the text, then the schedule with the (short) signature section after it
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

        const { pdf, drawn } = await traced(data);
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        const n = pages(pdf);
        expect(drawn.length).toBe(n);
        drawn.forEach((texts, i) => {
            // Every page carries the footer: its number, the contract and the signed text's hash.
            expect(texts).toContain(`Page ${i + 1} of ${n}`);
            expect(texts).toContain(`Signed text SHA-256 ${s.view.sha256}`);
            // And something besides the running head and foot: no blank page from writing in a margin.
            const furniture = new Set([`Page ${i + 1} of ${n}`, `Signed text SHA-256 ${s.view.sha256}`, "GGO Med Ltd"]);
            expect(texts.filter((t) => !furniture.has(t) && !t.includes(" · version ")).length).toBeGreaterThan(0);
        });
        expect(drawn.flat()).toContain("Awaiting GGO Med's signature.");
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
        const { pdf, drawn } = await traced(data);
        const all = drawn.flat();
        expect(all).toContain("For GGO Med Ltd");
        expect(all).toContain("Giangiacomo Ollandini");
        expect(all).toContain("Director, for and on behalf of GGO Med Ltd");
        expect(all).not.toContain("Awaiting GGO Med's signature.");
        const records = data.records.map((r) => r.record_sha256);
        for (const h of records) expect(all).toContain(h);
        // The logo is embedded once however many pages there are: one image and its alpha mask.
        expect((pdf.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length).toBe(2);
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

    it("refuses a copy when the acceptance records have been altered", async () => {
        installContract(dir, "d@example.com");
        const s = store.contractStanding("d@example.com");
        if (s.kind !== "required") throw new Error("setup");
        await accept.acceptContract(acceptanceFor(s.view), ctx);
        const { readFileSync, writeFileSync } = await import("node:fs");
        const log = path.join(dir, "contract-records.jsonl");
        writeFileSync(log, readFileSync(log, "utf8") + readFileSync(log, "utf8"));
        expect(() => store.signedCopyData("d@example.com", s.view.sha256)).toThrow();
    });
});

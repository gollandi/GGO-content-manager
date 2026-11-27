/**
 * The signed agreement as a GGO Med document (JJ, 27 November 2026): the
 * copy either party downloads is a branded A4 PDF, not the bare text.
 *
 * Integrity stays on the text, never on the file: the signed text is the
 * Markdown whose SHA-256 the acceptance records name. This module only lays
 * that text out: the words are printed as written, while the Markdown markers
 * (`#`, `- `, `*`, `---`) and line wrapping become typography. Because a
 * layout is not the text, the PDF prints the hash on every page and embeds the
 * exact Markdown as a file, so anyone can extract it and check the hash.
 *
 * Brand: the GGO Med Design System kit (Plus Jakarta Sans, GGO Med purple,
 * the approved purple-on-white logo), copied unchanged into assets/brand.
 * pdfkit lays the pages out in plain JavaScript because the VPS has no
 * browser to print from.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { ContractRecord, SignedCopyData } from "./store";

const PURPLE = "#3208F5";
const INK = "#17161F";
const MUTED = "#5E5C6B";
const RULE = "#D9D6F5";
const PANEL = "#F6F5FE";

const PAGE = { size: "A4" as const, margins: { top: 78, bottom: 84, left: 66, right: 66 } };
const LABEL_W = 30;
const BODY = 9.6;
const LEAD = 3.2;

type Face = "regular" | "italic" | "semibold" | "bold";

function brandDir(): string {
    const dir = path.join(process.cwd(), "assets", "brand");
    if (!existsSync(path.join(dir, "PlusJakartaSans-Regular.ttf"))) {
        // Fail loud: a copy in a fallback font would not be the company document.
        throw new Error(`brand assets missing from ${dir}`);
    }
    return dir;
}

/* ── Markdown, as far as the agreements use it ─────────────────────────── */

export type Block =
    | { kind: "title"; text: string }
    | { kind: "section"; text: string }
    | { kind: "clause"; text: string }
    | { kind: "para"; label: string | null; text: string }
    | { kind: "bullet"; text: string }
    | { kind: "break" };

// "1.1 ", "12.3 ", "1. ", "(1) ", "(A) ", "(a) ", "(iv) " open a numbered paragraph. A
// numeric label must be followed by a capital, a quote or a bracket, so that a
// sentence opening with a figure ("3.5 hours a week") is never drawn as a clause number.
const LABEL = /^(?:((?:\d+\.)+\d+|\d{1,2}\.)\s+(?=["'“‘(A-Z])|(\((?:\d+|[A-Za-z]|[ivxlc]+|[IVXLC]+)\))\s+)([\s\S]*)$/;

export function parseAgreement(markdown: string): Block[] {
    const blocks: Block[] = [];
    let para: string[] = [];
    const flush = () => {
        if (para.length === 0) return;
        // Hard line breaks are kept as written (an address block stays a block).
        const joined = para.join("\n");
        const m = LABEL.exec(joined);
        blocks.push(m ? { kind: "para", label: m[1] ?? m[2], text: m[3] } : { kind: "para", label: null, text: joined });
        para = [];
    };
    for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
        const line = raw.trimEnd();
        let m: RegExpExecArray | null;
        if (!line.trim()) { flush(); continue; }
        if ((m = /^#\s+(.*)$/.exec(line))) { flush(); blocks.push({ kind: "title", text: m[1] }); continue; }
        if ((m = /^##\s+(.*)$/.exec(line))) { flush(); blocks.push({ kind: "section", text: m[1] }); continue; }
        if ((m = /^#{3,6}\s+(.*)$/.exec(line))) { flush(); blocks.push({ kind: "clause", text: m[1] }); continue; }
        // A thematic break (the line before the schedules) starts a new page. Underscores
        // are left alone: a "______" line is a blank to sign on, and is printed.
        if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flush(); blocks.push({ kind: "break" }); continue; }
        if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { flush(); blocks.push({ kind: "bullet", text: m[1] }); continue; }
        // A clause written on the line after the previous one is still its own clause
        // (as Markdown reads it too: a line opening "10. " starts a numbered item).
        if (para.length > 0 && LABEL.test(line.trim())) flush();
        para.push(line.trim());
    }
    flush();
    return blocks;
}

/**
 * Inline emphasis: `**bold**` and `*italic*` / `_italic_`, only where the markers
 * stand at a word's edge; everything else is literal, so `2*3*4` stays `2*3*4`.
 * `\*` is an escaped asterisk and prints as `*`.
 */
export function inlineRuns(text: string, base: Face = "regular"): { text: string; face: Face }[] {
    const runs: { text: string; face: Face }[] = [];
    const re = /(?<![\w\\*])\*\*(?=\S)([^*]+?)(?<=\S)\*\*(?![\w*])|(?<![\w\\*])\*(?=[^\s*])([^*]+?)(?<=[^\s\\])\*(?![\w*])|(?<![\w\\])_(?=[^\s_])([^_]+?)(?<=\S)_(?!\w)|\\([*_\\])/g;
    let at = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
        if (m.index > at) runs.push({ text: text.slice(at, m.index), face: base });
        if (m[4] !== undefined) runs.push({ text: m[4], face: base });
        else if (m[1] !== undefined) runs.push({ text: m[1], face: "bold" });
        else runs.push({ text: m[2] ?? m[3], face: base === "bold" || base === "semibold" ? base : "italic" });
        at = m.index + m[0].length;
    }
    if (at < text.length) runs.push({ text: text.slice(at), face: base });
    return runs.filter((r) => r.text.length > 0);
}

/* ── Layout ────────────────────────────────────────────────────────────── */

const longDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" });
    return `${date}, ${time} UTC`;
};

export interface PdfOptions {
    /** When the copy was made; printed on the signature page. */
    now?: Date;
    /**
     * Called with every string drawn, the page it lands on (0-based) and the x it
     * was placed at (null when it continues the previous run). The page text is
     * glyph-encoded and compressed, so tests read the layout here.
     */
    trace?: (text: string, page: number, x: number | null) => void;
}

export function renderSignedPdf(data: SignedCopyData, opts: PdfOptions = {}): Promise<Buffer> {
    const dir = brandDir();
    const now = opts.now ?? new Date();
    const contractor = data.records.find((r) => r.signatory_role === "contractor");
    const id = contractor?.contract_id ?? "agreement";
    const version = contractor?.contract_version ?? "";
    const blocks = parseAgreement(data.text);
    const title = blocks.find((b): b is Extract<Block, { kind: "title" }> => b.kind === "title")?.text ?? "Agreement";

    const doc = new PDFDocument({
        size: PAGE.size,
        margins: PAGE.margins,
        bufferPages: true,
        font: path.join(dir, "PlusJakartaSans-Regular.ttf"),
        info: {
            Title: `${title} (version ${version}, signed copy)`,
            Author: "GGO Med Ltd",
            Subject: `Signed text SHA-256 ${data.contractSha}`,
            Keywords: `${id}; ${version}`,
            CreationDate: now,
        },
        pdfVersion: "1.7",
    });
    const fonts: Record<Face, string> = {
        regular: path.join(dir, "PlusJakartaSans-Regular.ttf"),
        italic: path.join(dir, "PlusJakartaSans-Italic.ttf"),
        semibold: path.join(dir, "PlusJakartaSans-SemiBold.ttf"),
        bold: path.join(dir, "PlusJakartaSans-Bold.ttf"),
    };
    for (const [face, file] of Object.entries(fonts)) doc.registerFont(face, file);
    // Opened once: a Buffer passed to image() on every page would be embedded on every page.
    // (openImage is public pdfkit API the type package omits.)
    const logo = (doc as unknown as { openImage(src: Buffer): never }).openImage(readFileSync(path.join(dir, "ggo-med-logo-purple.png")));
    if (opts.trace) {
        const trace = opts.trace;
        const pages: unknown[] = [doc.page];
        doc.on("pageAdded", () => pages.push(doc.page));
        const draw = doc.text.bind(doc) as (...a: unknown[]) => PDFKit.PDFDocument;
        (doc as unknown as { text: (...a: unknown[]) => PDFKit.PDFDocument }).text = (...a: unknown[]) => {
            trace(String(a[0]), pages.indexOf(doc.page), typeof a[1] === "number" ? a[1] : null);
            return draw(...a);
        };
    }

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    // The exact signed text travels inside the PDF, so the hash can be checked from the file alone.
    doc.file(Buffer.from(data.text, "utf8"), {
        name: `${id}-v${version}-signed-text.md`,
        type: "text/markdown",
        description: `The exact signed text. SHA-256 ${data.contractSha}`,
    });

    const left = PAGE.margins.left;
    const width = doc.page.width - PAGE.margins.left - PAGE.margins.right;
    const bottom = () => doc.page.height - PAGE.margins.bottom;
    const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };

    const write = (text: string, x: number, w: number, face: Face, size: number, color = INK, extra: PDFKit.Mixins.TextOptions = {}) => {
        doc.fillColor(color).fontSize(size);
        // Each written line is laid out from the left edge on its own: in pdfkit's
        // continued mode a line break inside a later run would start where the
        // previous run ended and overprint the line above.
        for (const line of text.split("\n")) {
            const runs = inlineRuns(line, face);
            if (runs.length === 0) runs.push({ text: " ", face });
            runs.forEach((r, i) => {
                doc.font(r.face);
                const opts = { width: w, lineGap: LEAD, continued: i < runs.length - 1, ...extra };
                if (i === 0) doc.text(r.text, x, doc.y, opts);
                else doc.text(r.text, opts);
            });
        }
    };
    const height = (text: string, w: number, face: Face, size: number) =>
        doc.font(face).fontSize(size).heightOfString(inlineRuns(text).map((r) => r.text).join(""), { width: w, lineGap: LEAD });

    // Page 1 masthead: the approved logo, the company, the document.
    const logoH = 70;
    const logoW = (logoH * 404) / 500;
    doc.image(logo, left, 40, { height: logoH });
    doc.font("semibold").fontSize(8.4).fillColor(PURPLE)
        .text("GGO Med Ltd", left + logoW + 18, 64, { width: width - logoW - 18, align: "right", characterSpacing: 0.4 });
    doc.font("regular").fontSize(8).fillColor(MUTED)
        .text(`Signed copy · ${id} · version ${version}`, left + logoW + 18, doc.y + 2, { width: width - logoW - 18, align: "right" });
    doc.moveTo(left, 126).lineTo(left + width, 126).lineWidth(0.8).strokeColor(PURPLE).stroke();
    doc.y = 150;

    let first = true;
    for (const b of blocks) {
        switch (b.kind) {
            case "title":
                write(b.text, left, width, "bold", 17, PURPLE, { align: "center", characterSpacing: 0.3 });
                doc.moveDown(0.3);
                break;
            case "section":
                ensure(48);
                doc.moveDown(first ? 0.4 : 0.9);
                write(b.text, left, width, "bold", 11.5, PURPLE, { characterSpacing: 0.2 });
                doc.moveTo(left, doc.y + 2).lineTo(left + 36, doc.y + 2).lineWidth(1.4).strokeColor(PURPLE).stroke();
                doc.moveDown(0.6);
                break;
            case "clause":
                ensure(40);
                doc.moveDown(0.55);
                write(b.text, left, width, "semibold", 10.4, INK);
                doc.moveDown(0.3);
                break;
            case "para": {
                const x = b.label ? left + LABEL_W : left;
                const w = b.label ? width - LABEL_W : width;
                const whole = /^\*[^*]+\*$/.test(b.text.trim()) && !b.label;
                const h = height(b.text, w, "regular", BODY);
                // Keep short paragraphs whole; let long ones break across pages.
                ensure(h < 120 ? h : 30);
                const y = doc.y;
                if (b.label) doc.font("semibold").fontSize(BODY).fillColor(PURPLE).text(b.label, left, y, { width: LABEL_W - 4, lineGap: LEAD });
                doc.y = y;
                write(b.text, x, w, "regular", BODY, whole ? MUTED : INK, whole && first ? { align: "center" } : {});
                doc.moveDown(0.5);
                break;
            }
            case "bullet": {
                const x = left + LABEL_W + 14;
                const w = width - LABEL_W - 14;
                ensure(Math.min(height(b.text, w, "regular", BODY), 60));
                const y = doc.y;
                doc.circle(left + LABEL_W + 3, y + BODY * 0.62, 1.6).fillColor(PURPLE).fill();
                doc.y = y;
                write(b.text, x, w, "regular", BODY, INK);
                doc.moveDown(0.3);
                break;
            }
            case "break":
                // Two breaks in a row must not leave a page with nothing on it.
                if (doc.y > PAGE.margins.top + 1) doc.addPage();
                break;
        }
        if (b.kind === "section") first = false;
    }

    signaturePage(doc, data, { left, width, now });

    // Running head and foot on every page, now that the count is known.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const m = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // writing in the margin must not open a page
        if (i > range.start) {
            doc.image(logo, left, 30, { height: 26 });
            doc.font("semibold").fontSize(7.6).fillColor(PURPLE).text("GGO Med Ltd", left + 30, 36, { width: 200, lineBreak: false });
            doc.font("regular").fontSize(7.6).fillColor(MUTED).text(title, left + 30, 46, { width: width - 30, lineBreak: false });
            doc.moveTo(left, 62).lineTo(left + width, 62).lineWidth(0.5).strokeColor(RULE).stroke();
        }
        const fy = doc.page.height - 56;
        doc.moveTo(left, fy - 8).lineTo(left + width, fy - 8).lineWidth(0.5).strokeColor(RULE).stroke();
        doc.font("regular").fontSize(7.4).fillColor(MUTED)
            .text(`${id} · version ${version}`, left, fy, { width: width / 2, lineBreak: false });
        doc.font("semibold").fontSize(7.4).fillColor(INK)
            .text(`Page ${i - range.start + 1} of ${range.count}`, left + width / 2, fy, { width: width / 2, align: "right", lineBreak: false });
        doc.font("regular").fontSize(6.4).fillColor(MUTED)
            .text(`Signed text SHA-256 ${data.contractSha}`, left, fy + 12, { width, lineBreak: false });
        doc.page.margins.bottom = m;
    }
    doc.end();
    return done;
}

function signaturePage(doc: PDFKit.PDFDocument, data: SignedCopyData, { left, width, now }: { left: number; width: number; now: Date }) {
    // The signatures are read together: follow on only when the whole section fits
    // (heading, explanation, every signature, the pending panel and the closing lines);
    // otherwise it starts on a fresh page.
    const section = 150 + data.records.reduce((h, r) => h + boxHeight(doc, r, width) + 14, 0) + (data.countersigned ? 0 : 72) + 90;
    if (doc.y + 30 + section > doc.page.height - doc.page.margins.bottom) doc.addPage();
    else doc.moveDown(2.2);
    doc.font("bold").fontSize(15).fillColor(PURPLE).text("Electronic signatures", left, doc.y, { width });
    doc.moveTo(left, doc.y + 3).lineTo(left + 36, doc.y + 3).lineWidth(1.4).strokeColor(PURPLE).stroke();
    doc.moveDown(0.9);
    doc.font("regular").fontSize(BODY).fillColor(INK).text(
        (data.countersigned
            ? "Both parties accepted this Agreement electronically in the GGO Cockpit."
            : "The Contractor accepted this Agreement electronically in the GGO Cockpit; GGO Med Ltd has not yet countersigned it.")
        + " Every acceptance is an entry in GGO Med Ltd's "
        + "hash-chained acceptance record. What was signed is the text itself: its SHA-256, printed below and at the foot of "
        + "every page, is the hash each acceptance names. The exact text is attached to this PDF as a file, so the hash can be "
        + "checked from this document alone.",
        left, doc.y, { width, lineGap: LEAD },
    );
    doc.moveDown(1);

    const order = (r: ContractRecord) => (r.signatory_role === "contractor" ? 0 : 1);
    const records = [...data.records].sort((a, b) => order(a) - order(b));
    for (const r of records) signatureBox(doc, r, left, width);
    if (!data.countersigned) {
        if (doc.y + 72 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        doc.roundedRect(left, y, width, 58, 4).lineWidth(0.8).dash(3, { space: 3 }).strokeColor(PURPLE).stroke().undash();
        doc.font("semibold").fontSize(10).fillColor(PURPLE).text("For GGO Med Ltd", left + 16, y + 14, { width: width - 32 });
        doc.font("regular").fontSize(BODY).fillColor(MUTED).text("Awaiting GGO Med's signature.", left + 16, doc.y + 3, { width: width - 32 });
        doc.y = y + 58 + 14;
    }

    doc.moveDown(0.6);
    // The closing facts stay together: a label must never sit on one page and its hash on the next.
    if (doc.y + 110 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const meta: [string, string][] = [
        ["Signed text SHA-256", data.contractSha],
        ["Record chain head when this copy was made", data.chainHead],
        ["Copy made", longDate(now.toISOString())],
    ];
    for (const [k, v] of meta) {
        doc.font("semibold").fontSize(7.8).fillColor(MUTED).text(k, left, doc.y, { width });
        doc.font("regular").fontSize(7.8).fillColor(INK).text(v, left, doc.y + 1, { width });
        doc.moveDown(0.45);
    }
}

const BOX = { pad: 14, keyW: 112, size: 8, gap: 0.8, rowGap: 2.6 };

function boxRows(r: ContractRecord): [string, string][] {
    const company = r.signatory_role === "company";
    return [
        ["Name", r.signatory_name_typed],
        ["Role", company ? "Director, for and on behalf of GGO Med Ltd" : "Contractor"],
        ["Email", r.signatory_email],
        ["Signed", longDate(r.accepted_at_utc)],
        ["Method", r.auth_evidence.method === "invitation" ? "Personal invitation link, typed name" : "Signed-in cockpit session, typed name"],
        ["From IP address", r.ip_address],
        ["Version", r.contract_version],
        ["Signed text SHA-256", r.contract_sha256],
        ["Acceptance record", r.record_id],
        ["Record SHA-256", r.record_sha256],
    ];
}

function boxHeight(doc: PDFKit.PDFDocument, r: ContractRecord, width: number): number {
    const valW = width - BOX.pad * 2 - BOX.keyW;
    doc.font("regular").fontSize(BOX.size);
    const rowsH = boxRows(r).reduce((h, [, v]) => h + doc.heightOfString(v, { width: valW, lineGap: BOX.gap }) + BOX.rowGap, 0);
    return BOX.pad + 18 + rowsH + BOX.pad - BOX.rowGap;
}

function signatureBox(doc: PDFKit.PDFDocument, r: ContractRecord, left: number, width: number) {
    const company = r.signatory_role === "company";
    const rows = boxRows(r);
    const pad = BOX.pad;
    const keyW = BOX.keyW;
    const valW = width - pad * 2 - keyW;
    const boxH = boxHeight(doc, r, width);
    if (doc.y + boxH > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    doc.roundedRect(left, y, width, boxH, 4).fillColor(PANEL).fill();
    doc.rect(left, y, 3, boxH).fillColor(PURPLE).fill();
    doc.font("semibold").fontSize(10).fillColor(PURPLE).text(company ? "For GGO Med Ltd" : "Contractor", left + pad, y + pad - 2, { width: width - pad * 2 });
    let ry = y + pad + 18;
    for (const [k, v] of rows) {
        doc.font("semibold").fontSize(7.8).fillColor(MUTED).text(k, left + pad, ry + 0.6, { width: keyW - 8 });
        doc.font("regular").fontSize(BOX.size).fillColor(INK).text(v, left + pad + keyW, ry, { width: valW, lineGap: BOX.gap });
        ry = doc.y + BOX.rowGap;
    }
    doc.y = y + boxH + 14;
}

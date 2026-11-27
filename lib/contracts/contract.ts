/**
 * A collaborator's contract, as the onboarding shows it and the acceptance
 * record proves it. Pure: parsing, rendering, hashing and the gates. The
 * files themselves live outside git (./store.ts): a contract names a real
 * person and her business, and the record holds personal data.
 *
 * Three gates, from the contract's own onboarding copy (JJ, 26 Nov 2026):
 *  1. No acceptance on a draft: status FINAL and every variable decided by JJ.
 *  2. No access before acceptance (enforced in lib/auth/api-guard.ts).
 *  3. The text she sees is the text she accepts: the hash is taken over the
 *     rendered text; any change to text or a variable is a new version.
 */
import { createHash } from "node:crypto";

export interface ContractVariable { value: string; decided_by_jj: boolean }

export interface ContractFile {
    contract_id: string;
    contract_version: string;
    status: string;
    language?: string;
    governing_law?: string;
    variables: Record<string, ContractVariable>;
    body: string;
}

/**
 * `userFacing` errors are written for the person signing and may be shown to
 * them; anything else names server detail and stays in the log.
 */
export class ContractError extends Error {
    constructor(message: string, readonly userFacing = false) { super(message); }
}
export const userMessage = (err: unknown, fallback = "Non riesco ad aprire l'accordo. GGO Med è stata avvisata; riprova più tardi.") =>
    err instanceof ContractError && err.userFacing ? err.message : fallback;

const unquote = (v: string) => {
    const t = v.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1).replace(/\\"/g, '"');
    }
    return t;
};
const stripComment = (v: string) => {
    // A comment starts at " #" outside quotes.
    let quote: string | null = null;
    for (let i = 0; i < v.length; i++) {
        const c = v[i];
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === "#" && (i === 0 || v[i - 1] === " ")) return v.slice(0, i);
    }
    return v;
};

/**
 * The front matter is the narrow YAML the contract files use: top-level
 * scalars, and `variables:` mapping each name to `value` and `decided_by_jj`.
 * Anything else is refused, not guessed at.
 */
export function parseContract(md: string): ContractFile {
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(md.replace(/\r\n?/g, "\n"));
    if (!m) throw new ContractError("contract has no front matter");
    const [, yaml, body] = m;
    const out: Record<string, unknown> = { variables: {} };
    const vars = out.variables as Record<string, Partial<ContractVariable>>;
    let section: "top" | "variables" = "top";
    let current: string | null = null;
    for (const raw of yaml.split("\n")) {
        const line = stripComment(raw).replace(/\s+$/, "");
        if (!line.trim()) continue;
        const indent = line.length - line.trimStart().length;
        const kv = /^\s*([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
        if (!kv) throw new ContractError(`front matter line not understood: ${raw.trim()}`);
        const [, key, value] = kv;
        if (indent === 0) {
            current = null;
            if (key === "variables") { section = "variables"; continue; }
            section = "top";
            out[key] = unquote(value);
        } else if (section === "variables" && indent === 2) {
            current = key;
            vars[key] = {};
        } else if (section === "variables" && indent === 4 && current) {
            if (key === "value") vars[current].value = unquote(value);
            else if (key === "decided_by_jj") vars[current].decided_by_jj = value.trim() === "true";
            else throw new ContractError(`unknown variable field ${key}`);
        } else {
            throw new ContractError(`front matter line not understood: ${raw.trim()}`);
        }
    }
    for (const key of ["contract_id", "contract_version", "status"]) {
        if (typeof out[key] !== "string" || !(out[key] as string)) throw new ContractError(`front matter needs ${key}`);
    }
    for (const [name, v] of Object.entries(vars)) {
        if (typeof v.value !== "string" || typeof v.decided_by_jj !== "boolean") throw new ContractError(`variable ${name} needs value and decided_by_jj`);
    }
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(out.contract_id as string)) throw new ContractError("contract_id must be a lowercase slug");
    if (!/^\d+(\.\d+)*$/.test(out.contract_version as string)) throw new ContractError("contract_version must look like 1.1");
    return { ...(out as Omit<ContractFile, "body" | "variables">), variables: vars as Record<string, ContractVariable>, body };
}

/** Fill {{variables}}. Fails loud on a placeholder with no value. */
export function fill(text: string, values: Record<string, string>): string {
    return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, name: string) => {
        if (!(name in values)) throw new ContractError(`no value for {{${name}}}`);
        return values[name];
    });
}

export function values(c: ContractFile): Record<string, string> {
    const v: Record<string, string> = { contract_version: c.contract_version, contract_id: c.contract_id };
    for (const [k, x] of Object.entries(c.variables)) v[k] = x.value;
    return v;
}

/** The text shown and hashed: variables filled, line endings normalised, trailing space trimmed. */
export function render(c: ContractFile): string {
    return fill(c.body, values(c)).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim() + "\n";
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Gate 1: may this version be accepted at all? */
export function acceptability(c: ContractFile): { ok: true } | { ok: false; reason: string } {
    if (c.status !== "FINAL") {
        const words = c.status.replace(/_/g, " ").toLowerCase().replace(/\bjj\b/g, "JJ");
        return { ok: false, reason: `Questa versione non è ancora definitiva (${words}): puoi leggerla ora e firmarla quando GGO Med la conferma.` };
    }
    const open = Object.entries(c.variables).filter(([, v]) => !v.decided_by_jj).map(([k]) => k);
    if (open.length) return { ok: false, reason: `Condizioni ancora da definire da parte di GGO Med: ${open.join(", ")}.` };
    return { ok: true };
}

export interface Section { key: string; heading: string; text: string }

/**
 * The rendered contract in sections, keyed as the summary cards name them:
 * "Parties", "Background", "1"…"17" for clauses, "Schedule 1"… for schedules.
 */
export function sections(rendered: string): Section[] {
    const out: Section[] = [];
    let cur: Section | null = null;
    for (const line of rendered.split("\n")) {
        const h = /^(##|###)\s+(.+)$/.exec(line);
        if (h) {
            const heading = h[2].trim();
            const clause = /^(\d+)\.\s/.exec(heading);
            const schedule = /^Schedule\s+(\d+)/i.exec(heading);
            const key = clause ? clause[1] : schedule ? `Schedule ${schedule[1]}` : heading;
            if (cur) out.push(cur);
            cur = { key, heading, text: "" };
            continue;
        }
        if (cur) cur.text += line + "\n";
    }
    if (cur) out.push(cur);
    return out.map((s) => ({ ...s, text: s.text.trim() }));
}

export interface CopyCard { title: string; sections: string[]; summary: string }
export interface OnboardingCopy {
    welcome: string;
    howWeWork: string[];
    cards: CopyCard[];
    acceptance: { heading: string; checkboxes: string[]; namePrompt: string; intent: string; button: string };
    done: string;
    countersign: { intent: string; button: string };
}

export interface CardView { title: string; summary: string; clauses: Section[] }

/** The cards with their summaries filled and the exact clauses under each. Every card must find its clauses. */
export function cardViews(copy: OnboardingCopy, c: ContractFile, rendered: string): CardView[] {
    const all = sections(rendered);
    const v = values(c);
    return copy.cards.map((card) => {
        const clauses = card.sections.flatMap((key) => all.filter((s) => s.key === key));
        if (clauses.length === 0) throw new ContractError(`card "${card.title}" names no clause of the contract`);
        return { title: card.title, summary: fill(card.summary, v), clauses };
    });
}

export function acceptanceWording(copy: OnboardingCopy, c: ContractFile): OnboardingCopy["acceptance"] {
    const v = values(c);
    return {
        heading: fill(copy.acceptance.heading, v),
        checkboxes: copy.acceptance.checkboxes.map((t) => fill(t, v)),
        namePrompt: fill(copy.acceptance.namePrompt, v),
        intent: fill(copy.acceptance.intent, v),
        button: fill(copy.acceptance.button, v),
    };
}

/** The exact wording shown, as one string, for its hash. */
export function acceptanceText(w: OnboardingCopy["acceptance"]): string {
    return [w.heading, ...w.checkboxes.map((t) => `[ ] ${t}`), w.namePrompt, w.intent, w.button].join("\n");
}

/** Case- and accent-insensitive comparison of a typed signature with a name. */
export function sameName(a: string, b: string): boolean {
    const n = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}]+/gu, " ").trim();
    return n(a).length > 1 && n(a) === n(b);
}

/** Version order: "1.10" after "1.9". */
export function compareVersions(a: string, b: string): number {
    const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d) return d;
    }
    return 0;
}

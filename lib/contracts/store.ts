/**
 * Contracts and their acceptance records, on disk beside the user store and
 * outside git and the deploy tree (on the VPS: /var/lib/ggo-cockpit/auth/).
 *
 *   contracts/assignments.json            { "<email>": { contract_id, signatory_name } }
 *   contracts/<id>/v<version>.md          the contract, front matter + body
 *   contracts/<id>/v<version>.copy.json   the onboarding copy (tools/contracts/copy-to-json.mjs)
 *   contract-records.jsonl                append-only acceptance records, hash-chained
 *   contract-copies/<sha256>.md           the exact rendered text each record names
 *
 * The version in force for a person is the newest FINAL version of their
 * contract. A newer draft is shown to read but cannot be signed; a newer
 * FINAL version asks for a fresh acceptance.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { authDir } from "../auth/users";
import {
    acceptability, acceptanceText, acceptanceWording, cardViews, compareVersions, ContractError, parseContract, render, sha256, values,
    type CardView, type ContractFile, type OnboardingCopy,
} from "./contract";

const dir = () => path.join(authDir(), "contracts");
const recordsPath = () => path.join(authDir(), "contract-records.jsonl");
const copiesDir = () => path.join(authDir(), "contract-copies");
const norm = (email: string) => email.trim().toLowerCase();

export interface Assignment { contract_id: string; signatory_name: string }

export function assignmentFor(email: string): Assignment | null {
    const p = path.join(dir(), "assignments.json");
    if (!existsSync(p)) return null;
    const all = JSON.parse(readFileSync(p, "utf8")) as Record<string, Assignment>;
    const a = all[norm(email)];
    if (!a) return null;
    if (!a.contract_id || !a.signatory_name) throw new ContractError(`assignment for this person is incomplete`);
    return a;
}

function versions(contractId: string): ContractFile[] {
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(contractId)) throw new ContractError("bad contract id");
    const d = path.join(dir(), contractId);
    if (!existsSync(d)) throw new ContractError(`contract ${contractId} is not on the server`);
    return readdirSync(d).filter((f) => /^v[\d.]+\.md$/.test(f))
        .map((f) => {
            const c = parseContract(readFileSync(path.join(d, f), "utf8"));
            if (c.contract_id !== contractId || `v${c.contract_version}.md` !== f) throw new ContractError(`${f} does not match its own front matter`);
            return c;
        })
        .sort((a, b) => compareVersions(a.contract_version, b.contract_version));
}

function copyFor(c: ContractFile): OnboardingCopy {
    const p = path.join(dir(), c.contract_id, `v${c.contract_version}.copy.json`);
    if (!existsSync(p)) throw new ContractError(`onboarding copy for ${c.contract_id} v${c.contract_version} is not on the server`);
    return JSON.parse(readFileSync(p, "utf8")) as OnboardingCopy;
}

export interface ContractView {
    contractId: string;
    version: string;
    status: string;
    signable: boolean;
    notSignableReason: string | null;
    text: string;
    sha256: string;
    /** The filled variables (also inside the hashed text). */
    variables: Record<string, string>;
    signatoryName: string;
    welcome: string;
    howWeWork: string[];
    cards: CardView[];
    acceptance: OnboardingCopy["acceptance"];
    acceptanceSha256: string;
    done: string;
}

/** What to show this person: the version in force if any, else the newest draft (to read only). */
export function viewFor(email: string): ContractView | null {
    const a = assignmentFor(email);
    if (!a) return null;
    const all = versions(a.contract_id);
    if (all.length === 0) throw new ContractError(`contract ${a.contract_id} has no version on the server`);
    const finals = all.filter((c) => acceptability(c).ok);
    const c = finals.at(-1) ?? all.at(-1)!;
    return toView(c, a);
}

function toView(c: ContractFile, a: Assignment): ContractView {
    const copy = copyFor(c);
    const text = render(c);
    const gate = acceptability(c);
    const acceptance = acceptanceWording(copy, c);
    return {
        contractId: c.contract_id, version: c.contract_version, status: c.status,
        signable: gate.ok, notSignableReason: gate.ok ? null : gate.reason,
        text, sha256: sha256(text), variables: values(c), signatoryName: a.signatory_name,
        welcome: copy.welcome, howWeWork: copy.howWeWork, cards: cardViews(copy, c, text),
        acceptance, acceptanceSha256: sha256(acceptanceText(acceptance)), done: copy.done,
    };
}

export function countersignWording(contractId: string, version: string): OnboardingCopy["countersign"] {
    const c = versions(contractId).find((v) => v.contract_version === version);
    if (!c) throw new ContractError("no such version");
    return copyFor(c).countersign;
}

export interface ContractRecord {
    record_id: string;
    contract_id: string;
    contract_version: string;
    contract_sha256: string;
    variables_snapshot: Record<string, string>;
    signatory_role: "contractor" | "company";
    signatory_name_typed: string;
    signatory_user_id: string;
    signatory_email: string;
    /** For a company record: the contractor's email it countersigns. */
    countersigns?: string;
    auth_evidence: { method: "invitation" | "session"; invite_token_id: string | null; mfa: false; session_id: null };
    checkbox_states: { text: string; checked_at: string }[];
    viewed_sections: { key: string; at: string }[];
    reached_end_at: string | null;
    pdf_downloaded_at: string | null;
    accepted_at_utc: string;
    ip_address: string;
    user_agent: string;
    acceptance_statement_sha256: string;
    confirmation_email_ids: string[];
    notes: string[];
    previous_record_sha256: string | null;
    record_sha256: string;
}

export function readRecords(): ContractRecord[] {
    if (!existsSync(recordsPath())) return [];
    return readFileSync(recordsPath(), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as ContractRecord);
}

/** Recompute the chain; null when intact, else the first broken record. */
export function verifyChain(records = readRecords()): string | null {
    let prev: string | null = null;
    for (const r of records) {
        const { record_sha256, ...rest } = r;
        if (r.previous_record_sha256 !== prev || sha256(JSON.stringify(rest)) !== record_sha256) return r.record_id;
        prev = record_sha256;
    }
    return null;
}

/** The contractor's accepted record for the version in force, or null. */
export function acceptedRecord(email: string): ContractRecord | null {
    const view = viewFor(email);
    if (!view || !view.signable) return null;
    return readRecords().find((r) => r.signatory_role === "contractor" && r.signatory_email === norm(email)
        && r.contract_id === view.contractId && r.contract_version === view.version && r.contract_sha256 === view.sha256) ?? null;
}

export type Standing =
    | { kind: "accepted"; record: ContractRecord; countersigned: boolean }
    | { kind: "required"; view: ContractView }
    | { kind: "unassigned" };

/** Gate 2's question: may this collaborator see data? Errors refuse (fail closed). */
export function contractStanding(email: string): Standing {
    const view = viewFor(email);
    if (!view) return { kind: "unassigned" };
    const record = view.signable ? acceptedRecord(email) : null;
    if (!record) return { kind: "required", view };
    const countersigned = readRecords().some((r) => r.signatory_role === "company" && r.countersigns === norm(email)
        && r.contract_version === record.contract_version && r.contract_sha256 === record.contract_sha256);
    return { kind: "accepted", record, countersigned };
}

// One writer at a time (as the user store): the chain must not fork.
const g = globalThis as { __ggoContractQueue?: Promise<unknown> };
function serialise<T>(task: () => T | Promise<T>): Promise<T> {
    const run = (g.__ggoContractQueue ?? Promise.resolve()).then(task, task);
    g.__ggoContractQueue = run.catch(() => undefined);
    return run;
}

export function appendRecord(fields: Omit<ContractRecord, "record_id" | "previous_record_sha256" | "record_sha256">, text: string): Promise<ContractRecord> {
    return serialise(() => {
        if (sha256(text) !== fields.contract_sha256) throw new ContractError("the archived text does not match the hash");
        const records = readRecords();
        if (verifyChain(records) !== null) throw new ContractError("the acceptance records do not verify; refusing to append");
        const previous = records.at(-1)?.record_sha256 ?? null;
        const body = { record_id: `${fields.contract_id}-${fields.contract_version}-${fields.signatory_role}-${Date.parse(fields.accepted_at_utc)}`, ...fields, previous_record_sha256: previous };
        const record: ContractRecord = { ...body, record_sha256: sha256(JSON.stringify(body)) };
        mkdirSync(copiesDir(), { recursive: true, mode: 0o700 });
        const copy = path.join(copiesDir(), `${fields.contract_sha256}.md`);
        if (!existsSync(copy)) {
            const tmp = `${copy}.tmp`;
            writeFileSync(tmp, text, { mode: 0o600 });
            renameSync(tmp, copy);
        }
        appendFileSync(recordsPath(), JSON.stringify(record) + "\n", { mode: 0o600 });
        return record;
    });
}

/** The exact text a record names. */
export function archivedText(contractSha: string): string {
    if (!/^[0-9a-f]{64}$/.test(contractSha)) throw new ContractError("bad hash");
    const p = path.join(copiesDir(), `${contractSha}.md`);
    const text = readFileSync(p, "utf8");
    if (sha256(text) !== contractSha) throw new ContractError("the archived copy does not match its hash");
    return text;
}

/** The signed copy to download: the contract text, then a signature page from the records. */
export function signedCopy(contractorEmail: string, contractSha: string): string {
    const text = archivedText(contractSha);
    const records = readRecords().filter((r) => r.contract_sha256 === contractSha
        && ((r.signatory_role === "contractor" && r.signatory_email === norm(contractorEmail)) || (r.signatory_role === "company" && r.countersigns === norm(contractorEmail))));
    const lines = records.map((r) => [
        `- ${r.signatory_role === "company" ? "For GGO Med Ltd" : "Contractor"}: ${r.signatory_name_typed} (${r.signatory_email})`,
        `  signed ${r.accepted_at_utc} from ${r.ip_address}; version ${r.contract_version}; contract SHA-256 ${r.contract_sha256}; record ${r.record_sha256}`,
    ].join("\n"));
    const pending = records.some((r) => r.signatory_role === "company") ? "" : "\n\nAwaiting GGO Med's signature.";
    return `${text}\n---\n\n## Electronic signatures\n\n${lines.join("\n") || "None yet."}${pending}\n`;
}

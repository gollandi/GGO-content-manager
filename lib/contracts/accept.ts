/**
 * Signing: the checks on what the onboarding screen sends, then the record.
 * Server time, server-rendered text: the client says only what it showed and
 * when the person ticked, read and typed.
 */
import { sameName } from "./contract";
import { appendRecord, archivedText, countersignWording, readRecords, viewFor, type ContractRecord } from "./store";
import { ContractError, sha256 } from "./contract";

export interface AcceptanceInput {
    contractId: string;
    version: string;
    sha256: string;
    acceptanceSha256: string;
    typedName: string;
    checkboxes: { checkedAt: string }[];
    viewedSections: { key: string; at: string }[];
    reachedEndAt: string | null;
    downloadedAt?: string | null;
}

export interface SigningContext {
    email: string;
    storeName: string;
    method: "invitation" | "session";
    inviteTokenId: string | null;
    ip: string;
    userAgent: string;
    now?: Date;
}

const iso = (v: unknown): string | null => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

/** Validate and record a contractor's acceptance of the version in force. */
export async function acceptContract(input: AcceptanceInput, ctx: SigningContext): Promise<ContractRecord> {
    const view = viewFor(ctx.email);
    if (!view) throw new ContractError("No agreement has been prepared for you yet. GGO Med will be in touch.", true);
    if (!view.signable) throw new ContractError(view.notSignableReason ?? "This version cannot be signed.", true);
    if (input?.contractId !== view.contractId || input.version !== view.version || input.sha256 !== view.sha256) {
        throw new ContractError("The agreement has changed since this page was opened. Reload it and read the current version.", true);
    }
    if (input.acceptanceSha256 !== view.acceptanceSha256) throw new ContractError("The acceptance wording has changed. Reload the page.", true);
    const ticks = Array.isArray(input.checkboxes) ? input.checkboxes.map((c) => iso(c?.checkedAt)) : [];
    if (ticks.length !== view.acceptance.checkboxes.length || ticks.some((t) => !t)) throw new ContractError("Tick each statement to accept.", true);
    const reached = iso(input.reachedEndAt);
    if (!reached) throw new ContractError("Read the agreement to the end before signing.", true);
    const typed = String(input.typedName ?? "").trim();
    // The full name only: a first name alone is weak evidence of an intent
    // to sign (contract copy v1.2).
    if (!sameName(typed, view.signatoryName)) {
        throw new ContractError(`Type your full name as it appears in the agreement (${view.signatoryName}).`, true);
    }
    const email = ctx.email.trim().toLowerCase();
    const now = ctx.now ?? new Date();
    const sections = Array.isArray(input.viewedSections) ? input.viewedSections : [];
    return appendRecord({
        contract_id: view.contractId,
        contract_version: view.version,
        contract_sha256: view.sha256,
        variables_snapshot: view.variables,
        signatory_role: "contractor",
        signatory_name_typed: typed,
        signatory_user_id: email,
        signatory_email: email,
        auth_evidence: { method: ctx.method, invite_token_id: ctx.inviteTokenId, mfa: false, session_id: null },
        checkbox_states: view.acceptance.checkboxes.map((text, i) => ({ text, checked_at: ticks[i]! })),
        viewed_sections: sections.slice(0, 100).map((s) => ({ key: String(s?.key ?? "").slice(0, 80), at: iso(s?.at) ?? "invalid" })),
        reached_end_at: reached,
        pdf_downloaded_at: iso(input.downloadedAt),
        accepted_at_utc: now.toISOString(),
        ip_address: ctx.ip,
        user_agent: ctx.userAgent.slice(0, 400),
        acceptance_statement_sha256: view.acceptanceSha256,
        onboarding_copy_sha256: view.copySha256,
        notes: [
            "Times in checkbox_states, viewed_sections, reached_end_at and pdf_downloaded_at are the browser's; accepted_at_utc is the server's.",
            "The cockpit has no second factor and no email service: mfa is false; both parties download the signed copy from the cockpit, and each download is logged in contract-downloads.jsonl.",
        ],
    }, view.text, (records) => {
        // Gate 3: one version number, one text, one copy. A version edited in
        // place is refused rather than signed under a label it no longer means.
        const same = records.filter((r) => r.contract_id === view.contractId && r.contract_version === view.version);
        if (same.some((r) => r.contract_sha256 !== view.sha256 || (r.onboarding_copy_sha256 && r.onboarding_copy_sha256 !== view.copySha256))) {
            throw new ContractError("This version was changed after it was signed; GGO Med must issue it under a new version number.", true);
        }
        return records.find((r) => r.signatory_role === "contractor" && r.signatory_email === email && r.contract_sha256 === view.sha256) ?? null;
    });
}

/** JJ countersigns a contractor's accepted version, for GGO Med Ltd. */
export async function countersign(contractorEmail: string, contractSha: string, typedName: string, ctx: { email: string; name: string; ip: string; userAgent: string; now?: Date }): Promise<ContractRecord> {
    const email = contractorEmail.trim().toLowerCase();
    const theirs = readRecords().filter((r) => r.signatory_role === "contractor" && r.signatory_email === email).at(-1);
    if (!theirs) throw new ContractError("There is no signed agreement from this person to countersign.", true);
    if (theirs.contract_sha256 !== contractSha) {
        throw new ContractError("That is not the version this person last signed; reload Settings.", true);
    }
    const inForce = viewFor(email);
    if (!inForce?.signable || inForce.sha256 !== theirs.contract_sha256) {
        throw new ContractError("The version this person signed is no longer the one in force; they sign the current one first.", true);
    }

    const t = String(typedName ?? "").trim();
    if (!sameName(t, "Giangiacomo Ollandini")) throw new ContractError("Type your full name as GGO Med's director (Giangiacomo Ollandini).", true);
    const wording = countersignWording(theirs.contract_id, theirs.contract_version);
    const now = ctx.now ?? new Date();
    return appendRecord({
        contract_id: theirs.contract_id,
        contract_version: theirs.contract_version,
        contract_sha256: theirs.contract_sha256,
        variables_snapshot: theirs.variables_snapshot,
        signatory_role: "company",
        signatory_name_typed: t,
        signatory_user_id: ctx.email.trim().toLowerCase(),
        signatory_email: ctx.email.trim().toLowerCase(),
        countersigns: email,
        auth_evidence: { method: "session", invite_token_id: null, mfa: false, session_id: null },
        checkbox_states: [],
        viewed_sections: [],
        reached_end_at: null,
        pdf_downloaded_at: null,
        accepted_at_utc: now.toISOString(),
        ip_address: ctx.ip,
        user_agent: ctx.userAgent.slice(0, 400),
        acceptance_statement_sha256: sha256(`${wording.intent}\n${wording.button}`),
        notes: ["The cockpit has no second factor and no email service."],
    }, archivedText(theirs.contract_sha256), (records) => {
        if (records.some((r) => r.signatory_role === "company" && r.countersigns === email && r.contract_sha256 === theirs.contract_sha256)) {
            throw new ContractError("Already countersigned.", true);
        }
        return null;
    });
}

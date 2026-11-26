import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FIX = path.join(__dirname, "../fixtures/contracts");
export const CONTRACT_ID = "test-contractor-agreement";

/** Put the placeholder contract on "the server" (an auth dir) and assign it to `email`. */
export function installContract(authDir: string, email: string, opts: { status?: string; signatory?: string } = {}) {
    const d = path.join(authDir, "contracts", CONTRACT_ID);
    mkdirSync(d, { recursive: true });
    const md = readFileSync(path.join(FIX, "v1.0.md"), "utf8").replace("status: FINAL", `status: ${opts.status ?? "FINAL"}`);
    writeFileSync(path.join(d, "v1.0.md"), md);
    copyFileSync(path.join(FIX, "v1.0.copy.json"), path.join(d, "v1.0.copy.json"));
    writeFileSync(path.join(authDir, "contracts", "assignments.json"),
        JSON.stringify({ [email.toLowerCase()]: { contract_id: CONTRACT_ID, signatory_name: opts.signatory ?? "Test Contractor" } }));
}

/** What the onboarding page sends after reading everything and ticking every box. */
export function acceptanceFor(view: { contractId: string; version: string; sha256: string; acceptanceSha256: string; acceptance: { checkboxes: string[] } }, typedName = "Test Contractor") {
    const at = new Date().toISOString();
    return {
        contractId: view.contractId, version: view.version, sha256: view.sha256, acceptanceSha256: view.acceptanceSha256,
        typedName, checkboxes: view.acceptance.checkboxes.map(() => ({ checkedAt: at })),
        viewedSections: [{ key: "Who we are", at }], reachedEndAt: at, downloadedAt: null,
    };
}

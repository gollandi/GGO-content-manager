import type { RunMeta } from "./store";

export type ProposalApprovalGate =
    | { ok: true }
    | { ok: false; reason: string };

export function canApproveProposal(
    meta: Pick<RunMeta, "proposal" | "proposalApproved" | "status">
): ProposalApprovalGate {
    if (meta.status === "archived") {
        return { ok: false, reason: "Run archiviato: aprine uno nuovo" };
    }
    if (!meta.proposal) {
        return { ok: false, reason: "Nessuna proposta da approvare" };
    }
    if (meta.proposalApproved) {
        return { ok: false, reason: "Proposta gia approvata" };
    }
    if (meta.status !== "awaiting-jj") {
        return { ok: false, reason: "Il run non aspetta una decisione di JJ" };
    }
    return { ok: true };
}

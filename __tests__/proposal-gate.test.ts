// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canApproveProposal } from "../lib/runner/proposal-gate";
import type { RunMeta } from "../lib/runner/store";

const meta = (overrides: Partial<RunMeta> = {}): RunMeta => ({
    runId: "run-1",
    skill: "ggomed-page-writer-v2",
    brief: "brief",
    title: "brief",
    status: "awaiting-jj",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    drafts: [],
    science: [],
    criticsCleared: false,
    proposalApproved: false,
    proposal: {
        proposalMarkdown: "# Proposal",
        deliverables: [],
        interactiveSections: [],
    },
    summary: null,
    turnsUsed: 1,
    ...overrides,
});

describe("proposal approval gate", () => {
    it("allows approval only when a pending proposal waits for JJ", () => {
        expect(canApproveProposal(meta())).toEqual({ ok: true });
    });

    it("rejects approval without an outstanding proposal", () => {
        expect(canApproveProposal(meta({ proposal: null })).ok).toBe(false);
    });

    it("rejects approval after a proposal has already been approved", () => {
        expect(canApproveProposal(meta({ proposalApproved: true })).ok).toBe(false);
    });

    it("rejects approval while the run is not waiting for JJ", () => {
        expect(canApproveProposal(meta({ status: "running" })).ok).toBe(false);
    });

    it("rejects approval for archived runs", () => {
        expect(canApproveProposal(meta({ status: "archived" })).ok).toBe(false);
    });
});

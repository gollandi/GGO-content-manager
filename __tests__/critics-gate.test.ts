// @vitest-environment node
import { describe, it, expect } from "vitest";
import { dispatchTool, type ToolContext } from "../lib/runner/tools";

/**
 * The Tatiana/Aspasia gate is enforced in CODE, not just in the prompt:
 * finish refuses until run_critics has reviewed the current draft state,
 * and any draft mutation re-arms the gate.
 */

const makeCtx = (over: Partial<ToolContext> = {}): ToolContext => ({
    drafts: [{ draftId: "drafts.cockpit-x", docType: "blogPost", title: "T" }],
    finished: null,
    science: [],
    criticsCleared: false,
    proposalApproved: true,
    proposal: null,
    pause: null,
    runCritics: async () => ({ tatiana: "APPROVED", aspasia: "APPROVED" }),
    ...over,
});

describe("critics gate", () => {
    it("finish refuses while critics have not reviewed the drafts", async () => {
        const ctx = makeCtx();
        const res = await dispatchTool("finish", { summary: "done" }, ctx);
        expect(res.ok).toBe(false);
        expect(ctx.finished).toBeNull();
    });

    it("run_critics clears the gate and finish then succeeds", async () => {
        const ctx = makeCtx();
        const critics = await dispatchTool("run_critics", {}, ctx);
        expect(critics.ok).toBe(true);
        expect(ctx.criticsCleared).toBe(true);
        const res = await dispatchTool("finish", { summary: "done" }, ctx);
        expect(res.ok).toBe(true);
        expect(ctx.finished?.summary).toBe("done");
    });

    it("run_critics refuses with no drafts", async () => {
        const ctx = makeCtx({ drafts: [] });
        const res = await dispatchTool("run_critics", {}, ctx);
        expect(res.ok).toBe(false);
    });

    it("finish passes with zero drafts (nothing to gate)", async () => {
        const ctx = makeCtx({ drafts: [] });
        const res = await dispatchTool("finish", { summary: "nothing to do" }, ctx);
        expect(res.ok).toBe(true);
    });

    it("create_draft is LOCKED until JJ approves a proposal", async () => {
        const ctx = makeCtx({ proposalApproved: false });
        const res = await dispatchTool(
            "create_draft",
            { docType: "blogPost", title: "T", fields: {} },
            ctx
        );
        expect(res.ok).toBe(false);
        expect(res.content).toContain("LOCKED");
    });

    it("present_proposal stores the proposal, resets approval, and pauses", async () => {
        const ctx = makeCtx({ proposalApproved: true });
        const res = await dispatchTool(
            "present_proposal",
            {
                proposalMarkdown: "# Piano",
                deliverables: [{ kind: "svg-infographic", title: "D", description: "x", inPage: true }],
                interactiveSections: [{ block: "quizBlock", title: "Self-check", note: "y" }],
            },
            ctx
        );
        expect(res.ok).toBe(true);
        expect(ctx.proposal?.deliverables).toHaveLength(1);
        expect(ctx.proposalApproved).toBe(false); // re-presented ⇒ re-approve
        expect(ctx.pause).toBe("proposal");
    });

    it("ask_jj pauses the leg", async () => {
        const ctx = makeCtx();
        const res = await dispatchTool("ask_jj", { question: "Quale taglio?" }, ctx);
        expect(res.ok).toBe(true);
        expect(ctx.pause).toBe("question");
    });

    it("draft mutations re-arm the gate (static check)", async () => {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const tools = readFileSync(join(__dirname, "../lib/runner/tools.ts"), "utf8");
        const rearms = tools.match(/ctx\.criticsCleared = false/g) ?? [];
        expect(rearms.length, "create_draft AND update_draft must re-arm the critics gate").toBeGreaterThanOrEqual(2);
    });

    it("record_science feeds the ledger and the event hook", async () => {
        const seen: string[] = [];
        const ctx = makeCtx({ onScience: (s) => seen.push(s.source) });
        const res = await dispatchTool(
            "record_science",
            { claim: "X improves Y", source: "EAU 2025", url: "https://doi.org/x" },
            ctx
        );
        expect(res.ok).toBe(true);
        expect(ctx.science).toHaveLength(1);
        expect(seen).toEqual(["EAU 2025"]);
    });
});

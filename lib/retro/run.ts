/**
 * La Soffitta — the self-improvement loop, PROPOSALS-ONLY by construction.
 *
 * collectSignals() → one fresh-context synthesis call → markdown report in
 * docs/retros/ + one Ernesto Desk row (plan-proposal, Pending — JJ decides).
 *
 * HARD BOUNDARIES:
 *  - never modifies skills/prompts/code — it proposes patches as text
 *  - never touches Ambrogio (his audit is JJ's independent oversight;
 *    this is the machine looking at its own journals)
 *  - the Desk flip and the application of any patch are human acts
 */
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runnerConfig } from "../config";
import { collectSignals } from "./collect";
import { createDeskProposal } from "../notion/desk-write";

const RETRO_SYSTEM = `You are La Soffitta — the retrospective of JJ's GGOMed cockpit. You
receive the system's own journals: run outcomes, Tatiana/Aspasia verdicts,
JJ's mid-run corrections, impact outcomes (patient-need success verdicts),
failures and costs. Your job is SELF-IMPROVEMENT PROPOSALS for the SYSTEM —
not content review.

Look for PATTERNS, not incidents:
1. Critic findings that recur across runs → the skill/shape/prompt has a
   systemic gap. Propose the exact edit (file, section, before→after text).
2. JJ's corrections that repeat → his taste is not yet encoded. Propose
   where to encode it (skill voice refs, FAMILY notes, shape rules).
3. Impact outcomes "Not achieved/Partially" → what should change upstream
   (research phase, proposal template, content structure)?
4. Failures/costs → process fixes (tool descriptions, turn budget, model
   choice per task type).

Output format (markdown, in Italian, terse):
# Retrospettiva — <data>
## Sintesi (3 righe max)
## Pattern rilevati (evidenza: quali run/verdetti)
## Proposte (max 5, ordinate per impatto)
Per ciascuna: **P<n> — titolo** · file/area toccata · patch proposta
(testo concreto pronto da applicare) · rischio · evidenza.
## Cosa NON toccare (cose che funzionano e vanno preservate)

Rules: evidence-based only (cite runs by title); if signals are thin, say
so and keep proposals to what the evidence supports; NEVER propose changes
to certification gates, drafts-only boundaries, Ambrogio, or JJ's approval
gates — those are constitutional.`;

export interface RetroResult {
    reportPath: string;
    report: string;
    deskRowId: string | null;
}

const RETROS_DIR = join(process.cwd(), "docs", "retros");

export function listRetros(): { file: string; content: string }[] {
    if (!existsSync(RETROS_DIR)) return [];
    return readdirSync(RETROS_DIR)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, 10)
        .map((f) => ({ file: f, content: readFileSync(join(RETROS_DIR, f), "utf8") }));
}

export async function runRetro(): Promise<RetroResult> {
    const signals = await collectSignals();
    const client = new Anthropic({ apiKey: runnerConfig.anthropicApiKey });

    const res = await client.messages.create({
        model: runnerConfig.model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: RETRO_SYSTEM,
        messages: [
            {
                role: "user",
                content: `SEGNALI DEL SISTEMA (journals):\n${JSON.stringify(signals, null, 1).slice(0, 300_000)}`,
            },
        ],
    });
    const report = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

    const stamp = new Date().toISOString().slice(0, 10);
    mkdirSync(RETROS_DIR, { recursive: true });
    const reportPath = join(RETROS_DIR, `retro-${stamp}.md`);
    writeFileSync(reportPath, report);

    // File the decision where the house decides: one Desk row, Pending.
    let deskRowId: string | null = null;
    try {
        deskRowId = await createDeskProposal({
            title: `Soffitta ${stamp} — proposte di self-improvement del cockpit`,
            body:
                `Retrospettiva automatica del cockpit (${signals.totals.runs} run, ` +
                `$${signals.totals.costUsd.toFixed(2)}, ${signals.totals.blockingMentions} BLOCKING nei verdetti).\n\n` +
                report +
                `\n\nReport completo nel repo: docs/retros/retro-${stamp}.md — le patch si applicano solo su tua approvazione.`,
        });
    } catch (err) {
        console.error("[retro] Desk row failed (report saved anyway):", err);
    }

    return { reportPath: `docs/retros/retro-${stamp}.md`, report, deskRowId };
}

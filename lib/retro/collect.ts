/**
 * La Soffitta — signal collector. Deterministic: reads what the system has
 * already recorded about itself (run journals, impact outcomes, activity
 * log). No LLM here; the synthesis happens in run.ts.
 */
import { listRuns, loadEvents } from "../runner/store";
import { getContentNeeds, getAgentsActivityLog } from "../notion/editorial";
import type { RunEvent } from "../runner/types";

export interface RetroSignals {
    periodNote: string;
    runs: {
        runId: string;
        title: string;
        skill: string;
        model?: string;
        status: string;
        turnsUsed: number;
        drafts: number;
        captions: number;
        estCostUsd: number;
        errors: string[];
        jjFeedback: string[];
        criticVerdicts: { critic: string; verdict: string }[];
    }[];
    impact: { need: string; outcome: string; successDefinition: string; evidence: string }[];
    activityFailures: { job: string | null; error: string; startedAt: string | null }[];
    totals: { runs: number; costUsd: number; blockingMentions: number };
}

export async function collectSignals(): Promise<RetroSignals> {
    const runs = listRuns().filter((r) => r.status !== "archived" || true); // archived runs still teach
    const runSignals = runs.slice(0, 25).map((meta) => {
        const events = loadEvents(meta.runId);
        const errors: string[] = [];
        const jjFeedback: string[] = [];
        const criticVerdicts: { critic: string; verdict: string }[] = [];
        for (const ev of events as RunEvent[]) {
            if (ev.type === "run.error") errors.push(ev.message);
            if (ev.type === "tool.result" && !ev.ok) errors.push(`${ev.name}: ${ev.summary}`);
            if (ev.type === "jj.said") jjFeedback.push(ev.text.slice(0, 500));
            if (ev.type === "critics.verdict") {
                criticVerdicts.push({ critic: ev.critic, verdict: ev.verdict.slice(0, 2500) });
            }
        }
        return {
            runId: meta.runId,
            title: meta.title.slice(0, 80),
            skill: meta.skill,
            model: meta.model,
            status: meta.status,
            turnsUsed: meta.turnsUsed,
            drafts: meta.drafts.length,
            captions: meta.captions?.length ?? 0,
            estCostUsd: meta.usage?.estCostUsd ?? 0,
            errors,
            jjFeedback,
            criticVerdicts,
        };
    });

    let impact: RetroSignals["impact"] = [];
    let activityFailures: RetroSignals["activityFailures"] = [];
    try {
        const needs = await getContentNeeds();
        impact = needs
            .filter((n) => n.impactOutcome && n.impactOutcome !== "Pending")
            .map((n) => ({
                need: n.need,
                outcome: n.impactOutcome!,
                successDefinition: n.successDefinition,
                evidence: n.impactEvidence,
            }));
    } catch {
        /* Notion irraggiungibile — la retro procede senza */
    }
    try {
        const log = await getAgentsActivityLog();
        activityFailures = log
            .filter((r) => r.status === "Failed")
            .slice(0, 20)
            .map((r) => ({ job: r.job, error: r.errorMessage.slice(0, 300), startedAt: r.startedAt }));
    } catch {
        /* idem */
    }

    const blockingMentions = runSignals.reduce(
        (n, r) => n + r.criticVerdicts.filter((v) => /BLOCKING/i.test(v.verdict)).length,
        0
    );

    return {
        periodNote: `${runSignals.length} run analizzati (tutti quelli in .runs/), impact outcomes registrati: ${impact.length}`,
        runs: runSignals,
        impact,
        activityFailures,
        totals: {
            runs: runSignals.length,
            costUsd: runSignals.reduce((n, r) => n + r.estCostUsd, 0),
            blockingMentions,
        },
    };
}

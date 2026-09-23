"use client";
import type { Narrative } from "../lib/briefing/policy";
import { usePreparedBrief } from "../lib/briefing/use-prepared-brief";
import { NarrativeAccount } from "./NarrativeAccount";
import MarkdownBlock from "./MarkdownBlock";
const pending = (data: { narrative: Narrative }) => data.narrative.status === "pending";
export function RunSummary({ runId, version, original }: { runId: string; version: string; original: string }) {
    const { data, error } = usePreparedBrief<{ narrative: Narrative }>(`/api/ernesto/runs/${encodeURIComponent(runId)}?summary=1&version=${encodeURIComponent(version)}`, pending);
    return <section className="paper border border-engraving p-5 text-paper-foreground">
        <h2 className="mb-3 text-base font-bold">Nota di riconsegna</h2>
        {data ? <NarrativeAccount narrative={data.narrative} /> : <p className="text-sm">{error || "Leggo gli esiti dell'attività e i punti da rivedere."}</p>}
        {error && data && <p className="mt-3 text-xs text-seal">{error}</p>}
        <details className="mt-4 border-t border-paper-edge pt-3">
            <summary className="cursor-pointer text-xs font-semibold">Nota originale dell'agente</summary>
            <div className="mt-3 max-h-80 overflow-y-auto"><MarkdownBlock content={original} /></div>
        </details>
    </section>;
}

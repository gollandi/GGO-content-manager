"use client";

import { useRef, useState } from "react";
import AppShell from "../../components/AppShell";
import StatusBadge from "../../components/StatusBadge";
import type { RunEvent } from "../../lib/runner/types";

/**
 * Module 3 — La Casa di Ernesto (generative). Brief in → streamed run →
 * drafts out. Everything lands as drafts.* in the GGOMed Sanity Studio;
 * JJ reviews and publishes there. The cockpit never publishes.
 */

const STUDIO_BASE = "https://ggomed.co.uk/studio";

interface DraftRow { draftId: string; docType: string; title: string }
interface LogRow { key: number; kind: "text" | "tool" | "status"; text: string }

export default function CasaDiErnestoPage() {
    const [brief, setBrief] = useState("");
    const [running, setRunning] = useState(false);
    const [log, setLog] = useState<LogRow[]>([]);
    const [drafts, setDrafts] = useState<DraftRow[]>([]);
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const keyRef = useRef(0);

    const push = (kind: LogRow["kind"], text: string) =>
        setLog((l) => {
            // Coalesce streamed text into the last row for readability
            if (kind === "text" && l.length > 0 && l[l.length - 1].kind === "text") {
                const copy = l.slice();
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + text };
                return copy;
            }
            return [...l, { key: keyRef.current++, kind, text }];
        });

    async function run() {
        setRunning(true);
        setLog([]);
        setDrafts([]);
        setSummary(null);
        setError(null);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await fetch("/api/ernesto/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skill: "ggomed-page-writer-v2", brief }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                const detail = await res.text().catch(() => "");
                throw new Error(`Run failed to start (${res.status}) ${detail.slice(0, 200)}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event = JSON.parse(line) as RunEvent;
                    switch (event.type) {
                        case "run.start": push("status", `Run started — ${event.model}`); break;
                        case "turn.start": break;
                        case "text": push("text", event.text); break;
                        case "tool.use": push("tool", `→ ${event.name} ${event.summary}`); break;
                        case "tool.result": if (!event.ok) push("tool", `✗ ${event.name}: ${event.summary}`); break;
                        case "draft.created":
                            setDrafts((d) => [...d, { draftId: event.draftId, docType: event.docType, title: event.title }]);
                            push("status", `Draft created: ${event.title}`);
                            break;
                        case "run.done": setSummary(`${event.reason === "finished" ? "" : `[${event.reason}] `}${event.summary}`); break;
                        case "run.error": setError(event.message); break;
                    }
                }
            }
        } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) {
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    }

    const studioLink = (d: DraftRow) =>
        `${STUDIO_BASE}/intent/edit/id=${encodeURIComponent(d.draftId.replace(/^drafts\./, ""))};type=${d.docType}`;

    return (
        <AppShell>
            <div className="p-8 max-lg:p-4 max-w-4xl">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">La Casa di Ernesto</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Brief in → drafts in Sanity. Nothing publishes itself — you review
                        every draft in the Studio. Skill: ggomed-page-writer-v2.
                    </p>
                </header>

                <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    disabled={running}
                    rows={6}
                    placeholder={"Brief — e.g. \"Scrivi la dedicated page per la circoncisione parziale: pubblico UK, tono JJ, collega la category hub urology-conditions, includi 4 FAQ.\""}
                    className="w-full px-4 py-3 rounded-xl border border-border-default bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ggo-teal"
                />
                <div className="flex items-center gap-3 mt-3 mb-6">
                    <button
                        onClick={run}
                        disabled={running || !brief.trim()}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-ggo-purple to-ggo-teal text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {running ? "Scrivendo…" : "Scrivi le bozze"}
                    </button>
                    {running && (
                        <button
                            onClick={() => abortRef.current?.abort()}
                            className="px-4 py-2.5 rounded-xl border border-border-default text-sm font-medium hover:text-red-500"
                        >
                            Ferma
                        </button>
                    )}
                </div>

                {drafts.length > 0 && (
                    <section className="bg-white rounded-2xl border border-border-default p-5 mb-6">
                        <h2 className="text-base font-bold mb-3">Bozze create — da rivedere nello Studio</h2>
                        <ul className="divide-y divide-border-soft">
                            {drafts.map((d) => (
                                <li key={d.draftId} className="py-2.5 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-medium">{d.title}</div>
                                        <div className="text-xs text-subtle">{d.docType} · {d.draftId}</div>
                                    </div>
                                    <a href={studioLink(d)} target="_blank" rel="noreferrer"
                                       className="text-xs font-semibold text-ggo-teal hover:underline shrink-0">
                                        Apri nello Studio ↗
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {summary && (
                    <div className="mb-6 p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-sm whitespace-pre-wrap">
                        <StatusBadge tone="success" label="Run completo" className="mb-2" /> {summary}
                    </div>
                )}
                {error && (
                    <div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-sm text-red-800">{error}</div>
                )}

                {log.length > 0 && (
                    <section className="bg-white rounded-2xl border border-border-default p-5">
                        <h2 className="text-base font-bold mb-3">Log del run</h2>
                        <div className="text-sm space-y-2 max-h-[420px] overflow-y-auto font-mono text-[12.5px]">
                            {log.map((row) => (
                                <p key={row.key}
                                   className={row.kind === "tool" ? "text-ggo-teal" : row.kind === "status" ? "font-semibold" : "text-charcoal whitespace-pre-wrap"}>
                                    {row.text}
                                </p>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AppShell>
    );
}

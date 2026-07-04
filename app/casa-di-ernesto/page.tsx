"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../../components/AppShell";
import StatusBadge from "../../components/StatusBadge";
import type { Proposal, RunEvent } from "../../lib/runner/types";

/**
 * Module 3 — La Casa di Ernesto (conversational).
 * Brief → ricerca → PROPOSTA (testo + deliverables + sezioni interattive)
 * → chat con JJ → approvazione → bozze → critici → Studio.
 * I run restano in lista finché JJ non li archivia (post-publish).
 */

const STUDIO_BASE = "https://ggomed.co.uk/studio";
const SKILLS = [
    { id: "ggomed-page-writer-v2", label: "Pagine sito (page-writer)" },
    { id: "samantha-social-groupie", label: "Social captions (Samantha)" },
] as const;

interface RunMetaLite {
    runId: string;
    title: string;
    status: string;
    updatedAt: string;
    drafts: { draftId: string; docType: string; title: string }[];
    science: { claim: string; source: string; url: string }[];
    proposal: Proposal | null;
    proposalApproved: boolean;
    summary: string | null;
    usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; estCostUsd: number };
    captions?: { rowId: string; rowTitle: string; platform: string | null; caption: string; hashtags: string }[];
}
interface LogRow { key: number; kind: "text" | "tool" | "status" | "jj"; text: string }
interface VerdictRow { critic: string; verdict: string }

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "info" | "warning" | "danger" | "secondary" }> = {
    "running": { label: "In corso", tone: "info" },
    "awaiting-jj": { label: "Aspetta te", tone: "warning" },
    "done": { label: "Completo", tone: "success" },
    "error": { label: "Errore", tone: "danger" },
    "archived": { label: "Archiviato", tone: "secondary" },
};

export default function CasaDiErnestoPage() {
    const [runs, setRuns] = useState<RunMetaLite[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [meta, setMeta] = useState<RunMetaLite | null>(null);
    const [log, setLog] = useState<LogRow[]>([]);
    const [verdicts, setVerdicts] = useState<VerdictRow[]>([]);
    const [input, setInput] = useState("");
    const [model, setModel] = useState("claude-opus-4-8");
    const [skill, setSkill] = useState<string>(SKILLS[0].id);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const keyRef = useRef(0);
    const logEndRef = useRef<HTMLDivElement>(null);

    const pushLog = useCallback((kind: LogRow["kind"], text: string) => {
        setLog((l) => {
            if (kind === "text" && l.length > 0 && l[l.length - 1].kind === "text") {
                const copy = l.slice();
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + text };
                return copy;
            }
            return [...l, { key: keyRef.current++, kind, text }];
        });
    }, []);

    const processEvent = useCallback((ev: RunEvent) => {
        switch (ev.type) {
            case "run.start": pushLog("status", "— nuovo giro —"); break;
            case "text": pushLog("text", ev.text); break;
            case "jj.said": pushLog("jj", ev.text); break;
            case "tool.use": pushLog("tool", `→ ${ev.name} ${ev.summary}`); break;
            case "tool.result": if (!ev.ok) pushLog("tool", `✗ ${ev.name}: ${ev.summary}`); break;
            case "science.recorded": pushLog("status", `Fonte registrata: ${ev.source}`); break;
            case "critics.verdict":
                setVerdicts((v) => [...v.filter((x) => x.critic !== ev.critic), { critic: ev.critic, verdict: ev.verdict }]);
                pushLog("status", `Verdetto di ${ev.critic === "tatiana" ? "Tatiana" : "Aspasia"} ricevuto`);
                break;
            case "proposal.presented": pushLog("status", "📋 Proposta presentata — leggi il pannello e rispondi"); break;
            case "jj.asked": pushLog("status", `❓ ${ev.question}`); break;
            case "draft.created": pushLog("status", `Bozza creata: ${ev.title}`); break;
            case "run.paused": break;
            case "usage":
                setMeta((m) => (m ? { ...m, usage: ev.totals } : m));
                break;
            case "caption.written":
                setMeta((m) => (m ? { ...m, captions: [...(m.captions ?? []), ev.item] } : m));
                pushLog("status", `Caption scritta: ${ev.item.rowTitle}`);
                break;
            case "run.done": pushLog("status", ev.summary); break;
            case "run.error": setError(ev.message); break;
        }
    }, [pushLog]);

    const loadRuns = useCallback(async () => {
        try {
            const res = await fetch("/api/ernesto/runs");
            if (res.ok) setRuns((await res.json()).runs);
        } catch { /* offline — la lista resta */ }
    }, []);

    const openRun = useCallback(async (id: string) => {
        setActiveId(id);
        setLog([]);
        setVerdicts([]);
        setError(null);
        const res = await fetch(`/api/ernesto/runs/${id}`);
        if (!res.ok) { setError("Run non trovato"); return; }
        const { meta: m, events } = await res.json();
        setMeta(m);
        for (const ev of events as RunEvent[]) processEvent(ev);
    }, [processEvent]);

    useEffect(() => { void loadRuns(); }, [loadRuns]);

    // Prefill dal Topic Pool (?brief=…) — window.location per evitare la
    // trappola Suspense di useSearchParams in prerender.
    useEffect(() => {
        const briefParam = new URLSearchParams(window.location.search).get("brief");
        if (briefParam) {
            setInput(briefParam);
            window.history.replaceState({}, "", "/casa-di-ernesto");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

    async function consumeStream(res: Response) {
        if (!res.ok || !res.body) {
            const detail = await res.text().catch(() => "");
            throw new Error(`(${res.status}) ${detail.slice(0, 200)}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let newRunId: string | null = null;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                if (!line.trim()) continue;
                const ev = JSON.parse(line) as RunEvent;
                if (ev.type === "run.start") newRunId = ev.runId;
                processEvent(ev);
            }
        }
        return newRunId;
    }

    async function startRun() {
        setStreaming(true);
        setError(null);
        setLog([]);
        setVerdicts([]);
        setMeta(null);
        setActiveId(null);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await fetch("/api/ernesto/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skill, brief: input, model }),
                signal: controller.signal,
            });
            const id = await consumeStream(res);
            setInput("");
            if (id) { await openRun(id); }
        } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) {
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
            void loadRuns();
        }
    }

    async function reply(approve = false) {
        if (!activeId) return;
        setStreaming(true);
        setError(null);
        const controller = new AbortController();
        abortRef.current = controller;
        const message = input;
        try {
            const res = await fetch(`/api/ernesto/runs/${activeId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message || undefined, approve }),
                signal: controller.signal,
            });
            setInput("");
            await consumeStream(res);
            const mres = await fetch(`/api/ernesto/runs/${activeId}`);
            if (mres.ok) setMeta((await mres.json()).meta);
        } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) {
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
            void loadRuns();
        }
    }

    async function archive(id: string) {
        await fetch(`/api/ernesto/runs/${id}/archive`, { method: "POST" });
        if (activeId === id) { setActiveId(null); setMeta(null); setLog([]); setVerdicts([]); }
        void loadRuns();
    }

    const studioLink = (d: { draftId: string; docType: string }) =>
        `${STUDIO_BASE}/intent/edit/id=${encodeURIComponent(d.draftId.replace(/^drafts\./, ""))};type=${d.docType}`;

    const canChat = !!activeId && !streaming && meta?.status !== "archived";
    const showApprove = !!meta?.proposal && !meta?.proposalApproved && meta?.status === "awaiting-jj" && !streaming;

    return (
        <AppShell>
            <div className="p-6 max-lg:p-3 grid grid-cols-[280px_1fr] max-lg:grid-cols-1 gap-6">
                {/* ── Run history (persistent until archived) ── */}
                <aside>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Run</h2>
                    <button
                        onClick={() => { setActiveId(null); setMeta(null); setLog([]); setVerdicts([]); setError(null); }}
                        className="w-full mb-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-ggo-purple to-ggo-teal text-white text-sm font-semibold"
                    >
                        + Nuovo run
                    </button>
                    <ul className="space-y-2">
                        {runs.map((r) => {
                            const s = STATUS_LABEL[r.status] ?? STATUS_LABEL["running"];
                            return (
                                <li key={r.runId}
                                    className={`p-3 rounded-xl border cursor-pointer ${activeId === r.runId ? "border-ggo-teal bg-mint/30" : "border-border-default bg-white hover:border-ggo-teal/50"}`}
                                    onClick={() => void openRun(r.runId)}>
                                    <div className="text-xs font-medium line-clamp-2">{r.title}</div>
                                    <div className="flex items-center justify-between mt-1.5">
                                        <StatusBadge tone={s.tone} label={s.label} />
                                        {r.status !== "archived" && (
                                            <button onClick={(e) => { e.stopPropagation(); void archive(r.runId); }}
                                                className="text-[10px] text-subtle hover:text-red-500">archivia</button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                        {runs.length === 0 && <li className="text-xs text-subtle">Nessun run ancora.</li>}
                    </ul>
                </aside>

                {/* ── Active run ── */}
                <main className="min-w-0">
                    <header className="mb-4">
                        <h1 className="text-2xl font-bold tracking-tight">La Casa di Ernesto</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Brief → ricerca → <strong>proposta</strong> → tua approvazione → bozze → critici → Studio.
                            Il log resta qui finché non archivi il run.
                        </p>
                    </header>

                    {error && <div className="mb-4 p-4 rounded-xl border border-red-300 bg-red-50 text-sm text-red-800">{error}</div>}

                    {/* Usage / cost strip */}
                    {meta?.usage && (
                        <div className="mb-4 grid grid-cols-5 max-lg:grid-cols-2 gap-2">
                            {[
                                { label: "Da cache (0.1×)", value: meta.usage.cacheReadTokens.toLocaleString() },
                                { label: "Scritti in cache", value: meta.usage.cacheWriteTokens.toLocaleString() },
                                { label: "Input pieno", value: meta.usage.inputTokens.toLocaleString() },
                                { label: "Output", value: meta.usage.outputTokens.toLocaleString() },
                                { label: "Stima costo", value: `$${meta.usage.estCostUsd.toFixed(2)}` },
                            ].map((s) => (
                                <div key={s.label} className="bg-white rounded-xl border border-border-default px-3 py-2">
                                    <div className="text-sm font-bold">{s.value}</div>
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Proposal panel */}
                    {meta?.proposal && (
                        <section className="bg-white rounded-2xl border-2 border-ggo-teal/40 p-5 mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-bold">📋 Proposta{meta.proposalApproved ? " (approvata)" : " — in attesa del tuo verdetto"}</h2>
                                {showApprove && (
                                    <button onClick={() => void reply(true)}
                                        className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                                        ✓ Approva → scrivi le bozze
                                    </button>
                                )}
                            </div>
                            <div className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto border border-border-soft rounded-xl p-4 mb-4">
                                {meta.proposal.proposalMarkdown}
                            </div>
                            {meta.proposal.deliverables.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold mb-2">Deliverables visivi</h3>
                                    <ul className="space-y-2">
                                        {meta.proposal.deliverables.map((d, i) => (
                                            <li key={i} className="p-3 rounded-xl bg-surface-muted/60 border border-border-soft">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <StatusBadge tone={d.inPage ? "success" : "info"} label={d.inPage ? "la faccio io (svg in-page)" : d.kind} />
                                                    <span className="text-sm font-medium">{d.title}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                                                {d.generationPrompt && (
                                                    <button
                                                        onClick={() => void navigator.clipboard.writeText(d.generationPrompt!)}
                                                        className="mt-2 text-xs font-semibold text-ggo-teal hover:underline">
                                                        Copia prompt per Higgsfield/Canva ⧉
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {meta.proposal.interactiveSections.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold mb-2">Sezioni interattive</h3>
                                    <ul className="flex flex-wrap gap-2">
                                        {meta.proposal.interactiveSections.map((s, i) => (
                                            <li key={i} className="px-3 py-2 rounded-xl bg-ggo-teal/10 border border-ggo-teal/30 text-xs">
                                                <span className="font-bold">{s.block}</span> · {s.title}
                                                <span className="text-muted-foreground"> — {s.note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Drafts */}
                    {meta && meta.drafts.length > 0 && (
                        <section className="bg-white rounded-2xl border border-border-default p-5 mb-4">
                            <h2 className="text-base font-bold mb-3">Bozze in Sanity — da rivedere nello Studio</h2>
                            <ul className="divide-y divide-border-soft">
                                {meta.drafts.map((d) => (
                                    <li key={d.draftId} className="py-2.5 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium">{d.title}</div>
                                            <div className="text-xs text-subtle">{d.docType}</div>
                                        </div>
                                        <a href={studioLink(d)} target="_blank" rel="noreferrer"
                                           className="text-xs font-semibold text-ggo-teal hover:underline shrink-0">Apri nello Studio ↗</a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Captions (Family B) */}
                    {meta && (meta.captions?.length ?? 0) > 0 && (
                        <section className="bg-white rounded-2xl border border-border-default p-5 mb-4">
                            <h2 className="text-base font-bold mb-3">Caption scritte sul Calendar — da schedulare tu in Notion</h2>
                            <ul className="divide-y divide-border-soft">
                                {meta.captions!.map((c) => (
                                    <li key={c.rowId} className="py-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-medium">{c.rowTitle}{c.platform ? ` · ${c.platform}` : ""}</div>
                                            <a href={`https://notion.so/${c.rowId.replace(/-/g, "")}`} target="_blank" rel="noreferrer"
                                               className="text-xs font-semibold text-ggo-teal hover:underline shrink-0">Apri in Notion ↗</a>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{c.caption}</p>
                                        <p className="text-xs text-ggo-teal mt-0.5">{c.hashtags}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Critics */}
                    {verdicts.length > 0 && (
                        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4 mb-4">
                            {verdicts.map((v, i) => (
                                <section key={i} className="bg-white rounded-2xl border border-border-default p-5">
                                    <h2 className="text-base font-bold mb-2">{v.critic === "tatiana" ? "Tatiana — avversariale" : "Aspasia — personas"}</h2>
                                    <div className="text-xs whitespace-pre-wrap max-h-56 overflow-y-auto text-muted-foreground">{v.verdict}</div>
                                </section>
                            ))}
                        </div>
                    )}

                    {/* Science ledger */}
                    {meta && meta.science.length > 0 && (
                        <details className="bg-white rounded-2xl border border-border-default p-5 mb-4">
                            <summary className="text-base font-bold cursor-pointer">Registro fonti (Berenice) — {meta.science.length}</summary>
                            <ul className="divide-y divide-border-soft mt-2">
                                {meta.science.map((s, i) => (
                                    <li key={i} className="py-2">
                                        <div className="text-sm">{s.claim}</div>
                                        <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-ggo-teal hover:underline">{s.source} ↗</a>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {/* Log / chat transcript */}
                    <section className="bg-white rounded-2xl border border-border-default p-5 mb-4">
                        <h2 className="text-base font-bold mb-3">{activeId ? "Conversazione" : "Nuovo run"}</h2>
                        {log.length > 0 && (
                            <div className="text-sm space-y-2 max-h-[380px] overflow-y-auto mb-4">
                                {log.map((row) => (
                                    <p key={row.key}
                                       className={
                                           row.kind === "jj" ? "ml-12 p-2.5 rounded-xl bg-ggo-teal/10 border border-ggo-teal/30 whitespace-pre-wrap"
                                           : row.kind === "tool" ? "font-mono text-[12px] text-ggo-teal"
                                           : row.kind === "status" ? "font-semibold text-[13px]"
                                           : "whitespace-pre-wrap text-charcoal"
                                       }>
                                        {row.text}
                                    </p>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        )}
                        <div className="flex gap-3 items-end">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={streaming}
                                rows={3}
                                placeholder={activeId
                                    ? "Rispondi, chiedi modifiche, dai indicazioni…"
                                    : "Brief — es. \"Dedicated page su LUTS da collo vescicale + BNI, pubblico UK, con self-check quiz e diagramma anatomico.\""}
                                className="flex-1 px-4 py-3 rounded-xl border border-border-default bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ggo-teal"
                            />
                            <div className="flex flex-col gap-2">
                                {!activeId && (
                                    <select
                                        value={skill}
                                        onChange={(e) => setSkill(e.target.value)}
                                        disabled={streaming}
                                        className="px-3 py-2 rounded-xl border border-border-default bg-white text-xs"
                                        title="Cosa produce il run"
                                    >
                                        {SKILLS.map((s) => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                )}
                                {!activeId && (
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        disabled={streaming}
                                        className="px-3 py-2 rounded-xl border border-border-default bg-white text-xs"
                                        title="Modello del run — Sonnet 5 costa ~60% in meno"
                                    >
                                        <option value="claude-opus-4-8">Opus 4.8 — qualità max</option>
                                        <option value="claude-sonnet-5">Sonnet 5 — economico</option>
                                    </select>
                                )}
                                <button
                                    onClick={() => (activeId ? void reply(false) : void startRun())}
                                    disabled={streaming || !input.trim()}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-ggo-purple to-ggo-teal text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap">
                                    {streaming ? "…" : activeId ? "Invia" : "Avvia"}
                                </button>
                                {streaming && (
                                    <button onClick={() => abortRef.current?.abort()}
                                        className="px-4 py-2 rounded-xl border border-border-default text-xs font-medium hover:text-red-500">
                                        Ferma
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>

                    {meta?.summary && (
                        <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-sm whitespace-pre-wrap">
                            <StatusBadge tone="success" label="Nota di riconsegna" className="mb-2" /> {meta.summary}
                        </div>
                    )}
                </main>
            </div>
        </AppShell>
    );
}

"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import { RoomCrest } from "../../components/Registro";
import MarkdownBlock from "../../components/MarkdownBlock";

/**
 * La Soffitta — il loop di self-improvement del cockpit.
 * PROPOSTE, MAI AUTO-MODIFICHE: la sintesi legge i journal del sistema
 * (verdetti critici, tue correzioni, impact outcomes, errori, costi) e
 * produce un report + una riga Ernesto Desk in Pending. Decidi tu lì;
 * le patch si applicano solo su tua istruzione esplicita.
 */

interface Retro { file: string; content: string }

export default function SoffittaPage() {
    const [retros, setRetros] = useState<Retro[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [workLog, setWorkLog] = useState<string[]>([]);

    async function load() {
        const res = await fetch("/api/retro");
        if (res.ok) {
            const data = await res.json();
            setRetros(data.retros);
            if (data.retros.length > 0 && !open) setOpen(data.retros[0].file);
        }
    }
    useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    async function run() {
        setRunning(true);
        setError(null);
        setNotice(null);
        setWorkLog([]);
        try {
            const res = await fetch("/api/retro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "retro" }),
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            setNotice(
                result.deskRowId
                    ? "Retrospettiva completata — proposta archiviata anche sull'Ernesto Desk (Pending, decidi tu lì)."
                    : "Retrospettiva completata — report salvato (riga Desk non creata, controlla i log)."
            );
            await load();
            setOpen(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setRunning(false);
        }
    }

    async function runOfficina() {
        setRunning(true);
        setError(null);
        setNotice(null);
        setWorkLog([]);
        try {
            const res = await fetch("/api/retro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "officina" }),
            });
            if (!res.ok || !res.body) throw new Error(await res.text());
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const raw of lines) {
                    if (!raw.trim()) continue;
                    const ev = JSON.parse(raw) as { line?: string; done?: { prUrl: string | null; branch: string | null; applied: number; testsPassed: boolean }; error?: string };
                    if (ev.line) setWorkLog((l) => [...l, ev.line!]);
                    if (ev.error) setError(ev.error);
                    if (ev.done) {
                        setNotice(
                            ev.done.testsPassed
                                ? `Officina completa: ${ev.done.applied} edit in ${ev.done.branch} — ${ev.done.prUrl ? `PR pronta: ${ev.done.prUrl}` : "apri la PR dal branch"}. Il merge è tuo.`
                                : "Officina: test falliti nel branch — niente pushato, dettagli nel report."
                        );
                    }
                }
            }
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setRunning(false);
        }
    }

    return (
        <AppShell>
            <div className="room-soffitta p-8 max-lg:p-4 max-w-4xl">
                <header className="mb-6 border-b border-plate-rule pb-4">
                    <h1 className="document-title mt-1.5 flex items-center gap-3 text-[30px] text-plate-foreground-strong max-sm:text-[24px]"><RoomCrest room="soffitta" size={26} className="opacity-80" />La Soffitta</h1>
                    <p className="mt-2 max-w-[38rem] text-[13px] leading-relaxed text-plate-foreground-soft">
                        Il sistema guarda i propri journal (verdetti dei critici, le tue correzioni,
                        impact outcomes, errori, costi) e propone come migliorarsi. Solo proposte:
                        finiscono sull&apos;Ernesto Desk in Pending — nessuna patch si applica da sola.
                    </p>
                </header>

                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <button
                        onClick={() => void runOfficina()}
                        disabled={running}
                        className="px-6 py-2.5 act-seal text-sm font-semibold disabled:opacity-50"
                        title="Analizza → propone → discute → applica in branch → testa → PR. Tu approvi solo il merge."
                    >
                        {running ? "Lavoro…" : "⚙︎ Officina (fino alla PR)"}
                    </button>
                    <button
                        onClick={() => void run()}
                        disabled={running}
                        className="px-5 py-2.5  border border-border-default text-sm font-medium disabled:opacity-50"
                        title="Solo analisi e proposte, nessun branch"
                    >
                        Solo retrospettiva
                    </button>
                </div>
                {notice && <div className="mb-3 text-xs text-engraving-ink whitespace-pre-wrap">{notice}</div>}
                {workLog.length > 0 && (
                    <div className="mb-6 p-4  bg-surface-muted/60 border border-border-soft font-mono text-[12px] space-y-1">
                        {workLog.map((l, i) => <p key={i}>{l}</p>)}
                    </div>
                )}
                {error && <div className="mb-4 p-4  border border-seal px-4 py-3 text-[13px] text-seal-bright">{error}</div>}

                {retros.length === 0 ? (
                    <p className="text-sm text-paper-foreground-soft">Nessuna retrospettiva ancora — servono un po&apos; di run in archivio perché ci sia qualcosa da imparare.</p>
                ) : (
                    <div className="space-y-3">
                        {retros.map((r) => (
                            <section key={r.file} className="paper border border-paper-edge text-paper-foreground">
                                <button
                                    onClick={() => setOpen(open === r.file ? null : r.file)}
                                    className="w-full text-left px-5 py-3 text-sm font-bold flex justify-between items-center"
                                >
                                    {r.file.replace(/^retro-|\.md$/g, "")}
                                    <span className="text-paper-foreground-soft">{open === r.file ? "▾" : "▸"}</span>
                                </button>
                                {open === r.file && (
                                    <div className="px-5 pb-5 text-sm max-h-[520px] overflow-y-auto border-t border-border-soft pt-4">
                                        <MarkdownBlock content={r.content} />
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

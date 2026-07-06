"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";

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
        try {
            const res = await fetch("/api/retro", { method: "POST" });
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

    return (
        <AppShell>
            <div className="p-8 max-lg:p-4 max-w-4xl">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">La Soffitta</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Il sistema guarda i propri journal (verdetti dei critici, le tue correzioni,
                        impact outcomes, errori, costi) e propone come migliorarsi. Solo proposte:
                        finiscono sull&apos;Ernesto Desk in Pending — nessuna patch si applica da sola.
                    </p>
                </header>

                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => void run()}
                        disabled={running}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-ggo-purple to-ggo-teal text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {running ? "Rifletto sui journal…" : "Esegui retrospettiva"}
                    </button>
                    {notice && <span className="text-xs text-emerald-600">{notice}</span>}
                </div>
                {error && <div className="mb-4 p-4 rounded-xl border border-red-300 bg-red-50 text-sm text-red-800">{error}</div>}

                {retros.length === 0 ? (
                    <p className="text-sm text-subtle">Nessuna retrospettiva ancora — servono un po&apos; di run in archivio perché ci sia qualcosa da imparare.</p>
                ) : (
                    <div className="space-y-3">
                        {retros.map((r) => (
                            <section key={r.file} className="bg-white rounded-2xl border border-border-default">
                                <button
                                    onClick={() => setOpen(open === r.file ? null : r.file)}
                                    className="w-full text-left px-5 py-3 text-sm font-bold flex justify-between items-center"
                                >
                                    {r.file.replace(/^retro-|\.md$/g, "")}
                                    <span className="text-subtle">{open === r.file ? "▾" : "▸"}</span>
                                </button>
                                {open === r.file && (
                                    <div className="px-5 pb-5 text-sm whitespace-pre-wrap max-h-[520px] overflow-y-auto border-t border-border-soft pt-4">
                                        {r.content}
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

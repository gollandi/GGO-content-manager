"use client";

import { useEffect, useMemo, useState } from "react";
import MarkdownBlock from "../../components/MarkdownBlock";
import { useNotionData } from "../../lib/hooks/useNotionData";
import type { PerformanceSnapshotRow } from "../../lib/notion/editorial";
import type { NatasciaReport } from "../../lib/notion/natascia";
import { day, summariseWeek } from "../../lib/social/views";

/**
 * Performance — read-only. Natascia's weekly readings and the Performance
 * Snapshot the house ingests every Sunday (Search Console, GA4, Meta,
 * YouTube, Vercel, Beehiiv). Nothing here writes; deciding what to do with a
 * signal is a brief to the house (Briefs) or a note to JJ.
 */

const section = "paper mb-5 border border-paper-edge p-5 text-[14px] leading-relaxed text-paper-foreground";
const h2 = "column-label column-label-paper mb-2";

const fmt = (v: number | null) => (v === null ? "—" : v.toLocaleString("it-IT"));
const pct = (v: number | null) => (v === null ? "—" : `${(v * (v <= 1 ? 100 : 1)).toFixed(1)}%`);
function NatasciaPanel() {
    const [state, setState] = useState<{ reports: NatasciaReport[]; error: string | null; loading: boolean }>({ reports: [], error: null, loading: true });
    const [open, setOpen] = useState(0);
    useEffect(() => {
        let cancelled = false;
        fetch("/api/natascia/weekly")
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) setState({ reports: [], error: json.error || `Caricamento non riuscito (${res.status})`, loading: false });
                else setState({ reports: json.reports ?? [], error: null, loading: false });
            })
            .catch(() => !cancelled && setState({ reports: [], error: "Non riesco a caricare i report di Natascia", loading: false }));
        return () => { cancelled = true; };
    }, []);

    if (state.loading) return <p className="text-paper-foreground-soft">Carico le letture di Natascia…</p>;
    if (state.error) return <p role="alert">{state.error}</p>;
    if (state.reports.length === 0) return <p>Ancora nessuna lettura settimanale.</p>;
    return (
        <div className="space-y-3">
            {state.reports.map((r, i) => (
                <article key={r.id} className="border-t border-paper-edge pt-3">
                    <button type="button" className="w-full text-left" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                        <span className="font-semibold">{r.title}</span>
                        <span className="ml-2 text-[12px] text-paper-foreground-soft">settimana del {day(r.weekOf)}</span>
                    </button>
                    {r.editorial && <p className="mt-1 italic">{r.editorial}</p>}
                    {open === i && (
                        <div className="mt-2 space-y-2">
                            {r.summary && <p>{r.summary}</p>}
                            {r.anomaly && <p><strong>Anomalia:</strong> {r.anomaly}</p>}
                            {r.silentPages && <p><strong>Pagine silenziose:</strong> {r.silentPages}</p>}
                            {r.body && <MarkdownBlock content={r.body} />}
                            {r.bodyTruncated && <p className="text-[12px]">La lettura è più lunga di quanto mostra questa pagina.</p>}
                        </div>
                    )}
                </article>
            ))}
        </div>
    );
}

export default function PerformancePage() {
    const { data: rows, loading, error } = useNotionData<PerformanceSnapshotRow>("/api/notion/performance-snapshot");
    const week = useMemo(() => summariseWeek(rows), [rows]);
    const latestRows = useMemo(
        () => rows.filter((r) => day(r.weekOf) === week.latest).sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)),
        [rows, week.latest],
    );

    return (
        <div className="mx-auto max-w-5xl p-8 max-sm:p-4">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Risultati</h1>
                    <p className="page-subtitle">Come sono andati il sito e i canali — sola lettura. Dati fino a domenica scorsa.</p>
                </div>
            </header>

            <section className={section}>
                <h2 className={h2}>La lettura settimanale di Natascia</h2>
                <NatasciaPanel />
            </section>

            <section className={section}>
                <h2 className={h2}>Ultima settimana per fonte{week.latest ? ` — settimana del ${week.latest}` : ""}</h2>
                {loading ? <p>Carico…</p> : error ? <p role="alert">{error}</p> : week.bySource.length === 0 ? <p>Nessuna riga di snapshot.</p> : (
                    <table className="w-full text-[13px] [&_td]:border-t [&_td]:border-paper-edge [&_td]:py-1.5 [&_td]:pr-4 [&_th]:pb-1.5 [&_th]:pr-4 [&_th]:font-semibold">
                        <thead><tr className="text-left"><th>Fonte</th><th>Righe</th><th>Impressioni</th><th>Clic</th><th>Sessioni</th></tr></thead>
                        <tbody>
                            {week.bySource.map(([source, s]) => (
                                <tr key={source}><td>{source}</td><td>{s.rows}</td><td>{fmt(s.impressions)}</td><td>{fmt(s.clicks)}</td><td>{fmt(s.sessions)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className={section}>
                <h2 className={h2}>Tutte le righe dell'ultima settimana</h2>
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px] [&_td]:border-t [&_td]:border-paper-edge [&_td]:py-1.5 [&_td]:pr-4 [&_th]:pb-1.5 [&_th]:pr-4 [&_th]:font-semibold">
                            <thead><tr className="text-left"><th>Asset</th><th>Fonte</th><th>Canale</th><th>Impr.</th><th>Clic</th><th>CTR</th><th>Pos.</th><th>Sessioni</th><th>Coinvolgimento</th></tr></thead>
                            <tbody>
                                {latestRows.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.title}</td><td>{r.source ?? "—"}</td><td>{r.channel ?? "—"}</td>
                                        <td>{fmt(r.impressions)}</td><td>{fmt(r.clicks)}</td><td>{pct(r.ctr)}</td>
                                        <td>{r.averagePosition ?? "—"}</td><td>{fmt(r.sessions)}</td><td>{pct(r.engagementRate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

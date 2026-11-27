"use client";

import { useMemo, useState } from "react";
import { useNotionData } from "../../lib/hooks/useNotionData";
import { filterPages, pageUrl, type PublicPage } from "../../lib/social/views";

/**
 * Website — every page of ggomed.co.uk the house registers, with its state,
 * read-only. Changing a page is the website team's work and publishing it is
 * JJ's (in Sanity); from here a page is looked at, and anything worth
 * changing becomes a brief.
 */

export default function WebsitePage() {
    const { data: items, loading, error } = useNotionData<PublicPage>("/api/social/pages");
    const [term, setTerm] = useState("");
    const [status, setStatus] = useState("All");
    const statuses = useMemo(() => ["All", ...[...new Set(items.map((i) => i.status))].sort()], [items]);
    const shown = useMemo(() => filterPages(items, term, status), [items, term, status]);

    return (
        <div className="mx-auto max-w-5xl p-8 max-sm:p-4">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Sito</h1>
                    <p className="page-subtitle">Ogni pagina di ggomed.co.uk e il suo stato — sola lettura.</p>
                </div>
            </header>
            <section className="paper mb-5 border border-paper-edge p-5 text-[14px] text-paper-foreground">
                <div className="mb-3 flex flex-wrap gap-3">
                    <input aria-label="Cerca pagine" placeholder="Cerca per titolo o indirizzo" value={term} onChange={(e) => setTerm(e.target.value)}
                        className="min-w-[220px] flex-1 border border-paper-edge bg-transparent px-2 py-1" />
                    <select aria-label="Filtra per stato" value={status} onChange={(e) => setStatus(e.target.value)} className="border border-paper-edge bg-transparent px-2 py-1">
                        {statuses.map((s) => <option key={s} value={s}>{s === "All" ? "Tutti" : s}</option>)}
                    </select>
                </div>
                {loading ? <p>Carico…</p> : error ? <p role="alert">{error}</p> : (
                    <>
                        <p className="mb-2 text-[12px] text-paper-foreground-soft">{shown.length} di {items.length} pagine</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px] [&_td]:border-t [&_td]:border-paper-edge [&_td]:py-1.5 [&_td]:pr-4 [&_th]:pb-1.5 [&_th]:pr-4 [&_th]:font-semibold">
                                <thead><tr className="text-left"><th>Pagina</th><th>Tipo</th><th>Stato</th><th>Ultima revisione</th><th>Ultima modifica</th></tr></thead>
                                <tbody>
                                    {shown.map((i) => {
                                        const url = pageUrl(i.slug);
                                        return (
                                            <tr key={i.id}>
                                                <td>{url ? <a className="underline" href={url} target="_blank" rel="noreferrer">{i.title}</a> : i.title}</td>
                                                <td>{i.contentType}</td>
                                                <td>{i.status}</td>
                                                <td>{i.lastReviewed ? i.lastReviewed.slice(0, 10) : "—"}</td>
                                                <td>{i.lastEditedTime ? new Date(i.lastEditedTime).toLocaleDateString("it-IT") : "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

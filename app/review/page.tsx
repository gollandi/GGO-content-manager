"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import MarkdownBlock from "../../components/MarkdownBlock";
import StatusBadge from "../../components/StatusBadge";

type Decision = "approve" | "modify" | "reject";
type Target = "desk" | "calendar" | "website";

interface VideoRef { url: string; name?: string; path?: string; ageDays?: number }
interface MediaRef { kind: "image" | "video"; url: string }
interface DeskRow {
    rowId: string; url: string; title: string; type: string; status: string;
    priority: string; due: string | null; correction: string; body: string; videos: VideoRef[];
}
interface CalendarRow {
    rowId: string; title: string; contentType: string | null; status: string; platforms: string | null;
    date: string | null; variant: string | null; caption: string; hashtags: string; notes: string;
    canva: string | null; hasAssets: boolean; media: MediaRef[]; url: string;
}
interface WebsiteArticle {
    rowId: string; title: string; status: string | null; category: string | null; reviewDue: string | null;
    lastReviewed: string | null; liveUrl: string | null; url: string;
    proposals: { need: string; details: string; actionStatus: string | null; url: string }[];
    patch: { id: string; title: string | null; rationale: string | null; sources: string[]; operations: string[]; sanityDocId: string; batch?: string } | null;
    patchState?: "awaiting-publish" | "published";
    draftId?: string;
}
interface ReviewState {
    wall: DeskRow[];
    desk: DeskRow[];
    calendar: CalendarRow[];
    website: WebsiteArticle[];
    generatedAt: string;
    cached?: boolean;
    error?: string;
}

const proxyUrl = (url: string) => url.replace(/^\/(video|media)\?/, "/api/review-dashboard/$1?");

function tagTone(value?: string | null): "success" | "info" | "warning" | "danger" | "secondary" {
    if (!value) return "secondary";
    if (/Urgent|Blocked|Rejected|FALLITA/i.test(value)) return "danger";
    if (/Review|Pending|Needs|Draft|Modify/i.test(value)) return "warning";
    if (/Approved|Scheduled|bozza|patch pronta/i.test(value)) return "success";
    if (/Production|Create/i.test(value)) return "info";
    return "secondary";
}

function MediaStrip({ media, videos }: { media?: MediaRef[]; videos?: VideoRef[] }) {
    const images = media ?? [];
    const reels = [...(videos ?? []), ...images.filter((m) => m.kind === "video").map((m) => ({ url: m.url }))];
    const stills = images.filter((m) => m.kind === "image");
    if (reels.length === 0 && stills.length === 0) return null;

    return (
        <div className="mt-3 flex flex-wrap gap-3">
            {stills.map((m, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${m.url}-${index}`} src={proxyUrl(m.url)} alt="" className="h-32 rounded-xl border border-border-soft object-cover" loading="lazy" />
            ))}
            {reels.map((v, index) => (
                <video key={`${v.url}-${index}`} controls preload="none" playsInline src={proxyUrl(v.url)} className="h-56 rounded-xl border border-border-soft bg-black" />
            ))}
        </div>
    );
}

function NoteBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
    return (
        <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={2}
            placeholder={placeholder}
            className="mt-3 w-full px-3 py-2 rounded-xl border border-border-default bg-white text-xs focus:outline-none focus:ring-2 focus:ring-ggo-teal"
        />
    );
}

function DecisionButtons({
    rowId, target, note, title, busy, onDecision, onModify, websitePatch,
}: {
    rowId: string;
    target: Target;
    note: string;
    title: string;
    busy: boolean;
    websitePatch?: boolean;
    onDecision: (rowId: string, target: Target, decision: Decision, note: string) => void;
    onModify: (rowId: string, target: Target, title: string, note: string) => void;
}) {
    return (
        <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => onDecision(rowId, target, "approve", note)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                {target === "calendar" ? "Approve -> Scheduled" : target === "website" ? (websitePatch ? "Approva -> bozza Sanity" : "Commissiona a Edmondo") : "Approve"}
            </button>
            <button disabled={busy} onClick={() => onModify(rowId, target, title, note)} className="px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold disabled:opacity-50">
                Modify
            </button>
            {target !== "website" && (
                <button disabled={busy} onClick={() => onDecision(rowId, target, "reject", note)} className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold disabled:opacity-50">
                    Reject
                </button>
            )}
        </div>
    );
}

export default function ReviewPage() {
    const [state, setState] = useState<ReviewState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<string | null>(null);
    const [modifyDraft, setModifyDraft] = useState<{ rowId: string; target: Target; title: string; note: string } | null>(null);

    const load = useCallback(async (refresh = false) => {
        setError(null);
        const res = await fetch(`/api/review-dashboard/state${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error ?? `Review dashboard non disponibile (${res.status})`);
            return;
        }
        setState(data as ReviewState);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const buckets = useMemo(() => {
        const empty = { wall: [], inReview: [], pendingDesk: [], webPatch: [], webAwaiting: [], inProduction: [], queued: [], scheduled: [], webRest: [] } as {
            wall: DeskRow[]; inReview: CalendarRow[]; pendingDesk: DeskRow[]; webPatch: WebsiteArticle[]; webAwaiting: WebsiteArticle[];
            inProduction: (CalendarRow | DeskRow)[]; queued: DeskRow[]; scheduled: CalendarRow[]; webRest: WebsiteArticle[];
        };
        if (!state) return empty;
        const wallIds = new Set(state.wall.map((row) => row.rowId));
        empty.wall = state.wall;
        empty.inReview = state.calendar.filter((row) => row.status === "Review");
        empty.pendingDesk = state.desk.filter((row) => row.status === "Pending" && !wallIds.has(row.rowId));
        empty.webAwaiting = state.website.filter((row) => row.patchState === "awaiting-publish");
        empty.webPatch = state.website.filter((row) => row.patch && row.patchState !== "awaiting-publish");
        empty.webRest = state.website.filter((row) => !row.patch);
        empty.inProduction = [
            ...state.calendar.filter((row) => row.status === "In Production" || row.status === "Draft"),
            ...state.desk.filter((row) => row.status === "In production"),
        ];
        empty.queued = state.desk.filter((row) => row.status === "Approved");
        empty.scheduled = state.calendar.filter((row) => row.status === "Scheduled");
        return empty;
    }, [state]);

    const decisionCount = buckets.wall.length + buckets.inReview.length + buckets.pendingDesk.length + buckets.webPatch.length;

    function setNote(key: string, value: string) {
        setNotes((current) => ({ ...current, [key]: value }));
    }

    function openModify(rowId: string, target: Target, title: string, note: string) {
        setError(null);
        setModifyDraft({ rowId, target, title, note });
    }

    async function decide(rowId: string, target: Target, decision: Decision, comment: string) {
        if (decision === "modify" && !comment.trim()) {
            setError(target === "website"
                ? "Scrivi cosa va cambiato: Modify manda la nota a Edmondo."
                : "Scrivi cosa va cambiato: Modify manda la nota a Ernesto.");
            return;
        }
        if (decision === "reject" && !comment.trim() && !window.confirm("Inviare senza nota a Ernesto?")) return;

        const key = `${target}:${rowId}`;
        setBusyKey(key);
        setError(null);
        try {
            const res = await fetch("/api/review-dashboard/decision", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ rowId, decision, comment, target }),
            });
            const result = await res.json();
            if (!res.ok || !result.ok) throw new Error(result.error ?? "Decisione non salvata");
            setToast(`${result.status ?? decision} salvato`);
            setTimeout(() => setToast(null), 2600);
            if (decision === "modify") setModifyDraft(null);
            await load(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusyKey(null);
        }
    }

    const renderDesk = (row: DeskRow, active = row.status === "Pending") => {
        const key = `desk:${row.rowId}`;
        const note = notes[key] ?? row.correction ?? "";
        return (
            <article key={key} className="bg-white rounded-2xl border border-border-default p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <StatusBadge tone={tagTone(row.priority)} label={`${row.priority} · ${row.type}`} />
                    <StatusBadge tone={tagTone(row.status)} label={row.status} />
                    {row.due && <StatusBadge tone="secondary" label={`entro ${row.due}`} />}
                </div>
                <a href={row.url} target="_blank" rel="noreferrer" className="text-base font-bold hover:text-ggo-teal">{row.title}</a>
                {row.body && <MarkdownBlock content={row.body} className="mt-3 text-xs text-muted-foreground" />}
                <MediaStrip videos={row.videos} />
                {active ? (
                    <>
                        <NoteBox value={note} onChange={(value) => setNote(key, value)} placeholder="Note to Ernesto..." />
                        <DecisionButtons rowId={row.rowId} target="desk" note={note} title={row.title} busy={busyKey === key} onDecision={decide} onModify={openModify} />
                    </>
                ) : row.correction ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs whitespace-pre-wrap">{row.correction}</div>
                ) : null}
            </article>
        );
    };

    const renderCalendar = (row: CalendarRow) => {
        const key = `calendar:${row.rowId}`;
        const note = notes[key] ?? row.notes ?? "";
        return (
            <article key={key} className="bg-white rounded-2xl border border-border-default p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <StatusBadge tone={tagTone(row.status)} label={row.status} />
                    {row.contentType && <StatusBadge tone="info" label={row.contentType} />}
                    {row.platforms && <StatusBadge tone="secondary" label={row.platforms} />}
                    {row.date && <StatusBadge tone="secondary" label={row.date} />}
                </div>
                <a href={row.url} target="_blank" rel="noreferrer" className="text-base font-bold hover:text-ggo-teal">{row.title}</a>
                {row.caption ? <div className="mt-3 border-l-4 border-ggo-teal/40 pl-3 text-sm whitespace-pre-wrap">{row.caption}</div> : <p className="mt-3 text-xs text-muted-foreground">Caption non ancora scritta.</p>}
                {row.hashtags && <p className="mt-2 text-xs text-ggo-teal break-words">{row.hashtags}</p>}
                <MediaStrip media={row.media} />
                {row.status !== "Review" && row.hasAssets && <p className="mt-3 text-xs text-muted-foreground">Asset collegati, visibili quando la riga arriva in Review.</p>}
                {!row.hasAssets && row.canva && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Solo vecchio link Canva, nessun asset locale visibile.</p>}
                {!row.hasAssets && !row.canva && <p className="mt-3 rounded-xl border border-border-soft bg-surface-muted p-3 text-xs text-muted-foreground">Nessun asset ancora prodotto.</p>}
                {row.status === "Review" ? (
                    <>
                        <NoteBox value={note} onChange={(value) => setNote(key, value)} placeholder="Note to Ernesto..." />
                        <DecisionButtons rowId={row.rowId} target="calendar" note={note} title={row.title} busy={busyKey === key} onDecision={decide} onModify={openModify} />
                    </>
                ) : row.notes ? (
                    <MarkdownBlock content={row.notes} className="mt-3 text-xs text-muted-foreground" />
                ) : null}
            </article>
        );
    };

    const renderArticle = (row: WebsiteArticle) => {
        const key = `website:${row.rowId}`;
        const note = notes[key] ?? "";
        return (
            <article key={key} className="bg-white rounded-2xl border border-border-default p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    {row.status && <StatusBadge tone={tagTone(row.status)} label={row.status} />}
                    {row.category && <StatusBadge tone="secondary" label={row.category} />}
                    {row.patch && <StatusBadge tone="success" label="patch pronta" />}
                    {row.patchState === "awaiting-publish" && <StatusBadge tone="success" label="bozza in Sanity" />}
                </div>
                <a href={row.url} target="_blank" rel="noreferrer" className="text-base font-bold hover:text-ggo-teal">{row.title}</a>
                {row.liveUrl && <a href={row.liveUrl} target="_blank" rel="noreferrer" className="block mt-1 text-xs text-ggo-teal hover:underline">{row.liveUrl}</a>}
                {row.patchState === "awaiting-publish" ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                        Patch applicata come bozza {row.draftId}. Prossimo atto: Sanity Studio, rileggi e pubblica.
                    </div>
                ) : (
                    <>
                        {row.proposals.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {row.proposals.map((proposal, index) => (
                                    <div key={`${proposal.need}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                                        <div className="font-bold">{proposal.need}</div>
                                        {proposal.actionStatus && <div className="mt-1 text-amber-800">{proposal.actionStatus}</div>}
                                        {proposal.details && <MarkdownBlock content={proposal.details} className="mt-2 text-muted-foreground" />}
                                    </div>
                                ))}
                            </div>
                        ) : <p className="mt-3 text-xs text-muted-foreground">Nessuna proposta di review aperta.</p>}
                        {row.patch && (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs">
                                <div className="font-bold text-emerald-800">Patch pronta: Approve la applica come bozza Sanity, non pubblica.</div>
                                <div className="mt-1">{row.patch.title ?? row.patch.id} · {row.patch.operations.length} op · {row.patch.sanityDocId}</div>
                                {row.patch.rationale && <MarkdownBlock content={row.patch.rationale} className="mt-2 text-muted-foreground" />}
                            </div>
                        )}
                        <NoteBox value={note} onChange={(value) => setNote(key, value)} placeholder="Istruzioni per Edmondo..." />
                        <DecisionButtons rowId={row.rowId} target="website" note={note} title={row.title} busy={busyKey === key} websitePatch={Boolean(row.patch)} onDecision={decide} onModify={openModify} />
                    </>
                )}
            </article>
        );
    };

    return (
        <AppShell>
            <div className="p-6 max-lg:p-3">
                <header className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Il Cancello</p>
                        <h1 className="text-2xl font-bold tracking-tight">Casa GGOMed — Review</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Fonte: review dashboard di Ernesto. Desk, Calendar, website review e media locali sono dentro questa shell.
                        </p>
                        {state && (
                            <p className="text-xs text-subtle mt-2">
                                {decisionCount} decisioni per te · aggiornato {new Date(state.generatedAt).toLocaleTimeString("it-IT")}{state.cached ? " · cache" : ""}
                            </p>
                        )}
                    </div>
                    <button onClick={() => void load(true)} className="px-4 py-2 rounded-xl border border-border-default bg-white text-sm font-semibold hover:border-ggo-teal">
                        Aggiorna da Notion
                    </button>
                </header>

                {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-border-default bg-charcoal px-4 py-3 text-sm text-white">{toast}</div>}
                {error && <div className="mb-4 p-4 rounded-xl border border-red-300 bg-red-50 text-sm text-red-800">{error}</div>}
                {modifyDraft && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <section className="w-full max-w-xl rounded-2xl bg-white border border-border-default shadow-xl p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div>
                                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                                        {modifyDraft.target === "website" ? "Nota a Edmondo" : "Nota a Ernesto"}
                                    </p>
                                    <h2 className="text-lg font-bold tracking-tight">Cosa va modificato?</h2>
                                </div>
                                <button
                                    onClick={() => setModifyDraft(null)}
                                    className="px-3 py-1.5 rounded-lg border border-border-default text-xs font-semibold"
                                >
                                    Chiudi
                                </button>
                            </div>
                            <p className="text-sm font-semibold mb-2">{modifyDraft.title}</p>
                            <textarea
                                value={modifyDraft.note}
                                onChange={(event) => setModifyDraft((current) => current ? { ...current, note: event.target.value } : current)}
                                rows={6}
                                autoFocus
                                placeholder={modifyDraft.target === "website"
                                    ? "Scrivi a Edmondo cosa deve rilavorare, correggere o verificare..."
                                    : "Scrivi a Ernesto cosa deve cambiare, rigenerare o correggere..."}
                                className="w-full px-3 py-2 rounded-xl border border-border-default bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ggo-teal"
                            />
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setModifyDraft(null)}
                                    className="px-4 py-2 rounded-xl border border-border-default text-sm font-semibold"
                                >
                                    Annulla
                                </button>
                                <button
                                    disabled={busyKey === `${modifyDraft.target}:${modifyDraft.rowId}` || !modifyDraft.note.trim()}
                                    onClick={() => void decide(modifyDraft.rowId, modifyDraft.target, "modify", modifyDraft.note)}
                                    className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    Invia modifica
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {!state ? (
                    <div className="rounded-2xl border border-border-default bg-white p-8 text-center text-sm text-muted-foreground">Carico cio che aspetta il tuo giudizio...</div>
                ) : (
                    <>
                        <section className="mb-6">
                            <h2 className="mb-3 text-base font-bold">Da decidere ora ({decisionCount})</h2>
                            {decisionCount === 0 ? (
                                <div className="rounded-2xl border border-border-default bg-white p-8 text-center text-sm text-muted-foreground">
                                    Niente in attesa del tuo giudizio. Il resto della casa e qui sotto.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 max-xl:grid-cols-1 gap-4">
                                    {buckets.wall.map((row) => renderDesk(row))}
                                    {buckets.inReview.map(renderCalendar)}
                                    {buckets.pendingDesk.map((row) => renderDesk(row))}
                                    {buckets.webPatch.map(renderArticle)}
                                </div>
                            )}
                        </section>

                        {[
                            [`Bozze gia in Sanity — apri Studio e pubblica (${buckets.webAwaiting.length})`, buckets.webAwaiting.map(renderArticle), buckets.webAwaiting.length > 0],
                            [`In lavorazione adesso (${buckets.inProduction.length})`, buckets.inProduction.map((row) => "contentType" in row ? renderCalendar(row) : renderDesk(row, false)), false],
                            [`In coda — approvati, in attesa di uno slot (${buckets.queued.length})`, buckets.queued.map((row) => renderDesk(row, false)), false],
                            [`Programmati verso pubblicazione (${buckets.scheduled.length})`, buckets.scheduled.map(renderCalendar), false],
                            [`Website — stato e proposte senza patch pronta (${buckets.webRest.length})`, buckets.webRest.map(renderArticle), false],
                        ].map(([label, rows, open]) => (
                            <details key={String(label)} open={Boolean(open)} className="mb-3 rounded-2xl border border-border-default bg-white">
                                <summary className="cursor-pointer px-5 py-3 text-sm font-bold text-muted-foreground hover:text-charcoal">{label as string}</summary>
                                <div className="grid grid-cols-2 max-xl:grid-cols-1 gap-4 border-t border-border-soft p-5">
                                    {(rows as JSX.Element[]).length > 0 ? rows as JSX.Element[] : <p className="text-sm text-muted-foreground">Vuoto.</p>}
                                </div>
                            </details>
                        ))}
                    </>
                )}
            </div>
        </AppShell>
    );
}

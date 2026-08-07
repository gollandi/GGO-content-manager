"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import MarkdownBlock from "../../components/MarkdownBlock";
import { Guilloche, Socket, Mark, AgeBar, type MarkTone } from "../../components/Registro";

/**
 * IL CANCELLO — the register spread.
 *
 * Left page: the ruled register. Every entry awaiting JJ is a line ending in
 * an empty seal socket; selecting a line opens it on the right page.
 * Right page: the document itself — caption, body, and every asset at
 * document scale, because an unviewable asset is an undecidable one.
 * At its foot, the three acts: seal, stamp back, void.
 *
 * On a phone the register is the list and the document opens over it,
 * acts pinned under the thumb. One hand, between clinics.
 */

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

/** One line of the register, whatever family it came from. */
interface Entry {
    key: string;
    rowId: string;
    target: Target;
    family: "Social" | "Desk" | "Website";
    title: string;
    stateLabel: string;
    dueDays: number | null;
    hasMedia: boolean;
    notionUrl: string;
    desk?: DeskRow;
    calendar?: CalendarRow;
    website?: WebsiteArticle;
}

const proxyUrl = (url: string) => url.replace(/^\/(video|media)\?/, "/api/review-dashboard/$1?");

function daysUntil(due: string | null): number | null {
    if (!due) return null;
    const t = new Date(due).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.floor((Date.now() - t) / 86_400_000);
}

function stateTone(value: string): MarkTone {
    if (/Urgent|Blocked|Rejected|FALLITA/i.test(value)) return "pending";
    if (/Review|Pending|Needs|Draft|Modify/i.test(value)) return "ageing";
    if (/Approved|Scheduled|bozza|patch/i.test(value)) return "sealed";
    return "quiet";
}

/* ===========================================================================
   THE DOCUMENT'S ASSETS — full width of the page, never a thumbnail strip.
   ========================================================================= */

function AssetSheet({ media, videos }: { media?: MediaRef[]; videos?: VideoRef[] }) {
    const [zoomed, setZoomed] = useState<string | null>(null);
    const images = media ?? [];
    const reels = [...(videos ?? []), ...images.filter((m) => m.kind === "video").map((m) => ({ url: m.url }))];
    const stills = images.filter((m) => m.kind === "image");
    if (reels.length === 0 && stills.length === 0) {
        return (
            <p className="mt-4 border border-dashed border-paper-edge px-4 py-6 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                Nessun asset allegato a questo atto
            </p>
        );
    }

    return (
        <div className="mt-4 flex flex-col gap-4">
            {stills.map((m, index) => (
                <figure key={`${m.url}-${index}`} className="border border-paper-edge bg-paper-shade p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={proxyUrl(m.url)}
                        alt={`Asset ${index + 1}`}
                        loading="lazy"
                        onClick={() => setZoomed(proxyUrl(m.url))}
                        className="w-full cursor-zoom-in object-contain"
                        style={{ maxHeight: "70vh" }}
                    />
                    <figcaption className="mt-1.5 flex items-center justify-between px-1">
                        <span className="column-label column-label-paper">Allegato {index + 1}</span>
                        <span className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                            tocca per ingrandire
                        </span>
                    </figcaption>
                </figure>
            ))}
            {reels.map((v, index) => (
                <figure key={`${v.url}-${index}`} className="border border-paper-edge bg-plate p-2">
                    <video
                        controls
                        preload="metadata"
                        playsInline
                        src={proxyUrl(v.url)}
                        className="mx-auto w-full"
                        style={{ maxHeight: "70vh" }}
                    />
                    <figcaption className="mt-1.5 px-1">
                        <span className="column-label">Video {index + 1}</span>
                    </figcaption>
                </figure>
            ))}

            {/* The loupe: the asset alone, full screen, one tap to close. */}
            {zoomed && (
                <button
                    type="button"
                    aria-label="Chiudi ingrandimento"
                    className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-plate-deep/95 p-4"
                    onClick={() => setZoomed(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={zoomed} alt="" className="max-h-full max-w-full object-contain" />
                </button>
            )}
        </div>
    );
}

/* ===========================================================================
   THE PAGE
   ========================================================================= */

export default function ReviewPage() {
    const [state, setState] = useState<ReviewState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    /** Per-entry publish-date overrides: JJ corrects the proposed date before sealing. */
    const [dates, setDates] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<string | null>(null);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [modifyOpen, setModifyOpen] = useState(false);
    const [justSealed, setJustSealed] = useState<string | null>(null);
    /**
     * The acts ledger. Every act JJ performs is recorded here the moment the
     * server confirms it, and rendered on the register line and the document
     * — seal pressed, stamp struck, line voided — until the source itself
     * catches up. It also makes the act unrepeatable: one act per entry.
     * Session-persisted so a reload does not blank the marks.
     */
    const [acted, setActed] = useState<Record<string, { decision: Decision; at: number }>>({});

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("cancello-acts");
            if (raw) setActed(JSON.parse(raw));
        } catch { /* a blank ledger is a valid ledger */ }
    }, []);

    const recordAct = useCallback((key: string, decision: Decision) => {
        setActed((current) => {
            const next = { ...current, [key]: { decision, at: Date.now() } };
            try { sessionStorage.setItem("cancello-acts", JSON.stringify(next)); } catch { /* best effort */ }
            return next;
        });
    }, []);

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

    useEffect(() => {
        if (!state) return;
        setActed((current) => {
            const live = new Set(entries.map((e) => e.key));
            const kept = Object.fromEntries(Object.entries(current).filter(([k]) => live.has(k)));
            if (Object.keys(kept).length !== Object.keys(current).length) {
                try { sessionStorage.setItem("cancello-acts", JSON.stringify(kept)); } catch { /* best effort */ }
                return kept;
            }
            return current;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    /* ── The register's lines ─────────────────────────────────────────────── */

    const entries = useMemo<Entry[]>(() => {
        if (!state) return [];
        const wallIds = new Set(state.wall.map((row) => row.rowId));
        const fromDesk = (row: DeskRow): Entry => ({
            key: `desk:${row.rowId}`,
            rowId: row.rowId,
            target: "desk",
            family: "Desk",
            title: row.title,
            stateLabel: row.priority ? `${row.priority} · ${row.type}` : row.type,
            dueDays: daysUntil(row.due),
            hasMedia: row.videos.length > 0,
            notionUrl: row.url,
            desk: row
        });
        return [
            ...state.wall.map(fromDesk),
            ...state.calendar
                .filter((row) => row.status === "Review")
                .map((row): Entry => ({
                    key: `calendar:${row.rowId}`,
                    rowId: row.rowId,
                    target: "calendar",
                    family: "Social",
                    title: row.title,
                    stateLabel: [row.contentType, row.platforms].filter(Boolean).join(" · ") || "Social",
                    dueDays: null,
                    hasMedia: row.media.length > 0,
                    notionUrl: row.url,
                    calendar: row
                })),
            ...state.desk
                .filter((row) => row.status === "Pending" && !wallIds.has(row.rowId))
                .map(fromDesk),
            ...state.website
                .filter((row) => row.patch && row.patchState !== "awaiting-publish")
                .map((row): Entry => ({
                    key: `website:${row.rowId}`,
                    rowId: row.rowId,
                    target: "website",
                    family: "Website",
                    title: row.title,
                    stateLabel: "Patch pronta",
                    dueDays: null,
                    hasMedia: false,
                    notionUrl: row.url,
                    website: row
                }))
        ];
    }, [state]);

    const open = entries.find((e) => e.key === openKey) ?? null;
    const pendingEntries = entries.filter((e) => !acted[e.key]);

    const laterSections = useMemo(() => {
        if (!state) return [];
        return [
            {
                label: "Bozze già in Sanity — apri Studio e pubblica",
                rows: state.website
                    .filter((r) => r.patchState === "awaiting-publish")
                    .map((r) => ({ key: `w:${r.rowId}`, title: r.title, state: `bozza ${r.draftId ?? ""}`, url: r.url }))
            },
            {
                label: "In lavorazione adesso",
                rows: [
                    ...state.calendar
                        .filter((r) => r.status === "In Production" || r.status === "Draft")
                        .map((r) => ({ key: `c:${r.rowId}`, title: r.title, state: r.status, url: r.url })),
                    ...state.desk
                        .filter((r) => r.status === "In production")
                        .map((r) => ({ key: `d:${r.rowId}`, title: r.title, state: r.status, url: r.url }))
                ]
            },
            {
                label: "In coda — approvati, in attesa di uno slot",
                rows: state.desk
                    .filter((r) => r.status === "Approved")
                    .map((r) => ({ key: `d:${r.rowId}`, title: r.title, state: "Approved", url: r.url }))
            },
            {
                label: "Programmati verso pubblicazione",
                rows: state.calendar
                    .filter((r) => r.status === "Scheduled")
                    .map((r) => ({ key: `c:${r.rowId}`, title: r.title, state: r.date ?? "Scheduled", url: r.url }))
            }
        ];
    }, [state]);

    /* ── Acts ─────────────────────────────────────────────────────────────── */

    function setNote(key: string, value: string) {
        setNotes((current) => ({ ...current, [key]: value }));
    }

    async function decide(
        entry: Entry,
        decision: Decision,
        comment: string,
        opts: { date?: string; publishNow?: boolean } = {}
    ) {
        if (decision === "modify" && !comment.trim()) {
            setError(entry.target === "website"
                ? "Scrivi cosa va cambiato: il timbro porta la nota a Edmondo."
                : "Scrivi cosa va cambiato: il timbro porta la nota a Ernesto.");
            return;
        }
        if (decision === "reject" && !comment.trim() && !window.confirm("Annullare senza nota a Ernesto?")) return;

        setBusyKey(entry.key);
        setError(null);
        try {
            const res = await fetch("/api/review-dashboard/decision", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    rowId: entry.rowId, decision, comment, target: entry.target,
                    ...(opts.date ? { date: opts.date } : {}),
                    ...(opts.publishNow ? { publishNow: true } : {}),
                }),
            });
            const result = await res.json();
            if (!res.ok || !result.ok) throw new Error(result.error ?? "Decisione non salvata");
            recordAct(entry.key, decision);
            if (decision === "approve") {
                setJustSealed(entry.key);
                setTimeout(() => setJustSealed(null), 1200);
            }
            setToast(
                decision === "approve"
                    ? (opts.publishNow ? "Sigillato — pubblicazione invocata" : "Sigillato")
                    : decision === "modify" ? "Timbrato e rimandato" : "Annullato"
            );
            setTimeout(() => setToast(null), 2600);
            setModifyOpen(false);
            // The document stays open: the point of the act is seeing the wax land.
            await load(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusyKey(null);
        }
    }

    /* ── The document page (right leaf / phone sheet) ─────────────────────── */

    function DocumentLeaf({ entry }: { entry: Entry }) {
        const note = notes[entry.key] ?? entry.desk?.correction ?? entry.calendar?.notes ?? "";
        const busy = busyKey === entry.key;
        const act = acted[entry.key];
        const c = entry.calendar;
        const d = entry.desk;
        const w = entry.website;
        // The publish date under JJ's pen: the proposed one until he corrects it.
        const plannedDate = dates[entry.key] ?? (c?.date ? c.date.slice(0, 10) : "");

        return (
            <div className="paper flex h-full min-h-0 flex-col border border-paper-edge">
                {/* Letterhead */}
                <div className="border-b-[3px] border-double border-paper-edge px-5 pb-4 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="column-label column-label-paper">{entry.family} · atto in attesa</p>
                            <h2 className="document-title mt-1.5 text-[22px] text-paper-foreground">{entry.title}</h2>
                        </div>
                        <Socket
                            sealed={act?.decision === "approve"}
                            size={34}
                            justSealed={justSealed === entry.key}
                            title={act?.decision === "approve" ? "Sigillato" : undefined}
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Mark tone={stateTone(entry.stateLabel)} onPaper>{entry.stateLabel}</Mark>
                        {d?.due && <Mark tone="quiet" onPaper>entro {d.due}</Mark>}
                        {c?.date && <Mark tone="quiet" onPaper>{c.date}</Mark>}
                        <a
                            href={entry.notionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto font-condensed text-[10px] uppercase tracking-[0.14em] text-engraving-ink underline underline-offset-2 hover:text-seal"
                        >
                            Apri in Notion
                        </a>
                    </div>
                </div>

                {/* The document body — caption and assets at document scale. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {c && (
                        <>
                            {c.caption ? (
                                <div className="border-l-2 border-engraving pl-3 text-[14px] leading-relaxed text-paper-foreground whitespace-pre-wrap">
                                    {c.caption}
                                </div>
                            ) : (
                                <p className="font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                                    Caption non ancora scritta
                                </p>
                            )}
                            {c.hashtags && (
                                <p className="mt-2 break-words text-[12px] text-engraving-ink">{c.hashtags}</p>
                            )}
                            <AssetSheet media={c.media} />
                            {!c.hasAssets && c.canva && (
                                <p className="mt-3 border border-sepia px-3 py-2 text-[12px] text-sepia">
                                    Solo vecchio link Canva, nessun asset locale visibile.
                                </p>
                            )}
                        </>
                    )}

                    {d && (
                        <>
                            {d.body && <MarkdownBlock content={d.body} className="text-[13px] leading-relaxed text-paper-foreground" />}
                            <AssetSheet videos={d.videos} />
                            {d.correction && (
                                <div className="mt-3 border border-stamp px-3 py-2 text-[12px] text-stamp whitespace-pre-wrap">
                                    {d.correction}
                                </div>
                            )}
                        </>
                    )}

                    {w && (
                        <>
                            {w.liveUrl && (
                                <a href={w.liveUrl} target="_blank" rel="noreferrer" className="block text-[12px] text-engraving-ink underline underline-offset-2">
                                    {w.liveUrl}
                                </a>
                            )}
                            {w.patch && (
                                <div className="mt-3 border border-engraving px-3 py-2.5 text-[12px]">
                                    <p className="font-condensed text-[10px] font-bold uppercase tracking-[0.14em] text-engraving-ink">
                                        Patch pronta — il sigillo la applica come bozza Sanity, non pubblica
                                    </p>
                                    <p className="mt-1.5 text-paper-foreground">
                                        {w.patch.title ?? w.patch.id} · {w.patch.operations.length} operazioni · {w.patch.sanityDocId}
                                    </p>
                                    {w.patch.rationale && (
                                        <MarkdownBlock content={w.patch.rationale} className="mt-2 text-paper-foreground-soft" />
                                    )}
                                </div>
                            )}
                            {w.proposals.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {w.proposals.map((proposal, index) => (
                                        <div key={`${proposal.need}-${index}`} className="border border-paper-edge px-3 py-2.5 text-[12px]">
                                            <p className="font-bold text-paper-foreground">{proposal.need}</p>
                                            {proposal.actionStatus && <p className="mt-1 text-sepia">{proposal.actionStatus}</p>}
                                            {proposal.details && <MarkdownBlock content={proposal.details} className="mt-1.5 text-paper-foreground-soft" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* The proposed publish date — visible and correctable before the seal. */}
                    {c && (
                        <>
                            <label className="column-label column-label-paper mb-1.5 mt-5 block" htmlFor={`date-${entry.rowId}`}>
                                Data di pubblicazione proposta
                            </label>
                            <input
                                id={`date-${entry.rowId}`}
                                type="date"
                                value={plannedDate}
                                onChange={(event) => setDates((current) => ({ ...current, [entry.key]: event.target.value }))}
                                className="border border-paper-edge bg-transparent px-3 py-2 text-[13px] text-paper-foreground outline-none focus:border-engraving-ink"
                            />
                            {plannedDate && c.date && plannedDate !== c.date.slice(0, 10) && (
                                <span className="ml-3 font-condensed text-[10px] uppercase tracking-[0.14em] text-stamp">
                                    corretta — il sigillo la registra
                                </span>
                            )}
                        </>
                    )}

                    {/* The registrar's note, ruled like a ledger margin. */}
                    <label className="column-label column-label-paper mb-1.5 mt-5 block" htmlFor={`note-${entry.rowId}`}>
                        Nota a {entry.target === "website" ? "Edmondo" : "Ernesto"}
                    </label>
                    <textarea
                        id={`note-${entry.rowId}`}
                        value={note}
                        onChange={(event) => setNote(entry.key, event.target.value)}
                        rows={2}
                        placeholder="Facoltativa per il sigillo, obbligatoria per il timbro…"
                        className="w-full border border-paper-edge bg-transparent px-3 py-2 text-[13px] text-paper-foreground outline-none placeholder:text-paper-foreground-soft focus:border-engraving-ink"
                    />
                </div>

                {/* The three acts, pinned at the foot — under the thumb on a phone.
                    Once an act lands, the record replaces the buttons: one act per entry. */}
                <div className="border-t border-paper-edge bg-paper-shade px-5 py-3">
                    {act ? (
                        <div className="flex items-center gap-3" role="status">
                            {act.decision === "approve" ? (
                                <>
                                    <Socket sealed size={26} />
                                    <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-engraving-ink">
                                        Sigillato alle {new Date(act.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </>
                            ) : act.decision === "modify" ? (
                                <span
                                    className="inline-block -rotate-2 border-2 px-3 py-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.16em]"
                                    style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                                >
                                    Rimandato a {entry.target === "website" ? "Edmondo" : "Ernesto"}
                                </span>
                            ) : (
                                <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-paper-foreground-soft line-through">
                                    Annullato
                                </span>
                            )}
                            <span className="ml-auto text-[11px] italic text-paper-foreground-soft">
                                L&apos;atto è nel registro. La riga sparirà alla prossima rilettura.
                            </span>
                        </div>
                    ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            disabled={busy}
                            onClick={() => void decide(entry, "approve", note,
                                entry.target === "calendar" && plannedDate ? { date: plannedDate } : {})}
                            className="act-seal flex-1 min-w-[8rem]"
                            type="button"
                        >
                            {entry.target === "calendar" ? "Sigilla → in coda"
                                : entry.target === "website" ? (entry.website?.patch ? "Sigilla → bozza Sanity" : "Commissiona a Edmondo")
                                : "Sigilla"}
                        </button>
                        {entry.target === "calendar" && (
                            <button
                                disabled={busy}
                                onClick={() => void decide(entry, "approve", note, {
                                    ...(plannedDate ? { date: plannedDate } : {}),
                                    publishNow: true,
                                })}
                                className="act-seal flex-1 min-w-[9rem]"
                                type="button"
                                title="Sigilla e invoca subito i job di staging e pubblicazione"
                            >
                                Sigilla e pubblica ora
                            </button>
                        )}
                        <button
                            disabled={busy}
                            onClick={() => setModifyOpen(true)}
                            className="act-stamp flex-1 min-w-[7rem]"
                            type="button"
                            style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                        >
                            Timbra e rimanda
                        </button>
                        {entry.target !== "website" && (
                            <button
                                disabled={busy}
                                onClick={() => void decide(entry, "reject", note)}
                                className="act-void flex-1 min-w-[6rem]"
                                type="button"
                                style={{ color: "var(--paper-fg-soft)", borderColor: "var(--paper-edge)" }}
                            >
                                Annulla
                            </button>
                        )}
                    </div>
                    )}
                </div>
            </div>
        );
    }

    /* ── Render ───────────────────────────────────────────────────────────── */

    return (
        <AppShell>
            <div className="relative flex min-h-screen flex-col overflow-hidden">
                <Guilloche
                    size={900}
                    rings={4}
                    opacity={0.18}
                    className="pointer-events-none absolute -right-72 -top-64 h-[900px] w-[900px]"
                />

                <header className="relative border-b border-plate-rule px-8 pb-4 pt-7 max-sm:px-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="column-label">Il Cancello · l'unico varco</p>
                            <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                                {state ? (pendingEntries.length === 0 ? "Niente aspetta il tuo sigillo" : pendingEntries.length === 1 ? "Un atto aspetta il tuo sigillo" : `${pendingEntries.length} atti aspettano il tuo sigillo`) : "Apro il registro…"}
                            </h1>
                            {state && pendingEntries.length > 0 && (() => {
                                // The registrar's line: what stands at the gate, in one sentence.
                                const social = pendingEntries.filter((e) => e.family === "Social").length;
                                const deskN = pendingEntries.filter((e) => e.family === "Desk").length;
                                const web = pendingEntries.filter((e) => e.family === "Website").length;
                                const oldest = Math.max(0, ...pendingEntries.map((e) => e.dueDays ?? 0));
                                const parts = [
                                    social > 0 && `${social === 1 ? "un atto" : `${social} atti`} dal calendario sociale`,
                                    deskN > 0 && `${deskN === 1 ? "uno" : deskN} dalla scrivania di Ernesto`,
                                    web > 0 && `${web === 1 ? "una patch" : `${web} patch`} dal sito`
                                ].filter(Boolean);
                                return (
                                    <p className="mt-2 max-w-[34rem] text-[13px] italic leading-relaxed text-plate-foreground-soft">
                                        {parts.join(", ")}.{oldest > 0 ? ` Il più vecchio attende da ${oldest === 1 ? "un giorno" : `${oldest} giorni`}.` : ""}
                                    </p>
                                );
                            })()}
                            {state && (
                                <p className="mt-1.5 font-condensed text-[10px] uppercase tracking-[0.14em] text-plate-foreground-soft">
                                    aggiornato {new Date(state.generatedAt).toLocaleTimeString("it-IT")}{state.cached ? " · cache" : ""}
                                </p>
                            )}
                        </div>
                        <button onClick={() => void load(true)} className="act-quiet" type="button">
                            Rileggi da Notion
                        </button>
                    </div>
                </header>

                {toast && (
                    <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 border border-seal-deep bg-seal px-5 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-paper">
                        {toast}
                    </div>
                )}
                {error && (
                    <div className="relative mx-8 mt-4 border border-seal px-4 py-3 text-[13px] text-seal-bright max-sm:mx-4" role="alert">
                        {error}
                    </div>
                )}

                {/* The spread: register on the left, document on the right. */}
                <div className="relative flex min-h-0 flex-1 gap-0 px-8 py-6 max-sm:px-0 max-sm:py-0">
                    {/* Left page — the ruled register. */}
                    <section
                        className={[
                            "paper flex min-h-0 min-w-0 flex-1 flex-col border border-paper-edge max-sm:border-x-0",
                            open ? "max-w-[26rem] max-lg:hidden" : "max-w-none"
                        ].join(" ")}
                        aria-label="Registro degli atti in attesa"
                    >
                        <div className="flex items-baseline justify-between border-b-[3px] border-double border-paper-edge px-4 py-2.5">
                            <span className="column-label column-label-paper">Atto</span>
                            <span className="column-label column-label-paper">Sigillo</span>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {!state ? (
                                <p className="px-4 py-8 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                                    Carico ciò che aspetta il tuo giudizio…
                                </p>
                            ) : entries.length === 0 ? (
                                <div className="px-4 py-12 text-center">
                                    <Socket sealed size={40} />
                                    <p className="mt-3 text-[13px] text-paper-foreground-soft">
                                        Ogni atto è deciso. Il resto della casa è qui sotto.
                                    </p>
                                </div>
                            ) : (
                                <ul>
                                    {entries.map((entry) => {
                                        const active = entry.key === openKey;
                                        const act = acted[entry.key];
                                        return (
                                            <li key={entry.key}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenKey(active ? null : entry.key)}
                                                    aria-expanded={active}
                                                    className={[
                                                        "flex w-full items-center gap-3 border-b border-paper-edge px-4 py-3 text-left transition-colors",
                                                        active ? "bg-[var(--engraving-wash)]" : "hover:bg-[var(--engraving-wash)]"
                                                    ].join(" ")}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className={[
                                                            "truncate text-[14px] font-semibold",
                                                            act?.decision === "reject" ? "text-paper-foreground-soft line-through" : "text-paper-foreground"
                                                        ].join(" ")}>{entry.title}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <Mark tone={stateTone(entry.stateLabel)} onPaper>{entry.family}</Mark>
                                                            <span className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                                                                {entry.stateLabel}
                                                            </span>
                                                            {entry.hasMedia && (
                                                                <span className="font-condensed text-[10px] uppercase tracking-[0.12em] text-engraving-ink">
                                                                    · asset
                                                                </span>
                                                            )}
                                                        </div>
                                                        {entry.dueDays !== null && entry.dueDays > 0 && (
                                                            <div className="mt-1.5"><AgeBar days={entry.dueDays} /></div>
                                                        )}
                                                    </div>
                                                    {act?.decision === "modify" ? (
                                                        <span
                                                            className="inline-block -rotate-3 border px-1.5 py-0.5 font-condensed text-[9px] font-bold uppercase tracking-[0.12em]"
                                                            style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                                                        >
                                                            Rimandato
                                                        </span>
                                                    ) : (
                                                        <Socket
                                                            sealed={act?.decision === "approve"}
                                                            size={24}
                                                            justSealed={justSealed === entry.key}
                                                            title={act?.decision === "approve" ? "Sigillato" : undefined}
                                                        />
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* The rest of the house, folded under the register. */}
                        {state && (
                            <div className="border-t-[3px] border-double border-paper-edge">
                                {laterSections.map((section) => (
                                    <details key={section.label} className="group border-b border-paper-edge last:border-b-0">
                                        <summary className="flex cursor-pointer items-baseline justify-between px-4 py-2.5 hover:bg-[var(--engraving-wash)]">
                                            <span className="column-label column-label-paper">{section.label}</span>
                                            <span className="serial text-paper-foreground-soft">[{section.rows.length}]</span>
                                        </summary>
                                        {section.rows.length > 0 ? (
                                            <ul className="pb-2">
                                                {section.rows.map((row) => (
                                                    <li key={row.key} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
                                                        <a
                                                            href={row.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="min-w-0 truncate text-[13px] text-paper-foreground hover:text-engraving-ink hover:underline"
                                                        >
                                                            {row.title}
                                                        </a>
                                                        <span className="whitespace-nowrap font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                                                            {row.state}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="px-4 pb-3 text-[12px] text-paper-foreground-soft">Vuoto.</p>
                                        )}
                                    </details>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Perforation between the two pages. */}
                    {open && <div className="perforation-y mx-4 max-lg:hidden" aria-hidden="true" />}

                    {/* Right page — the open document (desktop). */}
                    {open && (
                        <section className="min-h-0 min-w-0 flex-1 max-lg:hidden" aria-label="Documento aperto">
                            <DocumentLeaf entry={open} />
                        </section>
                    )}
                </div>

                {/* Phone: the document opens over the register, acts under the thumb. */}
                {open && (
                    <div className="fixed inset-0 z-[60] hidden max-lg:flex flex-col bg-plate-deep/80">
                        <button
                            type="button"
                            aria-label="Chiudi il documento"
                            className="h-14 flex-none"
                            onClick={() => setOpenKey(null)}
                        />
                        <div className="min-h-0 flex-1 px-2 pb-2">
                            <div className="relative h-full">
                                <button
                                    type="button"
                                    onClick={() => setOpenKey(null)}
                                    className="absolute -top-10 right-2 z-10 border border-plate-rule bg-plate px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-plate-foreground"
                                >
                                    Chiudi
                                </button>
                                <DocumentLeaf entry={open} />
                            </div>
                        </div>
                    </div>
                )}

                {/* The stamp dialog: what must change, and to whom it goes back. */}
                {modifyOpen && open && (
                    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-plate-deep/85 p-4">
                        <section className="paper w-full max-w-lg border border-paper-edge" role="dialog" aria-modal="true" aria-label="Timbra e rimanda">
                            <div className="border-b-[3px] border-double border-paper-edge px-5 py-4">
                                <p className="column-label" style={{ color: "var(--stamp)" }}>
                                    Timbro · nota a {open.target === "website" ? "Edmondo" : "Ernesto"}
                                </p>
                                <h2 className="document-title mt-1 text-[19px] text-paper-foreground">Cosa va modificato?</h2>
                                <p className="mt-1 truncate text-[13px] text-paper-foreground-soft">{open.title}</p>
                            </div>
                            <div className="px-5 py-4">
                                <textarea
                                    value={notes[open.key] ?? ""}
                                    onChange={(event) => setNote(open.key, event.target.value)}
                                    rows={6}
                                    autoFocus
                                    placeholder={open.target === "website"
                                        ? "Scrivi a Edmondo cosa deve rilavorare, correggere o verificare…"
                                        : "Scrivi a Ernesto cosa deve cambiare, rigenerare o correggere…"}
                                    className="w-full border border-paper-edge bg-transparent px-3 py-2 text-[13px] text-paper-foreground outline-none placeholder:text-paper-foreground-soft focus:border-engraving-ink"
                                />
                                <div className="mt-4 flex justify-end gap-2">
                                    <button onClick={() => setModifyOpen(false)} className="act-void" type="button" style={{ color: "var(--paper-fg-soft)", borderColor: "var(--paper-edge)" }}>
                                        Annulla
                                    </button>
                                    <button
                                        disabled={busyKey === open.key || !(notes[open.key] ?? "").trim()}
                                        onClick={() => void decide(open, "modify", notes[open.key] ?? "")}
                                        className="act-stamp"
                                        type="button"
                                        style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                                    >
                                        Timbra e rimanda
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

"use client";

import { SnapshotFreshness } from "../../components/SnapshotFreshness";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTransientStateFailure, retryAfterSeconds, STATE_RETRY_SECONDS } from "../../lib/cancello/state-retry";
import Link from "next/link";
import MarkdownBlock from "../../components/MarkdownBlock";
import AssetSheet from "../../components/cancello/AssetSheet";
import PostPreview from "../../components/cancello/PostPreview";
import { composePosts } from "../../lib/cancello/post-preview";
import { capForSeal, deskFamily, gateCalendarIds, shadowedByCalendar, localToday, needsNewDate } from "../../lib/house/families";
import { Guilloche, Socket, Mark, AgeBar, type MarkTone } from "../../components/Registro";
import { useSession } from "next-auth/react";
import { latestMark, type CollaboratorMark } from "../../lib/cancello/notes";

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

type Decision = "approve" | "modify" | "reject" | "done" | "delete" | "send" | "comment" | "ready" | "request";
type Target = "desk" | "calendar" | "website";

interface VideoRef { url: string; name?: string; path?: string; ageDays?: number }
interface MediaRef { kind: "image" | "video"; url: string }
interface DeskRow {
    rowId: string; url: string; title: string; type: string; status: string;
    priority: string; due: string | null; correction: string; body: string;
    videos: VideoRef[]; media: MediaRef[]; calendarRowIds?: string[];
}
interface CalendarRow {
    rowId: string; title: string; contentType: string | null; status: string; platforms: string | null;
    date: string | null; variant: string | null; caption: string; hashtags: string; notes: string;
    canva: string | null; hasAssets: boolean; media: MediaRef[]; url: string;
    orderedBy?: string | null; sanitySync?: string;
    /** A story's link destination. */
    sourceUrl?: string | null;
    staged?: { platform: string; format: string | null; caption: string; hashtags: string[];
        storyLinkUrl: string | null; images: MediaRef[]; video: MediaRef | null }[];
    mediaUnavailable?: number;
    mediaIgnored?: number;
}
interface WebsiteArticle {
    rowId: string; title: string; status: string | null; category: string | null; reviewDue: string | null;
    lastReviewed: string | null; liveUrl: string | null; url: string;
    proposals: { need: string; details: string; actionStatus: string | null; url: string }[];
    patch: {
        id: string; title: string | null; rationale: string | null; sources: string[];
        operations: { type: string; anchorText: string | null; newText: string | null; blocksText: string | null; blocksCount: number }[];
        sanityDocId: string; batch?: string;
    } | null;
    patchState?: "awaiting-publish" | "published";
    draftId?: string;
}
interface ReviewState { readModel?: import("../../lib/cockpit/snapshots").SnapshotFreshness;
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
    family: "Social" | "Buffer" | "Desk" | "Website";
    title: string;
    stateLabel: string;
    dueDays: number | null;
    hasMedia: boolean;
    notionUrl: string;
    /** A collaborator's latest mark ("ready for JJ" or "changes requested"), read once from the row's notes. */
    mark?: CollaboratorMark | null;
    desk?: DeskRow;
    calendar?: CalendarRow;
    website?: WebsiteArticle;
}

interface HandOff {
    outcome: "not-approved" | "awaiting-staging" | "handed-off" | "partial";
    calendarStatus?: string;
    posts: { sanityId: string; outcome: string; detail?: string }[];
}

/** One honest line on what reached Buffer — never "sent" for what did not. */
function describeHandOff(send: HandOff | undefined): string {
    if (!send) return "Sigillato";
    if (send.outcome === "awaiting-staging") return "Sigillato — partirà da solo appena i post sono preparati in Sanity";
    if (send.outcome === "not-approved") return "La riga non è approvata: niente da consegnare";
    if (send.outcome === "handed-off") {
        const studio = send.posts.some((p) => p.detail?.includes("not published in Studio")) ? " · Studio NON aggiornato" : " · pubblicato in Studio";
        return (send.calendarStatus === "Published" ? "Uscito su Buffer" : "In coda su Buffer") + studio + " — topic chiuso";
    }
    const problems = send.posts.filter((p) => p.outcome !== "sent" && p.outcome !== "already-sent");
    return `Consegna incompleta: ${problems.map((p) => `${p.sanityId.replace(/^social-[0-9a-f-]+-/, "")} ${p.outcome}${p.detail ? ` (${p.detail})` : ""}`).join("; ")}`;
}

function daysUntil(due: string | null): number | null {
    if (!due) return null;
    const t = new Date(due).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.floor((Date.now() - t) / 86_400_000);
}

/** A social post's line in the queue: where and when, in words — no internal labels. */
function socialLine(row: { platforms: string | null; date: string | null }): string {
    const when = row.date
        ? new Date(row.date.length === 10 ? `${row.date}T12:00:00` : row.date)
            .toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })
        : "data non ancora fissata";
    return [row.platforms, when].filter(Boolean).join(" · ");
}

/** A social post in Review whose publish day is already behind us. */
function slotPassed(entry: { family: string; dueDays: number | null }): boolean {
    return entry.family === "Social" && entry.dueDays !== null && entry.dueDays > 0;
}

function stateTone(value: string): MarkTone {
    // Oxblood is the press and what has failed; a priority is a word, in
    // sepia, so ninety-nine "urgent" rows do not drown the one real alarm.
    if (/Blocked|Rejected|FALLITA/i.test(value)) return "pending";
    if (/Urgent|Review|Pending|Needs|Draft|Modify/i.test(value)) return "ageing";
    if (/Approved|Scheduled|bozza|patch/i.test(value)) return "sealed";
    return "quiet";
}


/* ===========================================================================
   THE PAGE
   ========================================================================= */

export default function ReviewPage() {
    // The social media manager sees the social rows only, and speaks on them
    // (comment, ready for JJ, send back); the seal and every closing act stay
    // JJ's. The server enforces this; the page only stops offering what
    // would be refused.
    const { data: session, status: sessionStatus } = useSession();
    const isSocial = session?.user?.role === "social";
    /**
     * The register speaks Italian to everyone (JJ, 27/11/2026). The first
     * form is addressed to JJ, who seals; the second to the social media
     * manager, who checks, comments and asks for changes but never seals.
     */
    const tr = useCallback((jj: string, social: string) => (isSocial ? social : jj), [isSocial]);
    // load() reads the language through a ref, so a session resolving after
    // the first read does not trigger a second one.
    const trRef = useRef(tr);
    trRef.current = tr;
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

    // Seconds until the next automatic read, set only when the server says
    // the state is still being rebuilt (503 CANCELLO_STATE_TIMEOUT).
    // An object, not a number: two equal waits in a row must still re-arm the timer.
    const [retry, setRetry] = useState<{ seconds: number } | null>(null);

    // Only the latest read may speak: an older one landing late (a retry
    // overtaken by "Rileggi" or by the read after an act) is ignored.
    const readSeq = useRef(0);

    const load = useCallback(async (refresh = false) => {
        const mine = ++readSeq.current;
        const current = () => mine === readSeq.current;
        setError(null);
        setRetry(null);
        let res: Response;
        try {
            res = await fetch(`/api/review-dashboard/state${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
        } catch {
            if (!current()) return;
            setError(trRef.current("Review dashboard non raggiungibile.", "Non riesco a raggiungere la coda."));
            setRetry({ seconds: STATE_RETRY_SECONDS });
            return;
        }
        if (!res.ok) {
            // A proxy error page (502/504 while the service restarts) is not JSON.
            const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
            if (!current()) return;
            setError(trRef.current(data.error ?? `Review dashboard non disponibile (${res.status})`, "La coda al momento non è disponibile."));
            if (isTransientStateFailure(res.status, data)) {
                setRetry({ seconds: retryAfterSeconds(res.headers.get("retry-after")) });
            }
            return;
        }
        let data: ReviewState;
        try {
            data = await res.json() as ReviewState;
        } catch {
            // A body cut off mid-restart: say so and ask again, never render it.
            if (!current()) return;
            setError(trRef.current("Review dashboard: risposta incompleta.", "La coda ha risposto a metà: riprovo."));
            setRetry({ seconds: STATE_RETRY_SECONDS });
            return;
        }
        if (!current()) return;
        // No setError(null) here: an act's own error set while this read was
        // in flight must stay; the clear at the start of load() is enough.
        setState(data);
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (retry === null) return;
        const timer = setTimeout(() => { void load(); }, retry.seconds * 1000);
        return () => clearTimeout(timer);
    }, [retry, load]);

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

    const allEntries = useMemo<Entry[]>(() => {
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
            hasMedia: row.videos.length > 0 || (row.media?.length ?? 0) > 0,
            notionUrl: row.url,
            desk: row
        });
        // Only the editorial family stands at this gate: what is to be
        // published, cut or captioned. Questions, plans and recommendations
        // are answered at Le Questioni, never sealed here.
        const carries = (row: DeskRow) => row.videos.length > 0 || (row.media?.length ?? 0) > 0;
        const gateIds = gateCalendarIds(state.calendar);
        // A desk row that re-offers a Calendar row already listed below is
        // shown once, as that Calendar row.
        const editorial = (row: DeskRow) => deskFamily(row.type, carries(row)) === "editorial" && !shadowedByCalendar(row, gateIds);
        return [
            ...state.wall.filter(editorial).map(fromDesk),
            ...state.calendar
                .filter((row) => row.status === "Review")
                .map((row): Entry => ({
                    key: `calendar:${row.rowId}`,
                    rowId: row.rowId,
                    target: "calendar",
                    family: "Social",
                    title: row.title,
                    // The slot date is shown, and a passed slot ages like any
                    // overdue item: a Review row whose day is gone is stale.
                    stateLabel: [row.orderedBy === "JJ" ? tr("Ordine JJ", "Ordine di JJ") : null, row.contentType, row.platforms, row.date]
                        .filter(Boolean).join(" · ") || "Social",
                    dueDays: daysUntil(row.date),
                    hasMedia: row.media.length > 0,
                    notionUrl: row.url,
                    mark: latestMark(row.notes ?? ""),
                    calendar: row
                })),
            // Approved and staged, not yet in Buffer. Since 27 November JJ's
            // approval sends every row by itself, so a row here is either on its
            // way (the next Buffer sweep sends it) or one approved under the old
            // rule, which waits for "Invia a Buffer".
            ...state.calendar
                .filter((row) => row.status === "Approved" && Boolean(row.sanitySync))
                .map((row): Entry => ({
                    key: `buffer:${row.rowId}`,
                    rowId: row.rowId,
                    target: "calendar",
                    family: "Buffer",
                    title: row.title,
                    stateLabel: ["Approvato · non ancora su Buffer",
                        row.contentType, row.platforms, row.date].filter(Boolean).join(" · "),
                    dueDays: daysUntil(row.date),
                    hasMedia: row.media.length > 0,
                    notionUrl: row.url,
                    calendar: row
                })),
            ...state.desk
                .filter((row) => row.status === "Pending" && !wallIds.has(row.rowId) && editorial(row))
                .map(fromDesk),
            // Only a written patch is JJ's to seal. A proposal with no patch
            // is Edmondo's work in progress and is listed under the register.
            ...state.website
                .filter((row) => row.patch)
                .map((row): Entry => ({
                    key: `website:${row.rowId}`,
                    rowId: row.rowId,
                    target: "website",
                    family: "Website",
                    title: row.title,
                    // A draft already staged opens like any document — the change
                    // is read HERE, not on Notion; only the final publish lives
                    // in Sanity Studio.
                    stateLabel: row.patch
                        ? row.patchState === "awaiting-publish" ? "Bozza in Sanity — da pubblicare" : "Patch pronta"
                        : `${row.proposals.length === 1 ? "Una proposta" : `${row.proposals.length} proposte`} · nessuna patch`,
                    dueDays: null,
                    hasMedia: false,
                    notionUrl: row.url,
                    website: row
                }))
        ];
    }, [state, tr]);
    // JJ's register shows at most SEAL_CAP acts; the rest wait in a queue
    // listed under it (JJ, 27/11/2026). The collaborator's queue is unchanged.
    const { entries, held } = useMemo(() => {
        if (isSocial) return { entries: allEntries.filter((e) => e.family === "Social"), held: [] as Entry[] };
        const split = capForSeal(allEntries.map((e) => ({ ...e, priority: e.desk?.priority ?? null })));
        return { entries: split.shown as Entry[], held: split.held as Entry[] };
    }, [allEntries, isSocial]);

    const open = entries.find((e) => e.key === openKey) ?? null;
    const pendingEntries = entries.filter((e) => !acted[e.key]);

    const laterSections = useMemo(() => {
        if (!state) return [];
        return [
            ...(held.length > 0 ? [{
                label: tr("In coda — salgono man mano che sigilli", "In coda — salgono man mano che JJ sigilla"),
                rows: held.map((e) => ({ key: `h:${e.key}`, title: e.title, state: e.stateLabel, url: e.notionUrl }))
            }] : []),
            // The website and the desk are JJ's: the social media manager's
            // queue shows the social calendar only.
            ...(isSocial ? [] : [{
                label: "Sito · proposte senza patch (al lavoro di Edmondo)",
                rows: state.website
                    .filter((r) => !r.patch && r.proposals.length > 0)
                    .map((r) => ({ key: `w:${r.rowId}`, title: r.title, state: `${r.proposals.length}`, url: r.url }))
            }]),
            {
                label: tr("In lavorazione adesso", "In lavorazione adesso"),
                rows: [
                    ...state.calendar
                        .filter((r) => r.status === "In Production" || r.status === "Draft")
                        .map((r) => ({ key: `c:${r.rowId}`, title: r.title, state: r.status, url: r.url })),
                    ...(isSocial ? [] : state.desk)
                        .filter((r) => r.status === "In production" && deskFamily(r.type, r.videos.length > 0 || (r.media?.length ?? 0) > 0) === "editorial")
                        .map((r) => ({ key: `d:${r.rowId}`, title: r.title, state: r.status, url: r.url }))
                ]
            },
            ...(isSocial ? [] : [{
                label: "In coda — approvati, in attesa di uno slot",
                rows: state.desk
                    .filter((r) => r.status === "Approved" && deskFamily(r.type, r.videos.length > 0 || (r.media?.length ?? 0) > 0) === "editorial")
                    .map((r) => ({ key: `d:${r.rowId}`, title: r.title, state: "Approved", url: r.url }))
            }]),
            {
                label: tr("Programmati verso pubblicazione", "Programmati per la pubblicazione"),
                rows: state.calendar
                    .filter((r) => r.status === "Scheduled")
                    .map((r) => ({ key: `c:${r.rowId}`, title: r.title, state: r.date ?? "Scheduled", url: r.url }))
            }
        ];
    }, [state, tr, held, isSocial]);

    /* ── Acts ─────────────────────────────────────────────────────────────── */

    function setNote(key: string, value: string) {
        setNotes((current) => ({ ...current, [key]: value }));
    }

    async function decide(
        entry: Entry,
        decision: Decision,
        comment: string,
        opts: { date?: string } = {}
    ) {
        if ((decision === "modify" || decision === "comment" || decision === "request") && !comment.trim()) {
            setError(isSocial ? "Scrivi cosa va cambiato: la nota resta sul post." : entry.target === "website"
                ? "Scrivi cosa va cambiato: il timbro porta la nota a Edmondo."
                : "Scrivi cosa va cambiato: il timbro porta la nota a Ernesto.");
            return;
        }
        if (decision === "reject" && !comment.trim() && !window.confirm("Rifiutare senza motivo?")) return;
        if (decision === "delete" && !window.confirm(
            comment.trim()
                ? "Eliminare questa proposta dal database? Il motivo scritto sarà conservato in Notion."
                : "Eliminare questa proposta dal database senza indicare un motivo?"
        )) return;

        setBusyKey(entry.key);
        setError(null);
        try {
            const res = await fetch("/api/review-dashboard/decision", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    rowId: entry.rowId, decision, comment, target: entry.target,
                    ...(opts.date ? { date: opts.date } : {}),
                }),
            });
            const result = await res.json();
            if (!res.ok || !result.ok) {
                // The social view says what happened in plain words; a raw
                // server or Notion message is for JJ's register only.
                throw new Error(isSocial
                    ? (res.status === 403 && result.error ? result.error : "Non salvato. Riprova tra un momento.")
                    : result.error ?? "Decisione non salvata");
            }
            // A note is not a decision: the row stays open for more acts.
            if (decision === "comment" || decision === "ready" || decision === "request") {
                setNote(entry.key, "");
                setModifyOpen(false);
                setToast(decision === "ready" ? "Segnato pronto per JJ" : decision === "request" ? "Modifiche chieste — JJ lo vedrà" : "Nota aggiunta");
                setTimeout(() => setToast(null), 2600);
                await load();
                return;
            }
            recordAct(entry.key, decision);
            if (decision === "approve") {
                setJustSealed(entry.key);
                setTimeout(() => setJustSealed(null), 1200);
            }
            // The act stood; only its note did not fit. Say so where JJ looks.
            const skipped = result.noteSkipped ? " · nota NON salvata" : "";
            const message = (
                decision === "send" || (decision === "approve" && result.send)
                    ? describeHandOff(result.send)
                    : decision === "approve"
                    ? (result.awaitingSecondFlip ? "Sigillato — dopo lo staging resta «Invia a Buffer»" : "Sigillato")
                    : decision === "modify" ? "Timbrato e rimandato"
                    : decision === "done" ? "Archiviato — non tornerà a chiedere"
                    : decision === "delete" ? "Eliminato — non tornerà nel Cancello"
                    : "Rifiutato"
            );
            setToast(message + skipped);
            setTimeout(() => setToast(null), decision === "send" ? 6000 : 2600);
            setModifyOpen(false);
            // The document stays open: the point of the act is seeing the wax land.
            // No forced full re-read: the act already fenced the server's
            // snapshot, so this read is rebuilt from what changed.
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusyKey(null);
        }
    }

    /* ── The document page (right leaf / phone sheet) ─────────────────────── */

    function DocumentLeaf({ entry }: { entry: Entry }) {
        // Calendar notes are appended to the row's history, so the box starts
        // empty (pre-filling it would write the history twice). The Desk's
        // Correction is still JJ's latest instruction, overwritten: his
        // previous one is offered for editing, as before.
        const note = notes[entry.key] ?? (entry.target === "desk" && !isSocial ? entry.desk?.correction ?? "" : "");
        // The house's machine markers share the field; the social media
        // manager is shown the people's lines only, JJ everything.
        const rawHistory = (entry.calendar?.notes ?? entry.desk?.correction ?? "").trim();
        const history = isSocial
            ? rawHistory.split("\n").filter((l) => /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} · /.test(l)).join("\n")
            : rawHistory;
        const notesBlock = (
            <details className="mb-4 border border-paper-edge px-3 py-2" open={isSocial}>
                <summary className="column-label column-label-paper cursor-pointer">
                    {isSocial ? "Note su questo post" : "Note sulla riga"}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-paper-foreground">{history}</pre>
            </details>
        );
        const mark = entry.mark ?? null;
        const busy = busyKey === entry.key;
        const act = acted[entry.key];
        const c = entry.calendar;
        const d = entry.desk;
        const w = entry.website;
        // The publish date under JJ's pen: the proposed one until he corrects it.
        const plannedDate = dates[entry.key] ?? (c?.date ? c.date.slice(0, 10) : "");
        // Approving publishes: a post whose day has gone would go out at
        // once on a stale slot. The seal waits for a date from today on.
        const needsDate = Boolean(c) && needsNewDate({ proposed: c?.date ?? null, planned: plannedDate });

        return (
            <div className="paper flex h-full min-h-0 flex-col border border-paper-edge">
                {/* Letterhead */}
                <div className="border-b-[3px] border-double border-paper-edge px-5 pb-4 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="column-label column-label-paper">{isSocial ? "In attesa di revisione" : `${entry.family} · atto in attesa`}</p>
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
                        {/* The post preview below says what and when; the social view
                            carries no internal labels up here. */}
                        {!isSocial && <Mark tone={stateTone(entry.stateLabel)} onPaper>{entry.stateLabel}</Mark>}
                        {d?.due && <Mark tone="quiet" onPaper>entro {d.due}</Mark>}
                        {c?.date && !isSocial && <Mark tone="quiet" onPaper>{c.date}</Mark>}
                        {mark && (
                            <Mark tone={mark.kind === "ready" ? "sealed" : "ageing"} onPaper>
                                {`${mark.kind === "ready" ? tr("Controllato da", "Controllato da") : tr("Modifiche chieste da", "Modifiche chieste da")} ${mark.by} · ${mark.at}`}
                            </Mark>
                        )}
                        {!isSocial && <a
                            href={entry.notionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto font-condensed text-[10px] uppercase tracking-[0.14em] text-engraving-ink underline underline-offset-2 hover:text-seal"
                        >
                            Apri in Notion
                        </a>}
                    </div>
                </div>

                {/* The document body — caption and assets at document scale. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {history && !isSocial && notesBlock}
                    {c && (
                        // The post as it will go out — media in order, the exact text,
                        // where and when — composed the way the pipeline composes it.
                        <div className="flex flex-col gap-8">
                            {composePosts(c).map((post, i) => (
                                <PostPreview key={`${c.rowId}-${i}`} post={post} date={c.date} lang="it" />
                            ))}
                            {!isSocial && !c.hasAssets && c.canva && (
                                <p className="border border-sepia px-3 py-2 text-[12px] text-sepia">
                                    Solo vecchio link Canva, nessun asset locale visibile.
                                </p>
                            )}
                        </div>
                    )}
                    {/* The social view reads the post first, then what people said about it. */}
                    {history && isSocial && <div className="mt-5">{notesBlock}</div>}

                    {d && (
                        <>
                            {d.body && <MarkdownBlock content={d.body} className="text-[13px] leading-relaxed text-paper-foreground" />}
                            <AssetSheet videos={d.videos} media={d.media} />
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
                                        {w.patchState === "awaiting-publish"
                                            ? "Bozza già in Sanity — rileggi qui, pubblica in Studio"
                                            : "Patch pronta — il sigillo la applica come bozza Sanity, non pubblica"}
                                    </p>
                                    <p className="mt-1.5 text-paper-foreground">
                                        {w.patch.title ?? w.patch.id} · {w.patch.operations.length} operazioni
                                    </p>
                                    {w.patch.rationale && (
                                        <MarkdownBlock content={w.patch.rationale} className="mt-2 text-paper-foreground-soft" />
                                    )}

                                    {/* What the draft actually does, change by change:
                                        the text as it stands on the left, the correction
                                        on the right, so the two are read against each other. */}
                                    <div className="mt-3 space-y-3">
                                        {w.patch.operations.map((op, index) => (
                                            <div key={index} className="border-l-2 border-engraving pl-2.5">
                                                <p className="font-condensed text-[10px] font-bold uppercase tracking-[0.12em] text-engraving-ink">
                                                    {index + 1} · {op.type === "replace-text" ? "Sostituisce"
                                                        : op.type === "insert-after" ? `Inserisce ${op.blocksCount} blocco/i dopo`
                                                        : op.type === "append" ? `Aggiunge ${op.blocksCount} blocco/i in coda`
                                                        : op.type}
                                                </p>
                                                <div className="mt-1.5 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                                                    <div className="min-w-0">
                                                        <p className="font-condensed text-[10px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                                                            {op.type === "replace-text" ? "Testo attuale" : "Punto di ancoraggio"}
                                                        </p>
                                                        <p className={`mt-0.5 whitespace-pre-wrap ${op.type === "replace-text" ? "text-paper-foreground-soft line-through decoration-[var(--seal)]" : "text-paper-foreground-soft"}`}>
                                                            {op.anchorText ?? "—"}
                                                        </p>
                                                    </div>
                                                    <div className="min-w-0 border-l border-paper-edge pl-3 max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-2">
                                                        <p className="font-condensed text-[10px] uppercase tracking-[0.14em] text-engraving-ink">Correzione</p>
                                                        <p className="mt-0.5 whitespace-pre-wrap text-paper-foreground">
                                                            {op.newText ?? op.blocksText ?? "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {w.proposals.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <p className="font-condensed text-[10px] font-bold uppercase tracking-[0.14em] text-engraving-ink">
                                        {w.proposals.length === 1 ? "Proposta sulla pagina" : "Proposte sulla pagina"}
                                        {!w.patch && " · il sigillo commissiona la patch a Edmondo"}
                                    </p>
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

                </div>

                {/* The command bar: date, note and the three acts live TOGETHER,
                    pinned at the foot and always in view — one level, no travel.
                    Once an act lands, the record replaces the buttons. */}
                <div className="border-t border-paper-edge bg-paper-shade px-5 py-3">
                    {w?.patchState === "awaiting-publish" ? (
                        <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-engraving-ink">
                            La bozza è già in Sanity ({w.draftId ?? "drafts"}) — l&apos;unico atto che resta è pubblicarla in Studio.
                        </p>
                    ) : (
                    <>
                    {!act && (
                        <div className="mb-2.5 flex flex-wrap items-end gap-3">
                            {c && !isSocial && (
                                <label className="text-[10px] font-condensed uppercase tracking-[0.14em] text-paper-foreground-soft">
                                    Pubblicazione
                                    <input
                                        id={`date-${entry.rowId}`}
                                        type="date"
                                        min={localToday()}
                                        value={plannedDate}
                                        onChange={(event) => setDates((current) => ({ ...current, [entry.key]: event.target.value }))}
                                        className="mt-1 block border border-paper-edge bg-transparent px-2.5 py-1.5 text-[13px] normal-case tracking-normal text-paper-foreground outline-none focus:border-engraving-ink"
                                    />
                                </label>
                            )}
                            <label className="min-w-[12rem] flex-1 text-[10px] font-condensed uppercase tracking-[0.14em] text-paper-foreground-soft">
                                {isSocial ? "La tua nota" : <>Nota a {entry.target === "website" ? "Edmondo" : "Ernesto"}</>}
                                <input
                                    id={`note-${entry.rowId}`}
                                    value={note}
                                    onChange={(event) => setNote(entry.key, event.target.value)}
                                    placeholder={isSocial ? "Cosa va cambiato, o cosa hai controllato…" : "Facoltativa per il sigillo, obbligatoria per il timbro…"}
                                    className="mt-1 block w-full border border-paper-edge bg-transparent px-2.5 py-1.5 text-[13px] normal-case tracking-normal text-paper-foreground outline-none placeholder:text-paper-foreground-soft focus:border-engraving-ink"
                                />
                            </label>
                            {c && plannedDate && c.date && plannedDate !== c.date.slice(0, 10) && (
                                <span className="pb-2 font-condensed text-[10px] uppercase tracking-[0.14em] text-stamp">
                                    data corretta
                                </span>
                            )}
                        </div>
                    )}
                    {act ? (
                        <div className="flex items-center gap-3" role="status">
                            {act.decision === "approve" ? (
                                <>
                                    <Socket sealed size={26} />
                                    <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-engraving-ink">
                                        Sigillato alle {new Date(act.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </>
                            ) : act.decision === "send" ? (
                                <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-engraving-ink">
                                    Consegnato a Buffer alle {new Date(act.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            ) : act.decision === "modify" ? (
                                <span
                                    className="inline-block -rotate-2 border-2 px-3 py-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.16em]"
                                    style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                                >
                                    Rimandato a {entry.target === "website" ? "Edmondo" : "Ernesto"}
                                </span>
                            ) : (
                                <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-paper-foreground-soft line-through">
                                    {act.decision === "done" ? "Archiviato"
                                        : act.decision === "delete" ? "Eliminato"
                                        : "Rifiutato"}
                                </span>
                            )}
                            <span className="ml-auto text-[11px] italic text-paper-foreground-soft">
                                L&apos;atto è nel registro. La riga sparirà alla prossima rilettura.
                            </span>
                        </div>
                    ) : (
                    isSocial ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            disabled={busy}
                            onClick={() => void decide(entry, "ready", note)}
                            className="act-seal flex-1 min-w-[8rem]"
                            type="button"
                            title="Dice a JJ che hai controllato questo post; la tua nota va con lui. Non pubblica."
                        >
                            Pronto per JJ
                        </button>
                        <button
                            disabled={busy || !note.trim()}
                            onClick={() => void decide(entry, "comment", note)}
                            className="act-void flex-1 min-w-[7rem]"
                            type="button"
                            style={{ color: "var(--paper-fg)", borderColor: "var(--paper-edge)" }}
                            title="Aggiunge la tua nota alla storia del post senza cambiarne lo stato"
                        >
                            Aggiungi nota
                        </button>
                        <button
                            disabled={busy}
                            onClick={() => setModifyOpen(true)}
                            className="act-stamp flex-1 min-w-[7rem]"
                            type="button"
                            style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                            title="Chiede modifiche con la tua nota; JJ decide se rimandare il post"
                        >
                            Chiedi modifiche
                        </button>
                    </div>
                    ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        {entry.family === "Buffer" ? (
                        <button
                            disabled={busy}
                            onClick={() => void decide(entry, "send", note)}
                            className="act-seal flex-1 min-w-[8rem]"
                            type="button"
                            title="Consegna a Buffer i post già preparati in Sanity per questa riga"
                        >
                            Invia a Buffer
                        </button>
                        ) : (
                        <button
                            disabled={busy || needsDate}
                            onClick={() => void decide(entry, "approve", note,
                                entry.target === "calendar" && plannedDate ? { date: plannedDate } : {})}
                            className="act-seal flex-1 min-w-[8rem]"
                            type="button"
                            title={needsDate ? "La data di uscita è passata: scegline una nuova qui sopra" : undefined}
                        >
                            {entry.target === "calendar"
                                ? (needsDate ? "Scegli una nuova data" : "Sigilla → pubblica")
                                : entry.target === "website" ? (entry.website?.patch ? "Sigilla → bozza Sanity" : "Commissiona a Edmondo")
                                : "Sigilla"}
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
                                Rifiuta
                            </button>
                        )}
                        {entry.target !== "website" && (
                            <button
                                disabled={busy}
                                onClick={() => void decide(entry, "done", note)}
                                className="act-void flex-1 min-w-[7rem]"
                                type="button"
                                title="Lavoro già eseguito altrove: chiude la riga, non tornerà a chiedere"
                                style={{ color: "var(--paper-fg-soft)", borderColor: "var(--paper-edge)" }}
                            >
                                Già fatto — archivia
                            </button>
                        )}
                        {entry.target !== "website" && (
                            <button
                                disabled={busy}
                                onClick={() => void decide(entry, "delete", note)}
                                className="act-void flex-1 min-w-[7rem]"
                                type="button"
                                title="Archivia la pagina in Notion e la rimuove definitivamente dal Cancello; il motivo è facoltativo"
                                style={{ color: "var(--seal)", borderColor: "var(--seal)" }}
                            >
                                Elimina
                            </button>
                        )}
                    </div>
                    )
                    )}
                    </>
                    )}
                </div>
            </div>
        );
    }

    /* ── Render ───────────────────────────────────────────────────────────── */

    // Until the session is known the page cannot tell JJ's register from the
    // social queue; showing JJ's (with its seal) to a collaborator, even for
    // a moment, would offer acts the server then refuses.
    if (sessionStatus === "loading") {
        return <p className="column-label p-8">…</p>;
    }

    return (
        <>
            {/* The spread is the viewport: each leaf scrolls by itself, the acts
                never leave the eye. */}
            <div className="relative flex h-[100dvh] flex-col overflow-hidden">
                <Guilloche
                    size={900}
                    rings={4}
                    opacity={0.18}
                    className="pointer-events-none absolute -right-72 -top-64 h-[900px] w-[900px]"
                />

                <header className="relative border-b border-plate-rule px-8 pb-4 pt-7 max-sm:px-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="column-label">{tr("Il Cancello · le proposte editoriali", "Coda social · post in attesa di revisione")}</p>
                            <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                                {state && isSocial ? (pendingEntries.length === 0 ? "Nessun post in attesa di revisione" : pendingEntries.length === 1 ? "Un post è in attesa di revisione" : `${pendingEntries.length} post sono in attesa di revisione`) : !state && isSocial ? (error ? "Non sono riuscito a caricare la coda" : "Apro la coda…") : state ? (pendingEntries.length === 0 ? "Niente aspetta il tuo sigillo" : pendingEntries.length === 1 ? "Un atto aspetta il tuo sigillo" : `${pendingEntries.length} atti aspettano il tuo sigillo`) : error ? "Il registro non si apre" : "Apro il registro…"}
                            </h1>
                            {state && !isSocial && pendingEntries.length > 0 && (() => {
                                // The registrar's line: what stands at the gate, in one sentence.
                                const social = pendingEntries.filter((e) => e.family === "Social").length;
                                const deskN = pendingEntries.filter((e) => e.family === "Desk").length;
                                const web = pendingEntries.filter((e) => e.family === "Website").length;
                                const buffer = pendingEntries.filter((e) => e.family === "Buffer").length;
                                const oldest = Math.max(0, ...pendingEntries.map((e) => e.dueDays ?? 0));
                                const parts = [
                                    social > 0 && `${social === 1 ? "un atto" : `${social} atti`} dal calendario sociale`,
                                    deskN > 0 && `${deskN === 1 ? "uno" : deskN} da pubblicare o tagliare`,
                                    web > 0 && `${web === 1 ? "una pagina" : `${web} pagine`} del sito con patch o proposte`,
                                    buffer > 0 && `${buffer === 1 ? "un post approvato" : `${buffer} post approvati`} non ancora su Buffer`
                                ].filter(Boolean);
                                return (
                                    <p className="mt-2 max-w-[34rem] text-[13px] italic leading-relaxed text-plate-foreground-soft max-sm:hidden">
                                        {parts.join(", ")}.{oldest > 0 ? ` Il più vecchio attende da ${oldest === 1 ? "un giorno" : `${oldest} giorni`}.` : ""}
                                    </p>
                                );
                            })()}
                            {state && (
                                <p className="mt-1.5 font-condensed text-[10px] uppercase tracking-[0.14em] text-plate-foreground-soft">
                                    {tr("aggiornato", "aggiornato alle")} {new Date(state.generatedAt).toLocaleTimeString("it-IT")}{!isSocial && state.cached ? " · cache" : ""}{!isSocial && <SnapshotFreshness value={state.readModel} />}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {!isSocial && <Link href="/questioni" className="text-[12px] text-plate-foreground-soft hover:text-plate-foreground hover:underline max-sm:hidden">
                                Domande, piani e raccomandazioni → Le Questioni
                            </Link>}
                            <button onClick={() => void load(true)} className="act-quiet" type="button">
                                {tr("Rileggi da Notion", "Aggiorna")}
                            </button>
                        </div>
                    </div>
                </header>

                {toast && (
                    <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 border border-seal-deep bg-seal px-5 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-paper">
                        {toast}
                    </div>
                )}
                {error && (
                    <div className="relative mx-8 mt-4 border border-sepia px-4 py-3 text-[13px] text-sepia-bright max-sm:mx-4" role="alert">
                        {error}
                        {retry !== null && (isSocial ? ` Riprovo tra ${retry.seconds} s.` : ` Nuovo tentativo automatico tra ${retry.seconds} s.`)}
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
                            <span className="column-label column-label-paper">{tr("Atto", "Post")}</span>
                            <span className="column-label column-label-paper">{tr("Sigillo", "")}</span>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {!state ? (
                                <p className="px-4 py-8 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                                    {error
                                        ? tr("Nessun dato: vedi il messaggio sopra.", "Ancora niente da mostrare. La pagina riprova da sola; se continua a non andare, avvisa JJ.")
                                        : tr("Carico ciò che aspetta il tuo giudizio…", "Carico la coda…")}
                                </p>
                            ) : entries.length === 0 ? (
                                <div className="px-4 py-12 text-center">
                                    <Socket sealed size={40} />
                                    <p className="mt-3 text-[13px] text-paper-foreground-soft">
                                        {tr("Ogni atto è deciso. Il resto della casa è qui sotto.", "Nessun post in attesa di revisione. Quello che è in lavorazione è qui sotto.")}
                                    </p>
                                </div>
                            ) : (
                                ([
                                    // Grouped by family; within each group the order is the
                                    // gate's (sealRank). A post whose slot has passed waits apart
                                    // until JJ gives it a new date, and approved rows on their way
                                    // to Buffer are listed, not only counted.
                                    ["Desk", "Da pubblicare · clip e script", (e: Entry) => e.family === "Desk"],
                                    ["Website", "Sito · patch", (e: Entry) => e.family === "Website"],
                                    ["Social", tr("Calendario sociale · il sigillo pubblica", "Calendario social"), (e: Entry) => e.family === "Social" && !slotPassed(e)],
                                    ["Buffer", "Approvati · non ancora su Buffer", (e: Entry) => e.family === "Buffer"],
                                    ["SocialPast", tr("Data passata · scegli una nuova data", "Data di uscita passata · JJ ne sceglie una nuova"), (e: Entry) => e.family === "Social" && slotPassed(e)],
                                ] as const).map(([family, label, belongs]) => {
                                    const rows = entries.filter(belongs);
                                    if (rows.length === 0) return null;
                                    return (
                                <ul key={family}>
                                    <li className="sticky top-0 z-10 flex items-baseline justify-between border-b border-paper-edge bg-paper-shade px-4 py-2">
                                        <span className="column-label column-label-paper">{label}</span>
                                        <span className="serial text-paper-foreground-soft">[{rows.length}]</span>
                                    </li>
                                    {rows.map((entry) => {
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
                                                            {!isSocial && <Mark tone={stateTone(entry.stateLabel)} onPaper>{entry.family}</Mark>}
                                                            <span className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                                                                {isSocial && entry.calendar ? socialLine(entry.calendar) : entry.stateLabel}
                                                            </span>
                                                            {entry.hasMedia && !isSocial && (
                                                                <span className="font-condensed text-[10px] uppercase tracking-[0.12em] text-engraving-ink">
                                                                    · asset
                                                                </span>
                                                            )}
                                                            {/* A collaborator's pre-check, on the line itself so JJ can take the checked posts first. */}
                                                            {entry.mark && (
                                                                <span className={`font-condensed text-[10px] uppercase tracking-[0.12em] ${entry.mark.kind === "ready" ? "text-engraving-ink" : "text-stamp"}`}>
                                                                    · {entry.mark.kind === "ready"
                                                                        ? tr("controllato da", "controllato da")
                                                                        : tr("modifiche chieste da", "modifiche chieste da")} {entry.mark.by}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {entry.dueDays !== null && entry.dueDays > 0 && (
                                                            <div className="mt-1.5"><AgeBar days={entry.dueDays} /></div>
                                                        )}
                                                    </div>
                                                    {act?.decision === "modify" ? (
                                                        <span
                                                            className="inline-block -rotate-3 border px-1.5 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-[0.12em]"
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
                                    );
                                })
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
                            aria-label={tr("Chiudi il documento", "Chiudi il post")}
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
                                    {tr("Chiudi", "Chiudi")}
                                </button>
                                <DocumentLeaf entry={open} />
                            </div>
                        </div>
                    </div>
                )}

                {/* The stamp dialog: what must change, and to whom it goes back. */}
                {modifyOpen && open && (
                    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-plate-deep/85 p-4">
                        <section className="paper w-full max-w-lg border border-paper-edge" role="dialog" aria-modal="true" aria-label={isSocial ? "Chiedi modifiche" : "Timbra e rimanda"}>
                            <div className="border-b-[3px] border-double border-paper-edge px-5 py-4">
                                <p className="column-label" style={{ color: "var(--stamp)" }}>
                                    {isSocial ? "Chiedi modifiche · nota per JJ e il team" : <>Timbro · nota a {open.target === "website" ? "Edmondo" : "Ernesto"}</>}
                                </p>
                                <h2 className="document-title mt-1 text-[19px] text-paper-foreground">{isSocial ? "Cosa va cambiato?" : "Cosa va modificato?"}</h2>
                                <p className="mt-1 truncate text-[13px] text-paper-foreground-soft">{open.title}</p>
                            </div>
                            <div className="px-5 py-4">
                                <textarea
                                    value={notes[open.key] ?? ""}
                                    onChange={(event) => setNote(open.key, event.target.value)}
                                    rows={6}
                                    autoFocus
                                    placeholder={isSocial ? "Scrivi cosa il team deve cambiare, rigenerare o correggere…" : open.target === "website"
                                        ? "Scrivi a Edmondo cosa deve rilavorare, correggere o verificare…"
                                        : "Scrivi a Ernesto cosa deve cambiare, rigenerare o correggere…"}
                                    className="w-full border border-paper-edge bg-transparent px-3 py-2 text-[13px] text-paper-foreground outline-none placeholder:text-paper-foreground-soft focus:border-engraving-ink"
                                />
                                <div className="mt-4 flex justify-end gap-2">
                                    <button onClick={() => setModifyOpen(false)} className="act-void" type="button" style={{ color: "var(--paper-fg-soft)", borderColor: "var(--paper-edge)" }}>
                                        {"Annulla"}
                                    </button>
                                    <button
                                        disabled={busyKey === open.key || !(notes[open.key] ?? "").trim()}
                                        onClick={() => void decide(open, isSocial ? "request" : "modify", notes[open.key] ?? "")}
                                        className="act-stamp"
                                        type="button"
                                        style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
                                    >
                                        {isSocial ? "Chiedi modifiche" : "Timbra e rimanda"}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}

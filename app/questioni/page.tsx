"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MarkdownBlock from "../../components/MarkdownBlock";
import { Guilloche, Mark, AgeBar } from "../../components/Registro";
import { deskFamily, QUESTION_KINDS } from "../../lib/house/families";

/**
 * Le Questioni — the technical and organisational side of the house, kept
 * apart from the editorial gate so a hundred recommendations never bury one
 * clip waiting for a seal.
 *
 * Two registers on one page:
 *   1. Signals — what broke or went stale (read-only, from the house state).
 *   2. Questions — the desk rows of the question family, grouped by kind,
 *      answered in ink: approve, answer and send back, reject, done, delete.
 *
 * Decisions go through the same route as Il Cancello (target "desk"), so
 * the write path and its guards are one.
 */

type Decision = "approve" | "modify" | "reject" | "done" | "delete";

interface VideoRef { url: string; name: string; path: string; ageDays: number }
interface DeskRow {
    rowId: string; url: string; title: string; type: string; status: string | null;
    priority: string; due: string | null; correction: string; body: string; videos: VideoRef[];
}
interface ReviewState { desk: DeskRow[]; generatedAt: string; cached: boolean }

interface HouseSignals {
    night: { runs: number; attention: number; failed: { id: string; job: string | null; status: string | null; startedAt: string | null; summary: string }[]; lastProductiveAt: string | null; zeroOutputStreak: number } | null;
    runs: { active: number; failed: number };
    pif: { overdue: number; unlit: number; nextReviewDate: string | null; nextReviewInDays: number | null } | null;
    snapshot: { latestWeekOf: string | null; ageDays: number | null } | null;
    ambrogioPending: number | null;
    errors: string[];
}

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 0, Normal: 1, Low: 2 };
const FOLD_AFTER = 8;

function daysOverdue(due: string | null): number | null {
    if (!due) return null;
    const t = new Date(due).getTime();
    if (!Number.isFinite(t)) return null;
    const d = Math.floor((Date.now() - t) / 86_400_000);
    return d > 0 ? d : null;
}

function fmtWhen(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return new Intl.DateTimeFormat("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/* ── One question, answered in place ────────────────────────────────────── */

function QuestionRow({
    row,
    busy,
    onDecide,
}: {
    row: DeskRow;
    busy: boolean;
    onDecide: (row: DeskRow, decision: Decision, comment: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [answer, setAnswer] = useState(row.correction ?? "");
    const overdue = daysOverdue(row.due);
    const urgent = row.priority === "Urgent" || row.priority === "High";
    return (
        <li className="border-b border-paper-edge">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper-shade"
            >
                <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-paper-foreground">{row.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-paper-foreground-soft">
                        <Mark tone={urgent ? "pending" : "quiet"} onPaper>{row.priority}</Mark>
                        {row.due && <span>scadenza {row.due.slice(0, 10)}</span>}
                        {row.videos.length > 0 && <span>{row.videos.length} video</span>}
                        {row.correction && !open && <span className="italic">risposta abbozzata</span>}
                    </span>
                </span>
                {overdue !== null && (
                    <span className="flex flex-none items-center gap-2">
                        <AgeBar days={overdue} />
                        <span className="serial text-seal-deep">{overdue}d</span>
                    </span>
                )}
                <span aria-hidden="true" className="serial flex-none text-paper-foreground-soft">{open ? "−" : "+"}</span>
            </button>
            {open && (
                <div className="border-t border-dashed border-paper-edge px-3 pb-4 pt-3">
                    {row.body ? (
                        <MarkdownBlock content={row.body} className="text-[13px] text-paper-foreground" />
                    ) : (
                        <p className="text-[12px] italic text-paper-foreground-soft">Nessun testo nella pagina: si legge in Notion.</p>
                    )}
                    <a href={row.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-engraving-ink hover:underline">
                        Apri in Notion
                    </a>
                    <label className="mt-3 block">
                        <span className="column-label column-label-paper">La tua risposta</span>
                        <textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            rows={3}
                            placeholder="Una riga basta: va scritta nel campo Correction e letta dalla casa."
                            className="mt-1 w-full border border-paper-edge bg-paper px-3 py-2 text-[13px] text-paper-foreground"
                        />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button type="button" disabled={busy} onClick={() => void onDecide(row, "approve", answer)} className="act-stamp">
                            Approva
                        </button>
                        <button
                            type="button"
                            disabled={busy || answer.trim().length === 0}
                            onClick={() => void onDecide(row, "modify", answer)}
                            className="act-quiet"
                            title="Resta in sospeso: la risposta torna a chi ha chiesto"
                        >
                            Rispondi e rimanda
                        </button>
                        <button type="button" disabled={busy} onClick={() => void onDecide(row, "reject", answer)} className="act-quiet">
                            Rifiuta
                        </button>
                        <button type="button" disabled={busy} onClick={() => void onDecide(row, "done", answer)} className="act-quiet">
                            Già fatto
                        </button>
                        <button type="button" disabled={busy} onClick={() => void onDecide(row, "delete", answer)} className="act-void ml-auto">
                            Elimina
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function QuestioniPage() {
    const [state, setState] = useState<ReviewState | null>(null);
    const [house, setHouse] = useState<HouseSignals | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [gone, setGone] = useState<Record<string, true>>({});
    const [unfolded, setUnfolded] = useState<Record<string, true>>({});

    const load = useCallback(async (refresh = false) => {
        try {
            const [r, h] = await Promise.all([
                fetch(`/api/review-dashboard/state${refresh ? "?refresh=1" : ""}`, { cache: "no-store" }),
                fetch(`/api/house/state${refresh ? "?refresh=1" : ""}`, { cache: "no-store" }),
            ]);
            if (!r.ok) throw new Error(`Scrivania: ${r.status}`);
            setState((await r.json()) as ReviewState);
            if (h.ok) setHouse((await h.json()) as HouseSignals);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const groups = useMemo(() => {
        const pending = (state?.desk ?? []).filter(
            (r) => r.status === "Pending" && deskFamily(r.type) === "question" && !gone[r.rowId]
        );
        const sortRows = (rows: DeskRow[]) =>
            [...rows].sort((a, b) => {
                const pa = PRIORITY_RANK[a.priority] ?? 1;
                const pb = PRIORITY_RANK[b.priority] ?? 1;
                if (pa !== pb) return pa - pb;
                return (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title);
            });
        const known = new Set(QUESTION_KINDS.map((k) => k.type));
        const out = QUESTION_KINDS.map((k) => ({ ...k, rows: sortRows(pending.filter((r) => r.type === k.type)) }));
        const other = sortRows(pending.filter((r) => !known.has(r.type)));
        if (other.length) out.push({ type: "other", label: "Altro", verb: "da classificare", rows: other });
        return out.filter((g) => g.rows.length > 0);
    }, [state, gone]);

    const total = groups.reduce((n, g) => n + g.rows.length, 0);

    const decide = useCallback(
        async (row: DeskRow, decision: Decision, comment: string) => {
            if (decision === "modify" && comment.trim().length === 0) {
                setToast("Per rimandare serve una risposta.");
                return;
            }
            if (decision === "reject" && comment.trim().length === 0 && !window.confirm(`Rifiutare “${row.title}” senza una riga di motivo?`)) return;
            if (decision === "delete" && !window.confirm(`Eliminare “${row.title}” dalla scrivania? Non è reversibile.`)) return;
            setBusyId(row.rowId);
            try {
                const res = await fetch("/api/review-dashboard/decision", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rowId: row.rowId, decision, comment, target: "desk" }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `decisione ${res.status}`);
                if (decision !== "modify") setGone((g) => ({ ...g, [row.rowId]: true }));
                setToast(
                    decision === "approve" ? "Approvata."
                        : decision === "modify" ? "Risposta scritta, resta in sospeso."
                        : decision === "reject" ? "Rifiutata."
                        : decision === "done" ? "Segnata come già fatta."
                        : "Eliminata."
                );
                void load(true);
            } catch (err) {
                setToast(err instanceof Error ? err.message : String(err));
            } finally {
                setBusyId(null);
            }
        },
        [load]
    );

    /* Signals: read-only lines, each pointing where the fact is owned. */
    const signals = useMemo(() => {
        if (!house) return [];
        const out: { key: string; text: string; href: string; tone: "seal" | "sepia" }[] = [];
        const n = house.night;
        if (n && n.attention > 0) {
            out.push({
                key: "night",
                text: `${n.attention} run da guardare nelle ultime 24 ore: ${n.failed.map((f) => `${f.job ?? "run"} (${fmtWhen(f.startedAt)})`).slice(0, 4).join(", ")}`,
                href: "/casa-di-ernesto#attivita",
                tone: "seal",
            });
        }
        if (house.runs.failed > 0) {
            out.push({ key: "runs", text: `${house.runs.failed} run interattive fallite dietro la porta`, href: "/casa-di-ernesto", tone: "seal" });
        }
        if (n && n.zeroOutputStreak >= 3) {
            out.push({ key: "zero", text: `${n.zeroOutputStreak} slot di produzione consecutivi a zero: la casa gira ma non produce`, href: "/casa-di-ernesto#attivita", tone: "sepia" });
        }
        if (house.pif && house.pif.overdue > 0) {
            out.push({ key: "pif", text: `${house.pif.overdue} review PIF scadute`, href: "/pif-tick?source=all&state=overdue", tone: "seal" });
        }
        if (house.snapshot && house.snapshot.ageDays !== null && house.snapshot.ageDays >= 15) {
            out.push({ key: "snap", text: `Snapshot performance fermo da ${house.snapshot.ageDays} giorni`, href: "/portineria", tone: "sepia" });
        }
        for (const e of house.errors) out.push({ key: `err:${e}`, text: `Una fonte non risponde: ${e}`, href: "/", tone: "sepia" });
        return out;
    }, [house]);

    return (
        <div className="relative min-h-screen overflow-hidden">
            <Guilloche size={860} rings={4} opacity={0.14} className="pointer-events-none absolute -right-64 -top-56 h-[860px] w-[860px]" />

            <header className="relative border-b border-plate-rule px-8 pb-4 pt-7 max-sm:px-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="column-label">Le Questioni · tecniche e organizzative</p>
                        <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                            {!state ? "Apro la scrivania…" : total === 0 ? "Nessuna questione in sospeso" : total === 1 ? "Una questione aspetta una risposta" : `${total} questioni aspettano una risposta`}
                        </h1>
                        {state && total > 0 && (
                            <p className="mt-2 max-w-[36rem] text-[13px] italic leading-relaxed text-plate-foreground-soft">
                                {groups.map((g) => `${g.rows.length} ${g.label.toLowerCase()}`).join(", ")}. Le proposte editoriali sono al Cancello.
                            </p>
                        )}
                        {state && (
                            <p className="mt-1.5 font-condensed text-[10px] uppercase tracking-[0.14em] text-plate-foreground-soft">
                                aggiornato {new Date(state.generatedAt).toLocaleTimeString("it-IT")}{state.cached ? " · cache" : ""}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/review" className="text-[12px] text-plate-foreground-soft hover:text-plate-foreground hover:underline">
                            Proposte editoriali → Il Cancello
                        </Link>
                        <button onClick={() => void load(true)} className="act-quiet" type="button">
                            Rileggi da Notion
                        </button>
                    </div>
                </div>
            </header>

            {error && <p className="mx-8 mt-4 border border-seal px-4 py-3 text-sm text-seal-bright max-sm:mx-4">{error}</p>}
            {toast && (
                <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-plate-rule bg-plate-raised px-4 py-2 text-[13px] text-plate-foreground-strong">
                    {toast}
                </div>
            )}

            {/* Signals: the technical side, read-only. */}
            <section className="relative px-8 pt-6 max-sm:px-4" aria-labelledby="questioni-segnali">
                <h2 id="questioni-segnali" className="column-label">Segnali tecnici</h2>
                {!house ? (
                    <p className="mt-2 text-[12px] text-plate-foreground-soft">Leggo lo stato della casa…</p>
                ) : signals.length === 0 ? (
                    <p className="mt-2 text-[13px] text-plate-foreground-soft">Nessun segnale: run pulite, review PIF in regola, snapshot fresco.</p>
                ) : (
                    <ul className="mt-2 border-t border-plate-rule">
                        {signals.map((sig) => (
                            <li key={sig.key} className="border-b border-plate-rule">
                                <Link href={sig.href} className={`block px-2 py-2 text-[13px] hover:bg-plate-raised ${sig.tone === "seal" ? "text-seal-deep" : "text-[var(--sepia)]"}`}>
                                    {sig.text} <span aria-hidden="true">→</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
                {house?.ambrogioPending ? (
                    <p className="mt-3 text-[12px] text-plate-foreground-soft">
                        {house.ambrogioPending} {house.ambrogioPending === 1 ? "proposta" : "proposte"} di Ambrogio in attesa: si decidono nel{" "}
                        <Link href="/ambrogio" className="font-semibold text-engraving-ink hover:underline">suo studio</Link>, mai da qui.
                    </p>
                ) : null}
            </section>

            {/* Questions, by kind. */}
            <section className="relative px-8 pb-12 pt-8 max-sm:px-4" aria-labelledby="questioni-scrivania">
                <h2 id="questioni-scrivania" className="column-label">Dalla scrivania degli agenti</h2>
                {!state ? (
                    <p className="mt-2 text-[12px] text-plate-foreground-soft">Leggo la scrivania…</p>
                ) : groups.length === 0 ? (
                    <p className="mt-3 border border-dashed border-plate-rule px-4 py-5 text-[13px] text-plate-foreground-soft">
                        Nessuna domanda, piano, richiesta o raccomandazione in sospeso.
                    </p>
                ) : (
                    <div className="mt-3 grid grid-cols-2 gap-6 max-xl:grid-cols-1">
                        {groups.map((g) => {
                            const isOpen = !!unfolded[g.type];
                            const visible = isOpen ? g.rows : g.rows.slice(0, FOLD_AFTER);
                            return (
                                <section key={g.type} className="paper border border-paper-edge text-paper-foreground">
                                    <header className="flex items-baseline justify-between gap-3 border-b-[3px] border-double border-paper-edge px-3 py-2.5">
                                        <h3 className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em]">{g.label}</h3>
                                        <span className="serial text-paper-foreground-soft">
                                            {g.rows.length} {g.verb}
                                        </span>
                                    </header>
                                    <ul>
                                        {visible.map((row) => (
                                            <QuestionRow key={row.rowId} row={row} busy={busyId === row.rowId} onDecide={decide} />
                                        ))}
                                    </ul>
                                    {g.rows.length > FOLD_AFTER && (
                                        <button
                                            type="button"
                                            onClick={() => setUnfolded((u) => (isOpen ? (({ [g.type]: _, ...rest }) => rest)(u) : { ...u, [g.type]: true }))}
                                            className="w-full px-3 py-2 text-left text-[11px] font-semibold text-engraving-ink hover:underline"
                                        >
                                            {isOpen ? `Mostra solo le prime ${FOLD_AFTER}` : `Mostra tutte (${g.rows.length})`}
                                        </button>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

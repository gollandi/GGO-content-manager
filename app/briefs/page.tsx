"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BoardThreadView, BoardView } from "../../lib/board/types";
import { STRATEGY_OUTLINE, type BriefKind } from "../../lib/social/briefs";

/**
 * Briefs — the social media manager speaks to the house: a brief to the
 * agents, or a social strategy Ernesto plans inside. Messages go on the house
 * board under her own name; the agents read them at their next slot (Ernesto
 * at 07:15, 13:00 and 18:00) and answer here. Nothing said here publishes
 * anything: every post still waits for JJ's approval.
 */

const section = "paper mb-5 border border-paper-edge p-5 text-[14px] leading-relaxed text-paper-foreground";
const h2 = "column-label column-label-paper mb-2";
const onPaper = { color: "var(--paper-fg)", borderColor: "var(--paper-edge)" };

const WHO: Record<string, string> = {
    ernesto: "Piano di produzione social — Ernesto",
    samantha: "Didascalie e risposte ai commenti — Samantha (tramite Ernesto)",
    ginevra: "Reel generativi — Ginevra",
    greta: "Montaggio del girato reale — Greta (tramite Ernesto)",
    titti: "Divisione delle registrazioni grezze — Titti (tramite Ernesto)",
    natascia: "Analisi dei dati — Natascia",
    jj: "JJ",
};

interface State { handle: string; recipients: string[]; board: BoardView }

function Thread({ t, handle, recipients, act, busy }: {
    t: BoardThreadView; handle: string; recipients: string[]; busy: boolean;
    act: (body: Record<string, unknown>) => Promise<boolean>;
}) {
    const [reply, setReply] = useState("");
    const others = useMemo(
        () => [...new Set([...t.participants, ...t.recipients])].filter((r) => r !== handle && recipients.includes(r)),
        [t, handle, recipients],
    );
    const strategy = t.tags.includes("strategy");
    return (
        <article className="border-t border-paper-edge pt-3">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{strategy ? "Strategia · " : ""}{t.threadId}</span>
                <span className="text-[12px] text-paper-foreground-soft">
                    {t.closed ? `chiusa da ${t.closedBy}` : "aperta"}{t.pending ? " · in attesa della sincronizzazione della casa" : ""}
                </span>
            </header>
            {t.earlierHidden ? <p className="mt-1 text-[12px] text-paper-foreground-soft">Ti hanno aggiunto a questa conversazione dopo; i messaggi precedenti non sono mostrati.</p> : null}
            <ol className="mt-2 space-y-2">
                {t.events.map((e) => (
                    <li key={e.id} className={e.from === handle ? "pl-0" : "pl-4"}>
                        <div className="text-[12px] text-paper-foreground-soft">
                            {e.from === handle ? "Tu" : e.from} · {new Date(e.date).toLocaleString("it-IT")}
                            {e.kind === "close" ? " · ha chiuso la conversazione" : ""}{e.pending ? " · non ancora consegnato" : ""}
                        </div>
                        <p className="whitespace-pre-wrap">{e.body}</p>
                    </li>
                ))}
            </ol>
            {!t.closed && (
                <div className="mt-3 space-y-2">
                    <textarea aria-label={`Rispondi in ${t.threadId}`} value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
                        className="w-full border border-paper-edge bg-transparent p-2" placeholder={others.length ? `Rispondi a ${others.join(", ")}` : "Rispondi"} />
                    <div className="flex gap-2">
                        <button type="button" className="act-void" style={onPaper} disabled={busy || !reply.trim() || others.length === 0}
                            onClick={async () => { if (await act({ mode: "reply", threadId: t.threadId, to: others, body: reply })) setReply(""); }}>Rispondi</button>
                        {t.opener === handle && (
                            <button type="button" className="act-quiet" style={onPaper} disabled={busy}
                                onClick={() => window.confirm("Chiudere questa conversazione? Gli agenti smettono di leggerla; una strategia chiusa smette di orientare il piano di Ernesto.") && act({ mode: "close", threadId: t.threadId })}>
                                Chiudi conversazione
                            </button>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}

export default function BriefsPage() {
    const [state, setState] = useState<State | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [kind, setKind] = useState<BriefKind>("brief");
    const [title, setTitle] = useState("");
    const [to, setTo] = useState<string[]>(["ernesto"]);
    const [body, setBody] = useState("");

    const load = useCallback(async () => {
        const res = await fetch("/api/social/briefs", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setError(json.error || `Caricamento non riuscito (${res.status})`); return; }
        setError("");
        setState(json);
    }, []);
    useEffect(() => { void load(); }, [load]);

    const act = useCallback(async (payload: Record<string, unknown>) => {
        setBusy(true); setNotice("");
        try {
            const res = await fetch("/api/social/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setNotice(json.error || "Non inviato."); return false; }
            setNotice("In coda. La casa lo prende alla prossima sincronizzazione (entro pochi minuti) e gli agenti al loro prossimo turno.");
            await load();
            return true;
        } finally { setBusy(false); }
    }, [load]);

    const switchKind = (k: BriefKind) => {
        setKind(k);
        if (k === "strategy") { setTo(["ernesto"]); if (!body.trim()) setBody(STRATEGY_OUTLINE); }
        else if (body === STRATEGY_OUTLINE) setBody("");
    };

    const threads = state?.board.threads ?? [];
    const open = threads.filter((t) => !t.closed);
    const closed = threads.filter((t) => t.closed);

    return (
        <div className="mx-auto max-w-3xl p-8 max-sm:p-4">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Brief</h1>
                    <p className="page-subtitle">Di&apos; alla casa cosa produrre. Firmato con il tuo nome; da qui non si pubblica niente.</p>
                </div>
            </header>

            {error ? <section className={section}><p role="alert">{error}</p></section> : !state ? <p className="p-4">Apro…</p> : (
                <>
                    <section className={section}>
                        <h2 className={h2}>Nuovo</h2>
                        <div className="mb-3 flex gap-4" role="radiogroup" aria-label="Tipo">
                            <label><input type="radio" name="kind" checked={kind === "brief"} onChange={() => switchKind("brief")} /> Un brief agli agenti</label>
                            <label><input type="radio" name="kind" checked={kind === "strategy"} onChange={() => switchKind("strategy")} /> Una strategia social</label>
                        </div>
                        {kind === "strategy" && (
                            <p className="mb-3 text-[13px]">Una strategia va a Ernesto, con copia a JJ, e orienta ogni piano di Ernesto finché non la chiudi o ne apri una nuova. Se JJ ha una strategia aperta, la sua viene prima.</p>
                        )}
                        <input aria-label="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo breve, per esempio: reel di dicembre sul varicocele"
                            className="mb-2 w-full border border-paper-edge bg-transparent px-2 py-1" />
                        <fieldset className="mb-2 flex flex-wrap gap-x-4 gap-y-1" disabled={kind === "strategy"}>
                            <legend className="sr-only">Destinatari</legend>
                            {state.recipients.map((r) => (
                                <label key={r} className="text-[13px]">
                                    <input type="checkbox" checked={to.includes(r)}
                                        onChange={(e) => setTo(e.target.checked ? [...to, r] : to.filter((x) => x !== r))} /> {WHO[r] ?? r}
                                </label>
                            ))}
                        </fieldset>
                        <textarea aria-label="Brief" value={body} onChange={(e) => setBody(e.target.value)} rows={kind === "strategy" ? 10 : 6}
                            className="w-full border border-paper-edge bg-transparent p-2" placeholder="Cosa vuoi, per chi, entro quando e perché." />
                        <div className="mt-2 flex items-center gap-3">
                            <button type="button" className="act-void" style={onPaper} disabled={busy || !title.trim() || !body.trim()}
                                onClick={async () => { if (await act({ mode: "open", kind, title, to, body })) { setTitle(""); setBody(""); } }}>
                                {kind === "strategy" ? "Invia la strategia" : "Invia il brief"}
                            </button>
                            {notice && <span className="text-[13px]" role="status">{notice}</span>}
                        </div>
                    </section>

                    {state.board.rejected.length > 0 && (
                        <section className={section}>
                            <h2 className={h2}>Rifiutati dalla casa</h2>
                            {state.board.rejected.map((r) => <p key={r.event.id}><strong>{r.event.threadId}</strong>: {r.reason}</p>)}
                        </section>
                    )}

                    <section className={section}>
                        <h2 className={h2}>Conversazioni aperte ({open.length})</h2>
                        {open.length === 0 ? <p>Ancora nessuna.</p> : open.map((t) => <Thread key={t.threadId} t={t} handle={state.handle} recipients={state.recipients} act={act} busy={busy} />)}
                    </section>
                    {closed.length > 0 && (
                        <section className={section}>
                            <h2 className={h2}>Chiuse ({closed.length})</h2>
                            {closed.map((t) => <Thread key={t.threadId} t={t} handle={state.handle} recipients={state.recipients} act={act} busy={busy} />)}
                        </section>
                    )}
                    <p className="text-[12px] text-paper-foreground-soft">Ultima sincronizzazione della bacheca: {state.board.syncedAt ? new Date(state.board.syncedAt).toLocaleString("it-IT") : "mai"}.</p>
                </>
            )}
        </div>
    );
}

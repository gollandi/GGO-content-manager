"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CommentRow } from "../../lib/social/comments-notion";

/**
 * Comments — YouTube comments waiting for a reply, each with Samantha's
 * draft. The social media manager suggests a reply (Samantha drafts again
 * from it, through the house's clinical and compliance check) or marks the
 * draft as checked. A reply goes public only when JJ approves it: approving
 * is posting. A comment with health details is marked to be handled by hand
 * and never reaches an agent again (contract clause 10.4). Instagram,
 * TikTok and Facebook comments are not read by the house at all yet.
 */

const section = "paper mb-5 border border-paper-edge p-5 text-[14px] leading-relaxed text-paper-foreground";
const h2 = "column-label column-label-paper mb-2";
const onPaper = { color: "var(--paper-fg)", borderColor: "var(--paper-edge)" };

const STATE: Record<string, string> = {
    Pending: "Aspetta JJ",
    Approved: "Approvata — esce al prossimo giro",
    "In production": "In pubblicazione",
    Done: "Risposta data",
};

function Card({ row, mayApprove, act, busy }: {
    row: CommentRow; mayApprove: boolean; busy: boolean;
    act: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
    const [text, setText] = useState("");
    const pending = row.status === "Pending";
    const draft = row.latestDraft;
    return (
        <article className="border-t border-paper-edge pt-3">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{row.videoUrl ? <a className="underline" href={row.videoUrl} target="_blank" rel="noreferrer">{row.videoTitle}</a> : row.videoTitle}</span>
                <span className="text-[12px] text-paper-foreground-soft">{STATE[row.status ?? ""] ?? row.status}{row.posted ? " · risposta pubblicata" : ""}</span>
            </header>
            <p className="mt-1 text-[12px] text-paper-foreground-soft">{row.author}</p>
            <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-paper-edge pl-3">{row.comment}</blockquote>

            <div className="mt-3">
                <div className="column-label column-label-paper">{draft ? `Bozza ${draft.n} di Samantha` : "Ancora nessuna bozza"}</div>
                {draft ? <p className="whitespace-pre-wrap">{draft.text}</p>
                    : <p className="text-[13px]">{row.halted ? "L'ultima bozza non ha passato il controllo di conformità. Solo JJ può chiederne un'altra; un tuo suggerimento non basta." : row.noReply ? "Samantha consiglia di non rispondere." : "La casa prepara la bozza al prossimo giro."}</p>}
                {row.staleApproval && <p className="text-[13px]">JJ ha approvato una bozza precedente; non è uscito niente. Aspetta di nuovo lui.</p>}
            </div>

            {row.suggestions.length > 0 && (
                <div className="mt-3 text-[13px]">
                    <div className="column-label column-label-paper">Suggerimenti</div>
                    {row.suggestions.map((s) => <p key={s.k} className="whitespace-pre-wrap"><span className="text-paper-foreground-soft">{s.by}:</span> {s.text}</p>)}
                </div>
            )}
            {row.ready.length > 0 && <p className="mt-2 text-[13px]">Controllato: {row.ready.map((r) => r.by).join("; ")}</p>}

            {row.manual && <p className="mt-3 text-[13px]">🔒 Da gestire a mano ({row.manual.by}): contiene dati sanitari, quindi nessun agente prepara bozze. JJ vede il segno.</p>}
            {pending && !row.manual && (
                <div className="mt-3 space-y-2">
                    <textarea aria-label={`Suggerisci una risposta a ${row.author}`} value={text} onChange={(e) => setText(e.target.value)} rows={3}
                        className="w-full border border-paper-edge bg-transparent p-2"
                        placeholder="La risposta che suggerisci, o cosa dovrebbe dire. Samantha riscrive la bozza da qui. Non copiare mai qui dati sanitari." />
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="act-void" style={onPaper} disabled={busy || !text.trim() || row.halted}
                            onClick={async () => { if (await act({ rowId: row.rowId, act: "suggest", text })) setText(""); }}>Suggerisci risposta</button>
                        {draft && (
                            <button type="button" className="act-void" style={onPaper} disabled={busy}
                                onClick={() => act({ rowId: row.rowId, act: "ready", draftSeen: draft.n })}>Bozza {draft.n} pronta per JJ</button>
                        )}
                        <button type="button" className="act-quiet" style={onPaper} disabled={busy}
                            onClick={() => window.confirm("Segnare questo commento come contenente dati sanitari? Nessun agente preparerà più bozze; va gestito a mano con una risposta approvata, e JJ vede il segno.") && act({ rowId: row.rowId, act: "manual" })}>
                            Dati sanitari: gestisci a mano
                        </button>
                        {mayApprove && draft && (
                            <button type="button" className="act-seal" disabled={busy}
                                onClick={() => window.confirm(`Pubblicare la bozza ${draft.n} su YouTube? Approvare è pubblicare.`) && act({ rowId: row.rowId, act: "approve", draftSeen: draft.n })}>
                                Approva e pubblica la bozza {draft.n}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}

export default function CommentsPage() {
    const [rows, setRows] = useState<CommentRow[] | null>(null);
    const [mayApprove, setMayApprove] = useState(false);
    const [unreadable, setUnreadable] = useState(0);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const res = await fetch("/api/social/comments", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setError(json.error || `Caricamento non riuscito (${res.status})`); return; }
        setError(""); setRows(json.rows); setMayApprove(Boolean(json.mayApprove)); setUnreadable(json.unreadable ?? 0);
    }, []);
    useEffect(() => { void load(); }, [load]);

    const act = useCallback(async (payload: Record<string, unknown>) => {
        setBusy(true); setNotice("");
        try {
            const res = await fetch("/api/social/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setNotice(json.error || "Non salvato."); return false; }
            setNotice(payload.act === "suggest" ? "Salvato. Samantha riscrive la bozza al prossimo giro." : payload.act === "approve" ? "Approvata: la risposta esce al prossimo giro." : "Segnato per JJ.");
            await load();
            return true;
        } finally { setBusy(false); }
    }, [load]);

    const waiting = useMemo(() => (rows ?? []).filter((r) => r.status === "Pending"), [rows]);
    const rest = useMemo(() => (rows ?? []).filter((r) => r.status !== "Pending"), [rows]);

    return (
        <div className="mx-auto max-w-3xl p-8 max-sm:p-4">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Commenti</h1>
                    <p className="page-subtitle">I commenti su YouTube e le risposte che la casa prepara. Una risposta diventa pubblica solo con l&apos;approvazione di JJ.</p>
                </div>
            </header>
            {notice && <p className="mb-3 text-[13px]" role="status">{notice}</p>}
            {error ? <section className={section}><p role="alert">{error}</p></section> : rows === null ? <p className="p-4">Apro…</p> : (
                <>
                    {unreadable > 0 && <p className="mb-3 text-[13px]" role="alert">{unreadable === 1 ? "Un commento non si è potuto leggere e non è mostrato." : `${unreadable} commenti non si sono potuti leggere e non sono mostrati.`}</p>}
                    <section className={section}>
                        <h2 className={h2}>In attesa di risposta ({waiting.length})</h2>
                        {waiting.length === 0 ? <p>Niente in attesa.</p> : waiting.map((r) => <Card key={r.rowId} row={r} mayApprove={mayApprove} act={act} busy={busy} />)}
                    </section>
                    {rest.length > 0 && (
                        <section className={section}>
                            <h2 className={h2}>Approvati e con risposta, ultime due settimane ({rest.length})</h2>
                            {rest.map((r) => <Card key={r.rowId} row={r} mayApprove={false} act={act} busy={busy} />)}
                        </section>
                    )}
                    <p className="text-[12px] text-paper-foreground-soft">La casa non legge ancora i commenti di Instagram e Facebook.</p>
                </>
            )}
        </div>
    );
}

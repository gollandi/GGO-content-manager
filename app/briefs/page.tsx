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
    ernesto: "Ernesto — plans and runs social production",
    samantha: "Samantha — captions and replies (via Ernesto)",
    ginevra: "Ginevra — generative reels",
    greta: "Greta — cuts real footage (via Ernesto)",
    titti: "Titti — splits raw recordings (via Ernesto)",
    natascia: "Natascia — analytics",
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
                <span className="font-semibold">{strategy ? "Strategy · " : ""}{t.threadId}</span>
                <span className="text-[12px] text-paper-foreground-soft">
                    {t.closed ? `closed by ${t.closedBy}` : "open"}{t.pending ? " · waiting for the house to sync" : ""}
                </span>
            </header>
            {t.earlierHidden ? <p className="mt-1 text-[12px] text-paper-foreground-soft">You were added to this thread later; its earlier messages are not shown.</p> : null}
            <ol className="mt-2 space-y-2">
                {t.events.map((e) => (
                    <li key={e.id} className={e.from === handle ? "pl-0" : "pl-4"}>
                        <div className="text-[12px] text-paper-foreground-soft">
                            {e.from === handle ? "You" : e.from} · {new Date(e.date).toLocaleString("en-GB")}
                            {e.kind === "close" ? " · closed the thread" : ""}{e.pending ? " · not yet delivered" : ""}
                        </div>
                        <p className="whitespace-pre-wrap">{e.body}</p>
                    </li>
                ))}
            </ol>
            {!t.closed && (
                <div className="mt-3 space-y-2">
                    <textarea aria-label={`Reply in ${t.threadId}`} value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
                        className="w-full border border-paper-edge bg-transparent p-2" placeholder={others.length ? `Reply to ${others.join(", ")}` : "Reply"} />
                    <div className="flex gap-2">
                        <button type="button" className="act-void" style={onPaper} disabled={busy || !reply.trim() || others.length === 0}
                            onClick={async () => { if (await act({ mode: "reply", threadId: t.threadId, to: others, body: reply })) setReply(""); }}>Reply</button>
                        {t.opener === handle && (
                            <button type="button" className="act-quiet" style={onPaper} disabled={busy}
                                onClick={() => window.confirm("Close this thread? The agents stop reading it; a closed strategy stops governing Ernesto's plan.") && act({ mode: "close", threadId: t.threadId })}>
                                Close thread
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
        if (!res.ok) { setError(json.error || `Could not load (${res.status})`); return; }
        setError("");
        setState(json);
    }, []);
    useEffect(() => { void load(); }, [load]);

    const act = useCallback(async (payload: Record<string, unknown>) => {
        setBusy(true); setNotice("");
        try {
            const res = await fetch("/api/social/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setNotice(json.error || "Not sent."); return false; }
            setNotice("Queued. The house picks it up at its next sync (within minutes) and the agents at their next slot.");
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
                    <h1 className="page-title">Briefs</h1>
                    <p className="page-subtitle">Tell the house what to make. Signed with your name; nothing here publishes.</p>
                </div>
            </header>

            {error ? <section className={section}><p role="alert">{error}</p></section> : !state ? <p className="p-4">Opening…</p> : (
                <>
                    <section className={section}>
                        <h2 className={h2}>New</h2>
                        <div className="mb-3 flex gap-4" role="radiogroup" aria-label="Kind">
                            <label><input type="radio" name="kind" checked={kind === "brief"} onChange={() => switchKind("brief")} /> A brief to the agents</label>
                            <label><input type="radio" name="kind" checked={kind === "strategy"} onChange={() => switchKind("strategy")} /> A social strategy</label>
                        </div>
                        {kind === "strategy" && (
                            <p className="mb-3 text-[13px]">A strategy goes to Ernesto, with a copy to JJ, and governs every plan Ernesto makes until you close it or open a new one. If JJ has a strategy open, his comes first.</p>
                        )}
                        <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title, e.g. December reels on varicocele"
                            className="mb-2 w-full border border-paper-edge bg-transparent px-2 py-1" />
                        <fieldset className="mb-2 flex flex-wrap gap-x-4 gap-y-1" disabled={kind === "strategy"}>
                            <legend className="sr-only">Recipients</legend>
                            {state.recipients.map((r) => (
                                <label key={r} className="text-[13px]">
                                    <input type="checkbox" checked={to.includes(r)}
                                        onChange={(e) => setTo(e.target.checked ? [...to, r] : to.filter((x) => x !== r))} /> {WHO[r] ?? r}
                                </label>
                            ))}
                        </fieldset>
                        <textarea aria-label="Brief" value={body} onChange={(e) => setBody(e.target.value)} rows={kind === "strategy" ? 10 : 6}
                            className="w-full border border-paper-edge bg-transparent p-2" placeholder="What you want, for whom, by when, and why. Write in English." />
                        <div className="mt-2 flex items-center gap-3">
                            <button type="button" className="act-void" style={onPaper} disabled={busy || !title.trim() || !body.trim()}
                                onClick={async () => { if (await act({ mode: "open", kind, title, to, body })) { setTitle(""); setBody(""); } }}>
                                {kind === "strategy" ? "Send the strategy" : "Send the brief"}
                            </button>
                            {notice && <span className="text-[13px]" role="status">{notice}</span>}
                        </div>
                    </section>

                    {state.board.rejected.length > 0 && (
                        <section className={section}>
                            <h2 className={h2}>Refused by the house</h2>
                            {state.board.rejected.map((r) => <p key={r.event.id}><strong>{r.event.threadId}</strong>: {r.reason}</p>)}
                        </section>
                    )}

                    <section className={section}>
                        <h2 className={h2}>Open threads ({open.length})</h2>
                        {open.length === 0 ? <p>None yet.</p> : open.map((t) => <Thread key={t.threadId} t={t} handle={state.handle} recipients={state.recipients} act={act} busy={busy} />)}
                    </section>
                    {closed.length > 0 && (
                        <section className={section}>
                            <h2 className={h2}>Closed ({closed.length})</h2>
                            {closed.map((t) => <Thread key={t.threadId} t={t} handle={state.handle} recipients={state.recipients} act={act} busy={busy} />)}
                        </section>
                    )}
                    <p className="text-[12px] text-paper-foreground-soft">Board last synced: {state.board.syncedAt ? new Date(state.board.syncedAt).toLocaleString("en-GB") : "never"}.</p>
                </>
            )}
        </div>
    );
}

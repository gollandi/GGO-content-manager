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
    Pending: "Waiting for JJ",
    Approved: "Approved — posting at the next run",
    "In production": "Posting",
    Done: "Answered",
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
                <span className="text-[12px] text-paper-foreground-soft">{STATE[row.status ?? ""] ?? row.status}{row.posted ? " · reply posted" : ""}</span>
            </header>
            <p className="mt-1 text-[12px] text-paper-foreground-soft">{row.author}</p>
            <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-paper-edge pl-3">{row.comment}</blockquote>

            <div className="mt-3">
                <div className="column-label column-label-paper">{draft ? `Samantha's draft ${draft.n}` : "No draft yet"}</div>
                {draft ? <p className="whitespace-pre-wrap">{draft.text}</p>
                    : <p className="text-[13px]">{row.halted ? "The last draft failed the compliance check. Only JJ can ask for another; a suggestion will not." : row.noReply ? "Samantha recommends not replying." : "The house drafts at its next run."}</p>}
                {row.staleApproval && <p className="text-[13px]">JJ approved an older draft; nothing was posted. It is waiting for him again.</p>}
            </div>

            {row.suggestions.length > 0 && (
                <div className="mt-3 text-[13px]">
                    <div className="column-label column-label-paper">Suggestions</div>
                    {row.suggestions.map((s) => <p key={s.k} className="whitespace-pre-wrap"><span className="text-paper-foreground-soft">{s.by}:</span> {s.text}</p>)}
                </div>
            )}
            {row.ready.length > 0 && <p className="mt-2 text-[13px]">Checked: {row.ready.map((r) => r.by).join("; ")}</p>}

            {row.manual && <p className="mt-3 text-[13px]">🔒 Handled by hand ({row.manual.by}): it carries health details, so no agent drafts for it. JJ sees the mark.</p>}
            {pending && !row.manual && (
                <div className="mt-3 space-y-2">
                    <textarea aria-label={`Suggest a reply to ${row.author}`} value={text} onChange={(e) => setText(e.target.value)} rows={3}
                        className="w-full border border-paper-edge bg-transparent p-2"
                        placeholder="Your suggested reply, or what it should say. Samantha drafts again from it. Never copy health details here." />
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="act-void" style={onPaper} disabled={busy || !text.trim() || row.halted}
                            onClick={async () => { if (await act({ rowId: row.rowId, act: "suggest", text })) setText(""); }}>Suggest reply</button>
                        {draft && (
                            <button type="button" className="act-void" style={onPaper} disabled={busy}
                                onClick={() => act({ rowId: row.rowId, act: "ready", draftSeen: draft.n })}>Draft {draft.n} is ready for JJ</button>
                        )}
                        <button type="button" className="act-quiet" style={onPaper} disabled={busy}
                            onClick={() => window.confirm("Mark this comment as carrying health details? No agent will draft for it again; handle it by hand with an approved reply, and JJ sees the mark.") && act({ rowId: row.rowId, act: "manual" })}>
                            Health details: handle by hand
                        </button>
                        {mayApprove && draft && (
                            <button type="button" className="act-seal" disabled={busy}
                                onClick={() => window.confirm(`Post draft ${draft.n} on YouTube? Approving is publishing.`) && act({ rowId: row.rowId, act: "approve", draftSeen: draft.n })}>
                                Approve and post draft {draft.n}
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
        if (!res.ok) { setError(json.error || `Could not load (${res.status})`); return; }
        setError(""); setRows(json.rows); setMayApprove(Boolean(json.mayApprove)); setUnreadable(json.unreadable ?? 0);
    }, []);
    useEffect(() => { void load(); }, [load]);

    const act = useCallback(async (payload: Record<string, unknown>) => {
        setBusy(true); setNotice("");
        try {
            const res = await fetch("/api/social/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setNotice(json.error || "Not saved."); return false; }
            setNotice(payload.act === "suggest" ? "Saved. Samantha drafts again at the next run." : payload.act === "approve" ? "Approved: the reply goes out at the next run." : "Marked for JJ.");
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
                    <h1 className="page-title">Comments</h1>
                    <p className="page-subtitle">YouTube comments and the replies the house drafts. A reply goes public only on JJ&apos;s approval.</p>
                </div>
            </header>
            {notice && <p className="mb-3 text-[13px]" role="status">{notice}</p>}
            {error ? <section className={section}><p role="alert">{error}</p></section> : rows === null ? <p className="p-4">Opening…</p> : (
                <>
                    {unreadable > 0 && <p className="mb-3 text-[13px]" role="alert">{unreadable} comment row{unreadable === 1 ? "" : "s"} could not be read and {unreadable === 1 ? "is" : "are"} not shown.</p>}
                    <section className={section}>
                        <h2 className={h2}>Waiting for a reply ({waiting.length})</h2>
                        {waiting.length === 0 ? <p>Nothing waiting.</p> : waiting.map((r) => <Card key={r.rowId} row={r} mayApprove={mayApprove} act={act} busy={busy} />)}
                    </section>
                    {rest.length > 0 && (
                        <section className={section}>
                            <h2 className={h2}>Approved and answered, last two weeks ({rest.length})</h2>
                            {rest.map((r) => <Card key={r.rowId} row={r} mayApprove={false} act={act} busy={busy} />)}
                        </section>
                    )}
                    <p className="text-[12px] text-paper-foreground-soft">Instagram and Facebook comments are not read by the house yet.</p>
                </>
            )}
        </div>
    );
}

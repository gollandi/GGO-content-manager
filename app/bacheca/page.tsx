"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Document, RegisterHeading, RoomCrest } from "../../components/Registro";
import type { BoardThreadView, BoardView, OutboxEntry } from "../../lib/board/types";

/**
 * La Bacheca — the house board, where the intercom used to be (HOUSE-0010).
 *
 * JJ reads every thread, open and closed, and writes as `jj`: a new thread,
 * a reply, or a closure. Writes are queued here and reach the house when the
 * Mac bridge runs them through `operations/house-board.js`; until then they
 * show as pending, and a refusal stays on screen. Nothing here publishes.
 */

type Lang = "it" | "en";
type Mode = "open" | "reply" | "close";

interface Draft {
    id: string;
    date: string;
}

const STALE_AFTER_MS = 2 * 3_600_000;

const newDraft = (): Draft => ({
    id: `jj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
});

function slugify(title: string): string {
    return title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70)
        .replace(/-+$/g, "");
}

const formatDate = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : "—";

const recipientsOf = (to: string | string[] | undefined) => (Array.isArray(to) ? to : to ? [to] : []);

async function send(payload: Record<string, unknown>): Promise<void> {
    const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `The Cockpit answered ${res.status}`);
    }
}

const fieldClass = "w-full border border-paper-edge bg-paper-shade px-3 py-2.5 text-sm disabled:opacity-50";
const buttonClass =
    "border border-paper-edge px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-paper-foreground transition-colors hover:border-stamp hover:text-stamp disabled:opacity-40";

function RecipientPicker({
    roster,
    value,
    onChange,
    disabled,
}: {
    roster: readonly string[];
    value: string[];
    onChange: (next: string[]) => void;
    disabled: boolean;
}) {
    const options = ["house", ...roster.filter((name) => name !== "jj"), "jj"];
    return (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recipients">
            {options.map((name) => {
                const on = value.includes(name);
                return (
                    <button
                        key={name}
                        type="button"
                        disabled={disabled}
                        aria-pressed={on}
                        onClick={() => onChange(on ? value.filter((v) => v !== name) : [...value, name])}
                        className={`border px-2 py-1 font-condensed text-[11px] uppercase tracking-[0.1em] ${
                            on ? "border-stamp bg-stamp text-paper" : "border-paper-edge text-paper-foreground-soft"
                        }`}
                    >
                        {name}
                    </button>
                );
            })}
        </div>
    );
}

function LangPicker({ value, onChange, disabled }: { value: Lang; onChange: (l: Lang) => void; disabled: boolean }) {
    return (
        <div className="flex gap-1.5" role="radiogroup" aria-label="Language">
            {(["it", "en"] as const).map((lang) => (
                <button
                    key={lang}
                    type="button"
                    role="radio"
                    aria-checked={value === lang}
                    disabled={disabled}
                    onClick={() => onChange(lang)}
                    className={`border px-3 py-1 font-condensed text-[11px] uppercase tracking-[0.1em] ${
                        value === lang ? "border-stamp bg-stamp text-paper" : "border-paper-edge text-paper-foreground-soft"
                    }`}
                >
                    {lang === "it" ? "Italiano" : "English"}
                </button>
            ))}
        </div>
    );
}

function useSubmit(onDone: () => void) {
    const [draft, setDraft] = useState<Draft>(newDraft);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submit = async (payload: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            // The same id and date on every retry, so a double tap is one message.
            await send({ ...payload, id: draft.id, date: draft.date });
            setDraft(newDraft());
            onDone();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };
    return { busy, error, submit };
}

function Composer({ roster, existing, onDone }: { roster: readonly string[]; existing: Set<string>; onDone: () => void }) {
    const [title, setTitle] = useState("");
    const [to, setTo] = useState<string[]>(["house"]);
    const [lang, setLang] = useState<Lang>("it");
    const [tags, setTags] = useState("");
    const [body, setBody] = useState("");
    const { busy, error, submit } = useSubmit(() => {
        setTitle("");
        setTags("");
        setBody("");
        onDone();
    });
    const threadId = slugify(title);
    const clash = existing.has(threadId);
    const ready = threadId.length >= 3 && !clash && to.length > 0 && body.trim().length > 0;

    return (
        <Document className="p-5 max-sm:p-4">
            <label className="column-label mb-2 block text-paper-foreground-soft" htmlFor="board-title">
                Thread
            </label>
            <input id="board-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={fieldClass} placeholder="What it is about" />
            <p className="serial mt-1 text-xs text-paper-foreground-soft">
                {threadId ? threadId : "the thread id is made from the title"}
                {clash && " — already on the board, reply to it instead"}
            </p>

            <p className="column-label mb-2 mt-4 text-paper-foreground-soft">To</p>
            <RecipientPicker roster={roster} value={to} onChange={setTo} disabled={busy} />

            <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <div>
                    <p className="column-label mb-2 text-paper-foreground-soft">Language</p>
                    <LangPicker value={lang} onChange={setLang} disabled={busy} />
                </div>
                <div>
                    <label className="column-label mb-2 block text-paper-foreground-soft" htmlFor="board-tags">
                        Tags (optional)
                    </label>
                    <input id="board-tags" value={tags} onChange={(e) => setTags(e.target.value)} disabled={busy} className={fieldClass} placeholder="comma, separated" />
                </div>
            </div>

            <label className="column-label mb-2 mt-4 block text-paper-foreground-soft" htmlFor="board-body">
                Message
            </label>
            <textarea id="board-body" value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} rows={5} className={fieldClass} />

            {error && <p className="mt-3 text-sm text-seal" role="alert">{error}</p>}
            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || !ready}
                    onClick={() =>
                        void submit({ mode: "open", threadId, to, lang, body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) })
                    }
                >
                    {busy ? "Pinning…" : "Pin to the board"}
                </button>
            </div>
        </Document>
    );
}

function ThreadActions({ thread, roster, onDone }: { thread: BoardThreadView; roster: readonly string[]; onDone: () => void }) {
    const defaultTo = thread.opener && thread.opener !== "jj" ? [thread.opener] : thread.recipients.filter((r) => r !== "jj");
    const [mode, setMode] = useState<"reply" | "close">("reply");
    const [to, setTo] = useState<string[]>(defaultTo.length ? defaultTo : ["house"]);
    const [lang, setLang] = useState<Lang>((thread.events.at(-1)?.lang as Lang) ?? "it");
    const [body, setBody] = useState("");
    const { busy, error, submit } = useSubmit(() => {
        setBody("");
        onDone();
    });
    const ready = body.trim().length > 0 && (mode === "close" || to.length > 0);

    return (
        <div className="mt-4 border-t border-paper-edge pt-4">
            <div className="mb-3 flex gap-4">
                {(["reply", "close"] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        aria-pressed={mode === m}
                        className={`font-condensed text-[11px] uppercase tracking-[0.14em] underline-offset-4 ${
                            mode === m ? "text-paper-foreground underline" : "text-paper-foreground-soft"
                        }`}
                    >
                        {m === "reply" ? "Reply" : "Close the thread"}
                    </button>
                ))}
            </div>
            {mode === "reply" && (
                <div className="mb-3">
                    <RecipientPicker roster={roster} value={to} onChange={setTo} disabled={busy} />
                </div>
            )}
            <div className="mb-3">
                <LangPicker value={lang} onChange={setLang} disabled={busy} />
            </div>
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={busy}
                rows={3}
                aria-label={mode === "reply" ? "Reply" : "Reason for closing"}
                placeholder={mode === "reply" ? "Your reply" : "Why it is closed"}
                className={fieldClass}
            />
            {error && <p className="mt-2 text-sm text-seal" role="alert">{error}</p>}
            <div className="mt-3 flex justify-end">
                <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || !ready}
                    onClick={() =>
                        void submit(
                            mode === "reply"
                                ? { mode, threadId: thread.threadId, to, lang, body }
                                : { mode, threadId: thread.threadId, lang, body }
                        )
                    }
                >
                    {busy ? "Sending…" : mode === "reply" ? "Reply as JJ" : "Close as JJ"}
                </button>
            </div>
        </div>
    );
}

function Thread({ thread, roster, onDone }: { thread: BoardThreadView; roster: readonly string[]; onDone: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <li>
            <Document className="p-4">
                <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="block w-full text-left">
                    <div className="flex items-baseline justify-between gap-3">
                        <p className="document-title min-w-0 break-words text-[17px] leading-tight text-paper-foreground">{thread.threadId}</p>
                        <span
                            className={`shrink-0 border px-1.5 py-0.5 font-condensed text-[10px] uppercase tracking-[0.12em] ${
                                thread.closed ? "border-paper-edge text-paper-foreground-soft" : "border-stamp text-stamp"
                            }`}
                        >
                            {thread.closed ? `closed · ${thread.closedBy}` : "open"}
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-paper-foreground-soft">
                        {thread.opener} → {thread.recipients.join(", ")} · {thread.events.length} ·{" "}
                        <span className="serial">{formatDate(thread.lastDate)}</span>
                        {thread.pending && <span className="ml-2 text-stamp">awaiting the Mac</span>}
                    </p>
                    {thread.tags.length > 0 && <p className="serial mt-1 text-xs text-paper-foreground-soft">#{thread.tags.join(" #")}</p>}
                </button>

                {open && (
                    <>
                        <ol className="mt-4 space-y-4">
                            {thread.events.map((event) => (
                                <li
                                    key={event.id}
                                    className={`border-l-2 pl-3 ${event.from === "jj" ? "border-stamp" : "border-paper-edge"} ${event.pending ? "opacity-70" : ""}`}
                                >
                                    <p className="column-label column-label-paper">
                                        {event.kind === "close" ? `${event.from} closed the thread` : `${event.from} → ${recipientsOf(event.to).join(", ")}`}
                                        {" · "}
                                        <span className="serial">{formatDate(event.date)}</span>
                                        {" · "}
                                        {event.lang}
                                        {event.pending && " · pending"}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-paper-foreground">{event.body}</p>
                                </li>
                            ))}
                        </ol>
                        {!thread.closed && <ThreadActions thread={thread} roster={roster} onDone={onDone} />}
                    </>
                )}
            </Document>
        </li>
    );
}

function Refused({ entries }: { entries: OutboxEntry[] }) {
    if (entries.length === 0) return null;
    return (
        <section className="mb-9">
            <RegisterHeading label="Refused by the house" count={entries.length} />
            <ul className="space-y-2">
                {entries.map((entry) => (
                    <li key={entry.event.id}>
                        <Document className="border-seal p-3">
                            <p className="column-label column-label-paper">
                                {entry.event.kind} · {entry.event.threadId} · <span className="serial">{formatDate(entry.event.date)}</span>
                            </p>
                            <p className="mt-1 text-sm text-seal">{entry.reason}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-paper-foreground-soft">{entry.event.body}</p>
                        </Document>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function BachecaPage() {
    const [board, setBoard] = useState<BoardView | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [composing, setComposing] = useState(false);
    const [agent, setAgent] = useState("");
    const [status, setStatus] = useState<"all" | "open" | "closed">("all");
    const [tag, setTag] = useState("");

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/board", { cache: "no-store" });
            const data = (await res.json()) as BoardView & { error?: string };
            if (!res.ok) throw new Error(data.error || `The Cockpit answered ${res.status}`);
            setBoard(data);
            setLoadError(null);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : String(err));
        }
    }, []);

    useEffect(() => {
        void load();
        const agentParam = new URLSearchParams(window.location.search).get("agent");
        if (agentParam) setAgent(agentParam);
    }, [load]);

    const allTags = useMemo(() => [...new Set((board?.threads ?? []).flatMap((t) => t.tags))].sort(), [board]);
    const existing = useMemo(() => new Set((board?.threads ?? []).map((t) => t.threadId)), [board]);
    const threads = useMemo(
        () =>
            (board?.threads ?? []).filter(
                (t) =>
                    (!agent || t.participants.includes(agent) || t.recipients.includes(agent)) &&
                    (status === "all" || (status === "open" ? !t.closed : t.closed)) &&
                    (!tag || t.tags.includes(tag))
            ),
        [board, agent, status, tag]
    );

    const stale = board && (!board.syncedAt || Date.now() - Date.parse(board.syncedAt) > STALE_AFTER_MS);

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-8 max-sm:px-4 max-sm:py-6">
            <header className="mb-7 border-b border-plate-rule pb-4">
                <p className="column-label flex items-center gap-2">
                    <RoomCrest room="bacheca" size={16} inked />
                    La Bacheca
                </p>
                <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">La Bacheca</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-plate-foreground-soft">
                    The house board: every thread, open and closed. You write as JJ, in Italian or English. Your
                    messages reach the agents when the Mac next collects them; the board itself lives in
                    ernesto-agents-house.
                </p>
                <p className={`serial mt-2 text-xs ${stale ? "text-stamp" : "text-plate-foreground-soft"}`}>
                    {board
                        ? board.syncedAt
                            ? `Board received from the Mac ${formatDate(board.syncedAt)}${stale ? " — the Mac has not synced for over two hours" : ""}`
                            : "The Mac has not sent the board yet"
                        : "Loading…"}
                </p>
            </header>

            {loadError && (
                <p className="mb-6 text-sm text-seal" role="alert">
                    Could not read the board: {loadError}
                </p>
            )}

            {board && (
                <>
                    <Refused entries={board.rejected} />

                    <section className="mb-9">
                        <RegisterHeading
                            label="New thread"
                            action={
                                <button type="button" onClick={() => setComposing((v) => !v)} className="font-condensed text-[11px] uppercase tracking-[0.14em] text-plate-foreground underline-offset-4 hover:underline">
                                    {composing ? "Put it away" : "Write"}
                                </button>
                            }
                        />
                        {composing && (
                            <Composer
                                roster={board.roster}
                                existing={existing}
                                onDone={() => {
                                    setComposing(false);
                                    void load();
                                }}
                            />
                        )}
                    </section>

                    <section>
                        <RegisterHeading label="Threads" count={threads.length} />
                        <div className="mb-4 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                            <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agent" className={fieldClass}>
                                <option value="">Every agent</option>
                                {["house", ...board.roster].map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status" className={fieldClass}>
                                <option value="all">Open and closed</option>
                                <option value="open">Open</option>
                                <option value="closed">Closed</option>
                            </select>
                            <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag" className={fieldClass}>
                                <option value="">Every tag</option>
                                {allTags.map((t) => (
                                    <option key={t} value={t}>
                                        #{t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {threads.length === 0 ? (
                            <p className="py-6 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-plate-foreground-soft">
                                {board.threads.length === 0 ? "The board is empty" : "No thread matches these filters"}
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {threads.map((thread) => (
                                    <Thread key={thread.threadId} thread={thread} roster={board.roster} onDone={() => void load()} />
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

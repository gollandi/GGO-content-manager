"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Per-article actions on the Editorial site table. Every article carries its
 * own controls, at its own row: request an update (a small in-place form
 * that files a Desk work order for Edmondo), and — when a prepared patch
 * already exists for the page — the road to the gate where it is decided.
 */
export default function ArticleActions({
    title,
    pathname,
    patchReady,
}: {
    title: string;
    pathname: string | null;
    patchReady: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState<string | null>(null);

    async function send(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSending(true);
        try {
            const response = await fetch("/api/ernesto/directives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: `Update richiesto: ${title}`.slice(0, 190),
                    instruction:
                        `Articolo: ${title}${pathname ? ` (https://ggomed.co.uk${pathname})` : ""}.\n`
                        + `Richiesta di JJ dall'Editorial: ${text.trim()}\n`
                        + "Preparare la correzione come patch (bozza Sanity, mai publish — gate di JJ).",
                    agent: "Edmondo - website",
                    type: "recommendation",
                    priority: "Normal",
                }),
            });
            const result = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(result.error ?? "Richiesta non registrata");
            setDone("Ordine sul Desk — Edmondo lo raccoglie al prossimo giro.");
            setText("");
            setOpen(false);
        } catch (err) {
            setDone(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="min-w-[9rem]">
            <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                {patchReady && (
                    <Link
                        href="/review"
                        className="font-condensed text-[10px] font-bold uppercase tracking-[0.12em] text-seal hover:underline"
                    >
                        Patch pronta → Cancello
                    </Link>
                )}
                <button
                    type="button"
                    onClick={() => { setOpen((v) => !v); setDone(null); }}
                    className="font-condensed text-[10px] font-bold uppercase tracking-[0.12em] text-engraving-ink hover:text-seal"
                >
                    {open ? "Chiudi" : "Richiedi update"}
                </button>
            </div>

            {open && (
                <form onSubmit={send} className="mt-2 border border-paper-edge bg-paper-shade p-2 text-left">
                    <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        required
                        rows={3}
                        autoFocus
                        placeholder="Cosa va aggiornato in questa pagina…"
                        className="w-full resize-y border border-paper-edge bg-paper px-2.5 py-2 text-[13px] font-normal text-paper-foreground outline-none placeholder:text-paper-foreground-soft focus:border-engraving-ink"
                    />
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                        <button
                            type="submit"
                            disabled={sending || !text.trim()}
                            className="act-seal px-3 py-1.5 text-[11px]"
                        >
                            {sending ? "Registro…" : "Invia a Edmondo"}
                        </button>
                    </div>
                </form>
            )}
            {done && <p className="mt-1.5 text-right text-[11px] text-paper-foreground-soft">{done}</p>}
        </div>
    );
}

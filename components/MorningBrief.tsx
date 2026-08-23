"use client";

import { useEffect, useState } from "react";
import MarkdownBlock from "./MarkdownBlock";

/**
 * The morning brief, as the night left it. One card at the top of La Casa
 * di Ernesto: what the 07:00 job concluded, with the hour it was written.
 * Goes amber when the page is older than a day — a silent brief is itself
 * a finding.
 */

interface BriefPayload {
    configured: boolean;
    url: string | null;
    lastEditedAt: string | null;
    markdown: string;
    error?: string;
}

const STALE_AFTER_MS = 26 * 60 * 60 * 1000;

function formatWhen(value: string | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return value;
    return new Intl.DateTimeFormat("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

export default function MorningBrief() {
    const [brief, setBrief] = useState<BriefPayload | null>(null);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        let alive = true;
        fetch("/api/ernesto/brief", { cache: "no-store" })
            .then(async (res) => {
                const json = (await res.json()) as BriefPayload;
                if (alive) setBrief(json);
            })
            .catch((err: unknown) => {
                if (alive) setBrief({ configured: true, url: null, lastEditedAt: null, markdown: "", error: String(err) });
            });
        return () => {
            alive = false;
        };
    }, []);

    if (brief && !brief.configured) return null; // room degrades silently when no page id is set

    const stale = brief?.lastEditedAt ? Date.now() - new Date(brief.lastEditedAt).getTime() > STALE_AFTER_MS : false;

    return (
        <section className="mb-4 paper border border-paper-edge p-5 text-paper-foreground">
            <div className="flex items-baseline justify-between gap-3">
                <div>
                    <div className="column-label column-label-paper">Brief del mattino</div>
                    <h3 className="mt-1 text-base font-bold">
                        {brief?.lastEditedAt ? `Scritto ${formatWhen(brief.lastEditedAt)}` : "Il brief della notte"}
                    </h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    {brief?.url && (
                        <a href={brief.url} target="_blank" rel="noreferrer" className="font-semibold text-engraving-ink hover:underline">
                            Apri in Notion
                        </a>
                    )}
                    <button type="button" onClick={() => setOpen((v) => !v)} className="font-semibold text-engraving-ink hover:underline">
                        {open ? "Chiudi" : "Apri"}
                    </button>
                </div>
            </div>
            {stale && (
                <p className="mt-2 border border-seal px-3 py-2 text-xs text-seal">
                    Il brief non è stato riscritto da più di un giorno: il job delle 07:00 potrebbe non aver girato.
                </p>
            )}
            {brief?.error && <p className="mt-2 text-xs text-seal">{brief.error}</p>}
            {!brief && <p className="mt-3 text-xs text-paper-foreground-soft">Leggo il brief…</p>}
            {open && brief && brief.markdown && (
                <div className="mt-3 max-h-[28rem] overflow-y-auto border-t border-paper-edge pt-3">
                    <MarkdownBlock content={brief.markdown} />
                </div>
            )}
            {open && brief && brief.configured && !brief.markdown && !brief.error && (
                <p className="mt-3 text-xs text-paper-foreground-soft">La pagina del brief è vuota.</p>
            )}
        </section>
    );
}

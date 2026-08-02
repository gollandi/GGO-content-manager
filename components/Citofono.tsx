"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomCrest, ROOM_INK, type RoomId } from "./Registro";

/**
 * IL CITOFONO — the room's intercom panel.
 *
 * A quiet button in the room's corner; pressed, it opens a paper panel and
 * puts JJ on the line with the room's resident voice. The transcript lives
 * in the client (sessionStorage per voice); the voice reads its room live
 * and may deposit a proposal — nothing else.
 */

type VoiceKey = "portineria" | "edmondo" | "ettore" | "ambrogio";

const VOICE_META: Record<VoiceKey, { name: string; subtitle: string; room: RoomId }> = {
    portineria: { name: "La Portineria", subtitle: "Chi cerchi?", room: "atrio" },
    edmondo: { name: "Edmondo", subtitle: "Caporedattore del sito", room: "editorial" },
    ettore: { name: "Ettore", subtitle: "Manutentore della casa", room: "soffitta" },
    ambrogio: { name: "Ambrogio", subtitle: "Maggiordomo · solo lettura", room: "ambrogio" }
};

interface Msg {
    role: "user" | "assistant";
    content: string;
}

export default function Citofono({ voice }: { voice: VoiceKey }) {
    const meta = VOICE_META[voice];
    const ink = ROOM_INK[meta.room];
    const storageKey = `citofono-${voice}`;

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(storageKey);
            if (raw) setMessages(JSON.parse(raw));
        } catch {
            /* an empty line is a valid line */
        }
    }, [storageKey]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, open]);

    const persist = useCallback(
        (next: Msg[]) => {
            setMessages(next);
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(next.slice(-40)));
            } catch {
                /* best effort */
            }
        },
        [storageKey]
    );

    async function send() {
        const text = input.trim();
        if (!text || busy) return;
        setInput("");
        setNote(null);
        const base: Msg[] = [...messages, { role: "user", content: text }];
        persist([...base, { role: "assistant", content: "" }]);
        setBusy(true);

        try {
            const res = await fetch(`/api/citofono/${voice}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ messages: base })
            });
            if (!res.ok || !res.body) {
                const detail = await res.text().catch(() => "");
                throw new Error(`(${res.status}) ${detail.slice(0, 160)}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let reply = "";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const ev = JSON.parse(line) as {
                        type: string;
                        text?: string;
                        name?: string;
                        message?: string;
                        usage?: { inputTokens: number; outputTokens: number };
                    };
                    if (ev.type === "text" && ev.text) {
                        reply += ev.text;
                        persist([...base, { role: "assistant", content: reply }]);
                    } else if (ev.type === "tool") {
                        setNote(
                            ev.name === "deposita_proposta"
                                ? "Sta depositando una proposta nel registro dei Needs…"
                                : `Sta leggendo: ${ev.name}`
                        );
                    } else if (ev.type === "error") {
                        throw new Error(ev.message ?? "La linea è caduta");
                    } else if (ev.type === "done") {
                        setNote(null);
                    }
                }
            }
            if (!reply.trim()) {
                persist([...base, { role: "assistant", content: "…la linea è rimasta muta. Riprova." }]);
            }
        } catch (err) {
            persist([
                ...base,
                {
                    role: "assistant",
                    content: `La linea è caduta: ${err instanceof Error ? err.message : String(err)}`
                }
            ]);
        } finally {
            setBusy(false);
            setNote(null);
        }
    }

    return (
        <>
            {/* The intercom button, engraved into the room's corner. */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="fixed bottom-5 right-5 z-[55] flex items-center gap-2.5 border border-plate-rule bg-plate px-4 py-3 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-plate-foreground transition-colors hover:border-engraving-bright hover:text-engraving-bright"
                style={open ? { borderColor: ink.bright, color: ink.bright } : undefined}
            >
                <RoomCrest room={meta.room} size={16} />
                Citofono · {meta.name}
            </button>

            {open && (
                <section
                    aria-label={`Citofono con ${meta.name}`}
                    className="paper fixed bottom-20 right-5 z-[55] flex max-h-[72vh] w-[26rem] max-w-[calc(100vw-2.5rem)] flex-col border border-paper-edge"
                >
                    {/* Letterhead */}
                    <header className="flex items-center gap-3 border-b-[3px] border-double border-paper-edge px-4 py-3">
                        <span style={{ color: ink.accent }}>
                            <RoomCrest room={meta.room} size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="document-title text-[16px] leading-none text-paper-foreground">{meta.name}</p>
                            <p className="column-label column-label-paper mt-1">{meta.subtitle}</p>
                        </div>
                        {messages.length > 0 && (
                            <button
                                type="button"
                                onClick={() => persist([])}
                                className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft underline-offset-2 hover:underline"
                            >
                                Nuova linea
                            </button>
                        )}
                    </header>

                    {/* The line */}
                    <div className="min-h-[10rem] flex-1 overflow-y-auto px-4 py-3">
                        {messages.length === 0 && (
                            <p className="py-6 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                                {voice === "ambrogio" ? "Il maggiordomo è in ascolto" : "La linea è aperta"}
                            </p>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`mb-3 ${m.role === "user" ? "pl-8" : "pr-4"}`}>
                                <p className="column-label column-label-paper mb-1">
                                    {m.role === "user" ? "JJ" : meta.name}
                                </p>
                                <div
                                    className={[
                                        "whitespace-pre-wrap text-[13px] leading-relaxed",
                                        m.role === "user"
                                            ? "border-r-2 pr-2 text-right text-paper-foreground"
                                            : "text-paper-foreground"
                                    ].join(" ")}
                                    style={m.role === "user" ? { borderRightColor: ink.accent } : undefined}
                                >
                                    {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                                </div>
                            </div>
                        ))}
                        {note && (
                            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                                {note}
                            </p>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* The handset */}
                    <div className="border-t border-paper-edge px-3 py-2.5">
                        <div className="flex items-end gap-2">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        void send();
                                    }
                                }}
                                rows={2}
                                placeholder={`Parla con ${meta.name}…`}
                                className="min-h-[2.5rem] flex-1 resize-none border border-paper-edge bg-transparent px-2.5 py-1.5 text-[13px] text-paper-foreground outline-none placeholder:text-paper-foreground-soft focus:border-engraving-ink"
                            />
                            <button
                                type="button"
                                onClick={() => void send()}
                                disabled={busy || !input.trim()}
                                className="act-quiet"
                                style={{ borderColor: ink.accent, color: ink.accent }}
                            >
                                {busy ? "…" : "Parla"}
                            </button>
                        </div>
                        <p className="mt-1.5 text-[10px] italic text-paper-foreground-soft">
                            {voice === "ambrogio"
                                ? "Ambrogio legge e consiglia; gli audit nascono nel suo studio, non da qui."
                                : "Le voci leggono la casa e possono depositare proposte; ogni altra azione passa dai canali."}
                        </p>
                    </div>
                </section>
            )}
        </>
    );
}

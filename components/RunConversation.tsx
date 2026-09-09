import type { RefObject } from "react";
import MarkdownBlock from "./MarkdownBlock";
export interface ConversationRow { key: number; kind: "text" | "tool" | "status" | "jj"; text: string }

export function isConversationRow(row: ConversationRow): boolean {
    return row.kind === "text" || row.kind === "jj" || (row.kind === "status" && /^(❓|Proposta presentata)/.test(row.text));
}

export function RunConversation({ rows, endRef }: { rows: ConversationRow[]; endRef: RefObject<HTMLDivElement> }) {
    // Questions and review requests remain visible. Tool events and progress
    // telemetry are preserved verbatim but do not interrupt the conversation.
    const visible = rows.filter(isConversationRow);
    const technical = rows.filter((row) => !isConversationRow(row));
    return <>
        <div className="mb-4 max-h-[440px] space-y-4 overflow-y-auto text-sm">
            {visible.map((row) => row.kind === "jj" ?
                <p key={row.key} className="ml-8 whitespace-pre-wrap border border-ggo-teal/30 bg-ggo-teal/10 p-3">{row.text}</p> :
                <MarkdownBlock key={row.key} content={row.text} className="max-w-[70ch] text-[15px] leading-7" />)}
            <div ref={endRef} />
        </div>
        {technical.length > 0 && <details className="mb-4 border-t border-paper-edge pt-3">
            <summary className="cursor-pointer text-xs font-semibold">Dettagli tecnici dell'esecuzione · {technical.length} eventi</summary>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto font-mono text-xs">
                {technical.map((row) => <p key={row.key} className="whitespace-pre-wrap break-words">{row.text}</p>)}
            </div>
        </details>}
    </>;
}

import type { Narrative } from "../lib/briefing/policy";

/** Readable paragraphs are the primary view. Original evidence belongs in a
 * separate disclosure owned by the caller, never silently rewritten in storage. */
export function NarrativeAccount({ narrative }: { narrative: Narrative }) {
    return <div className="max-w-[70ch]">
        <div className="space-y-3 text-[15px] leading-7">
            {narrative.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        {narrative.sourcePartial && <p className="mt-3 text-xs leading-relaxed opacity-70">La fonte è molto lunga: questa lettura approfondisce un estratto. Il quadro essenziale considera l’intera fonte; per le singole decisioni consulta il testo originale.</p>}
        {narrative.status !== "ready" && <p role="status" className="mt-3 text-xs leading-relaxed opacity-70">
            {narrative.status === "pending" ? "Questo è il quadro essenziale. La lettura ragionata è in preparazione e apparirà qui appena pronta."
                : "Quadro essenziale ricavato dai dati disponibili. La lettura ragionata non è al momento disponibile."}
        </p>}
    </div>;
}

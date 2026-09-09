import type { RunMeta } from "../runner/store";
import { prepareNarrative } from "./service";

export function getRunSummary(meta: RunMeta) {
    const drafts = meta.drafts?.length ?? 0;
    const captions = meta.captions?.length ?? 0;
    const state = meta.status === "done" ? "L'attività risulta conclusa nel registro." :
        meta.status === "awaiting-jj" ? "L'attività è in attesa del tuo intervento." :
        meta.status === "error" ? "L'attività segnala un errore e richiede una verifica." :
        "Lo stato registrato non conferma il completamento dell'attività.";
    const fallback = [
        `${state} Gli elaborati registrati comprendono ${drafts} bozze e ${captions} testi social. Il conteggio riguarda materiale preparato, non una pubblicazione.`,
        (meta.criticsCleared ? "Le revisioni automatiche risultano eseguite." : "Le revisioni automatiche non risultano completate.") +
        " Il testo finale, le fonti e gli eventuali punti aperti vanno comunque esaminati nella review umana prima di pubblicare.",
    ];
    return prepareNarrative({ key: `Nota di riconsegna: ${meta.runId}`, fallback,
        source: JSON.stringify({ title: meta.title, status: meta.status, drafts: meta.drafts, captions: meta.captions?.map((c) => c.rowTitle),
            proposalApproved: meta.proposalApproved, criticsCleared: meta.criticsCleared, summary: meta.summary }) });
}

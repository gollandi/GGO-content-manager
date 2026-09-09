/** Conservative prose derived from explicit facts; never an invented LLM account. */
export interface ReportRun {
    id: string; run: string; job: string | null; status: string | null;
    startedAt: string | null; durationMs: number | null; rowsWritten: number | null;
    errors: number | null; summary: string; errorMessage: string; triggeredBy: string | null;
}
export const FINISHED = new Set(["Success", "Done", "Published"]);
export const ATTENTION = new Set(["Failed", "Partial", "Blocked", "Error"]);
export function runNeedsAttention(run: ReportRun): boolean {
    return ATTENTION.has(run.status ?? "") || (run.errors ?? 0) > 0;
}
export function dayFallback(runs: ReportRun[]): string[] {
    if (!runs.length) return ["Nel periodo non risultano attività registrate. Questo non basta a stabilire se i processi siano rimasti fermi o se manchino i dati del registro."];
    const attention = runs.filter(runNeedsAttention).length;
    const finished = runs.filter((r) => FINISHED.has(r.status ?? "") && !runNeedsAttention(r)).length;
    const running = runs.filter((r) => r.status === "Running" && !runNeedsAttention(r)).length;
    const other = runs.length - attention - finished - running;
    const rows = runs.reduce((sum, r) => sum + Math.max(0, r.rowsWritten ?? 0), 0);
    const paragraphs = [
        `Il registro riporta ${runs.length} esecuzioni: ${finished} risultano completate${running ? ` e ${running} ancora in corso` : ""}. ` +
        (attention ? `Per ${attention} occorre controllare l'esito prima di considerare concluso il lavoro.` : "Negli stati disponibili non risultano esecuzioni segnalate come problematiche.") +
        (other ? ` Per altre ${other} lo stato non permette di confermare un completamento.` : ""),
    ];
    if (attention) {
        const problems = runs.filter(runNeedsAttention).map((r) => r.errorMessage || r.summary).join("\n");
        const causes: string[] = [];
        if (/oauth|unauthori[sz]ed|\b401\b|token.*(?:expired|invalid|revoked)/i.test(problems)) causes.push("un accesso a una fonte esterna è stato respinto e va verificata la connessione");
        if (/timeout|timed out|etimedout/i.test(problems)) causes.push("almeno un passaggio non è terminato nel tempo disponibile");
        if (/429|rate.limit/i.test(problems)) causes.push("una fonte ha limitato la frequenza delle richieste");
        paragraphs.push(causes.length ? `I messaggi registrati indicano che ${causes.join("; inoltre ")}. Non dimostrano da soli quale sia la causa di tutti gli esiti incompleti.` : "I dati disponibili segnalano un lavoro incompleto, ma non ne chiariscono la causa. Il dettaglio delle esecuzioni permette di verificare che cosa è rimasto da fare.");
    }
    paragraphs.push(rows ? `Sono registrati ${rows} aggiornamenti di dati. Questa misura non dice quanti contenuti siano stati prodotti o pubblicati: per valutarli occorre guardare gli elaborati e la loro revisione.` : "Il registro non riporta aggiornamenti di dati quantificati. Non è quindi possibile dedurre da queste sole esecuzioni un risultato editoriale o una pubblicazione.");
    return paragraphs;
}

/** Recognise only facts explicitly emitted by the legacy morning-brief writer.
 * Unknown formats remain unknown. Raw lines and inferred task priorities never
 * become assertions in the operator's summary. */
export function morningFallback(markdown: string): string[] {
    const paragraphs: string[] = [];
    const actions = markdown.split(/^## Azioni in attesa di JJ\s*$/m)[1]?.split(/^## /m)[0];
    const gating = [...(actions ?? "").matchAll(/^\s*-\s+\[?\[(?:ANCORA IN ATTESA|in attesa) \d+d([^\]]*)\]/gm)];
    const pending = markdown.match(/^(\d+) decision\(s\) waiting/m);
    if (actions?.includes("FAILED")) paragraphs.push("La sezione delle azioni in attesa non è stata letta correttamente. Non è possibile confermare quali decisioni spettino a te dal solo brief.");
    else if (gating?.length) {
        const overdue = gating.filter((match) => match[1].includes("OLTRE SCADENZA")).length;
        paragraphs.push(`Il brief indica ${gating.length === 1 ? "una richiesta che attende" : `${gating.length} richieste che attendono`} il tuo intervento${pending ? `, su ${pending[1]} voci aperte della scrivania` : ""}. ` +
            (overdue ? `${overdue === 1 ? "Una è segnalata oltre scadenza: è" : `${overdue} sono segnalate oltre scadenza: sono`} il primo punto da verificare prima di riordinare le priorità.` : "Per decidere, occorre leggere le singole proposte: questo conteggio non equivale a un'approvazione."));
    } else if (actions?.includes("Nothing needs your hand today.")) paragraphs.push("Il brief non segnala richieste dirette del tuo intervento nella sezione dedicata. Questo dato riguarda le decisioni registrate, non certifica da solo lo stato dell'intera pipeline.");
    else if (pending) paragraphs.push(`La scrivania contiene ${pending[1]} voci ancora aperte. Il conteggio non permette da solo di distinguere le decisioni urgenti dalle raccomandazioni da valutare.`);
    const night = markdown.match(/^(\d+) run\(s\) across (\d+) job\(s\).*?— (\d+) job\(s\) failed, (\d+) partial/m);
    if (night) paragraphs.push(Number(night[1]) === 0 ? "Nella finestra notturna non risultano esecuzioni registrate. Il brief stesso segnala che questo può indicare un problema di registrazione: non va interpretato come una notte senza problemi." :
        `Nella finestra notturna risultano ${night[1]} esecuzioni distribuite su ${night[2]} attività. Il registro segnala ${night[3]} attività fallite e ${night[4]} completate solo in parte; questi esiti descrivono l'esecuzione, non la qualità dei contenuti.`);
    const review = markdown.match(/^(?:\d{4}-\d{2}-\d{2}: )?output (\d+) — (\d+) reached Review/m);
    if (review) paragraphs.push(`Il registro di produzione indica ${review[2]} elementi arrivati alla revisione. È un passaggio da valutare sui contenuti effettivi: arrivare in revisione non significa avere il via libera alla pubblicazione.`);
    const gaps: string[] = [];
    if (/^(?:FAILED to (?:read|compute)|No throughput record|Drift data unavailable)/m.test(markdown)) gaps.push("alcune fonti non sono disponibili, quindi il quadro resta incompleto");
    if (/^DROUGHT —/m.test(markdown)) gaps.push("è segnalata una carenza di output, da verificare prima di giudicare il lavoro produttivo");
    if (/^CAP BREACHED/m.test(markdown)) gaps.push("il budget riportato supera il limite previsto");
    if (gaps.length) paragraphs.push(`Il brief richiede anche cautela: ${gaps.join("; ")}. Questi segnali non vanno assorbiti in un giudizio generale di buon funzionamento.`);
    if (!paragraphs.length) paragraphs.push("Il documento disponibile non contiene conteggi o esiti che la lettura essenziale possa riconoscere con sicurezza. Le priorità restano da verificare nel testo originale; non vengono dedotte dalla sola presenza di un log.");
    return paragraphs;
}

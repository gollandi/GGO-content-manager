/** Shared editorial contract for operator-facing accounts, never patient copy. */
export const BRIEFING_STYLE = `Scrivi per JJ in prosa italiana leggibile, ponderata e concreta, salvo una sua richiesta esplicita di un’altra lingua.
Apri con il risultato o il problema che conta; collega i fatti alle conseguenze,
poi indica cosa resta incerto e quale giudizio o decisione serve a JJ.
Usa da due a quattro paragrafi brevi, ciascuno con un filo logico. Evita elenchi,
cronologie riga per riga, titoli a raffica, gergo, percorsi, ID, JSON e raw log.
Una sintesi deve spiegare il significato, non limitarsi a togliere i trattini.
Accorpa ripetizioni e controlli periodici; conserva problemi, disaccordi,
scadenze e richieste di decisione. Non inventare nessi causali, esiti o urgenze:
un'interpretazione o un suggerimento devono essere riconoscibili come tali.
Una run completata o dei record scritti non provano che esistano contenuti
prodotti o pubblicati. Una fonte assente non significa che tutto vada bene.
Non chiamare approvato o pubblicato ciò che è soltanto proposto, preparato o
in revisione. Questa lettura non autorizza alcuna azione: la pubblicazione
richiede sempre la review umana prevista dal sistema.`;

export interface Narrative {
    paragraphs: string[];
    status: "ready" | "pending" | "basic" | "unavailable";
    generatedAt: string | null;
    sourcePartial?: boolean;
}

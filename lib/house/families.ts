/**
 * The two families of the Ernesto Desk — declared once, read everywhere.
 *
 * A desk row is either an EDITORIAL proposal (something to publish, cut or
 * caption: it goes through Il Cancello with its text and assets) or a
 * QUESTION (something to answer, decide or plan: it goes to Le Questioni,
 * grouped by kind so a hundred recommendations never bury one clip).
 *
 * Two rules decide the family:
 *   1. By content — a row carrying a clip or a still is an editorial
 *      proposal whatever its Type says. The girls file "is this cut right?"
 *      as a question; JJ reads it as a clip to judge, at the gate.
 *   2. By type — otherwise the Type decides, and any type not listed is a
 *      question: the safe side, because an unknown type must never slip
 *      into the publish gate unnoticed.
 */
export const EDITORIAL_DESK_TYPES = ["publish-approval", "clip-script", "long-video-proposal"] as const;
export const QUESTION_DESK_TYPES = ["question", "recommendation", "plan-proposal", "budget-request"] as const;

export type DeskFamily = "editorial" | "question";

export function deskFamily(type: string | null | undefined, hasMedia = false): DeskFamily {
    if (hasMedia) return "editorial";
    return (EDITORIAL_DESK_TYPES as readonly string[]).includes(type ?? "") ? "editorial" : "question";
}

/** Human labels for the question kinds, in the order the room lists them. */
export const QUESTION_KINDS: { type: string; label: string; verb: string }[] = [
    { type: "question", label: "Domande", verb: "da rispondere" },
    { type: "plan-proposal", label: "Piani proposti", verb: "da approvare" },
    { type: "budget-request", label: "Richieste di budget", verb: "da concedere" },
    { type: "recommendation", label: "Raccomandazioni", verb: "da valutare" },
];

export const EDITORIAL_KINDS: { type: string; label: string }[] = [
    { type: "publish-approval", label: "Da pubblicare" },
    { type: "clip-script", label: "Script di clip" },
    { type: "long-video-proposal", label: "Proposte di video lungo" },
];

/* ── Calendar shadowing (2026-10-24) ──────────────────────────────────── */

const bareId = (id: string) => id.replace(/-/g, "").toLowerCase();

/** Bare ids of the Calendar rows that stand at Il Cancello themselves:
 *  Review rows to seal and approved staged rows waiting for Buffer. */
export function gateCalendarIds(calendar: { rowId: string; status: string | null; sanitySync?: string }[]): Set<string> {
    return new Set(calendar
        .filter((r) => r.status === "Review" || (r.status === "Approved" && Boolean(r.sanitySync)))
        .map((r) => bareId(r.rowId)));
}

/** A desk row that only re-offers a Calendar row already at the gate. It is
 *  shown once, as the Calendar row, whose seal is the publish act (E.1).
 *  Until 2026-10-24 JJ met the same carousel twice and the count said so. */
export function shadowedByCalendar(row: { calendarRowIds?: string[] }, gateIds: Set<string>): boolean {
    return (row.calendarRowIds ?? []).some((id) => gateIds.has(bareId(id)));
}

/**
 * The two families of the Ernesto Desk — declared once, read everywhere.
 *
 * A desk row is either an EDITORIAL proposal (something to publish, cut or
 * caption: it goes through Il Cancello with its text and assets) or a
 * QUESTION (something to answer, decide or plan: it goes to Le Questioni,
 * grouped by kind so a hundred recommendations never bury one clip).
 *
 * Any type not listed is treated as a question: the safe side, because an
 * unknown type must never slip into the publish gate unnoticed.
 */
export const EDITORIAL_DESK_TYPES = ["publish-approval", "clip-script", "long-video-proposal"] as const;
export const QUESTION_DESK_TYPES = ["question", "recommendation", "plan-proposal", "budget-request"] as const;

export type DeskFamily = "editorial" | "question";

export function deskFamily(type: string | null | undefined): DeskFamily {
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

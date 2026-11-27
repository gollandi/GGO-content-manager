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

/**
 * How many acts Il Cancello puts in front of JJ at once.
 *
 * JJ, 27 November 2026, with 246 acts on the register: "o me li porti a 5
 * oppure il cockpit chiude". A register he will never read is not a gate, it
 * is a backlog shaped like one. The gate shows five; the rest wait in a queue
 * the agents hold, and the next one rises as each is sealed. Nothing is hidden
 * — the queue is listed under the register — and nothing is decided on his
 * behalf: every publish still needs his seal.
 */
export const SEAL_CAP = 5;

export interface Sealable {
    family: string;
    /**
     * Days since the slot or due date, as Il Cancello computes them
     * (daysUntil in app/review/page.tsx): positive once it has passed,
     * zero today, negative while it is still ahead.
     */
    dueDays: number | null;
    priority?: string | null;
}

/**
 * The order the gate offers acts in. Urgent desk acts first, then website
 * patches already written (they carry clinical fixes), then social posts
 * whose slot is still ahead (nearest first), then the rest of the desk, and
 * last the posts whose slot has passed — a stale slot is the agents' to
 * reschedule, not JJ's to hurry.
 */
export function sealRank(e: Sealable): [number, number] {
    const d = e.dueDays;
    if (e.family === "Desk" && e.priority === "Urgent") return [0, -(d ?? 0)];
    if (e.family === "Website") return [1, 0];
    // A slot still ahead (or today), nearest first.
    if (e.family === "Social" && d !== null && d <= 0) return [2, -d];
    if (e.family !== "Social") return [3, -(d ?? 0)];
    return [4, -(d ?? 0)];
}

/** Split the register into the acts shown and the acts held in queue. */
export function capForSeal<T extends Sealable>(entries: T[], cap = SEAL_CAP): { shown: T[]; held: T[] } {
    const ranked = entries
        .map((e, i) => ({ e, i, k: sealRank(e) }))
        .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i)
        .map((x) => x.e);
    return { shown: ranked.slice(0, cap), held: ranked.slice(cap) };
}

/** Today's date as YYYY-MM-DD in the reader's own time zone (not UTC). */
export function localToday(now = new Date()): string {
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Whether a social post may not be sealed until JJ gives it a date from
 * today on. Approving publishes, so a post whose day has gone would go out
 * at once on a stale slot. Judged on the date that would be sealed: the one
 * JJ has typed if any, else the proposed one; a proposed time already past
 * today counts as passed too.
 */
export function needsNewDate(input: { proposed: string | null; planned: string; now?: Date }): boolean {
    const now = input.now ?? new Date();
    const today = localToday(now);
    const day = input.planned || (input.proposed ? input.proposed.slice(0, 10) : "");
    if (!day) return false;
    if (day < today) return true;
    // Same day: only the proposed slot carries a time, and only if JJ has not
    // moved the date.
    if (day === today && input.proposed && input.proposed.length > 10 && (!input.planned || input.planned === input.proposed.slice(0, 10))) {
        const t = new Date(input.proposed).getTime();
        return Number.isFinite(t) && t < now.getTime();
    }
    return false;
}

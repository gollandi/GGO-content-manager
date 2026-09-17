/**
 * The house board, as the Cockpit sees it (HOUSE-0010).
 *
 * The board's source of truth is `docs/board/*.jsonl` in ernesto-agents-house,
 * on JJ's Mac. The Cockpit holds a snapshot of it and an outbox of what JJ
 * wrote here; a bridge on the Mac drains the outbox through the house's own
 * writer and pushes the board back.
 */

export type BoardLang = "it" | "en";
export type BoardKind = "message" | "close";

export interface BoardEvent {
    id: string;
    threadId: string;
    date: string;
    kind: BoardKind;
    from: string;
    /** Messages only: a rostered agent, `house` or `jj`, or a list of them. */
    to?: string | string[];
    lang: BoardLang;
    body: string;
    tags?: string[];
}

export type OutboxStatus = "pending" | "accepted" | "rejected";

export interface OutboxEntry {
    event: BoardEvent;
    status: OutboxStatus;
    queuedAt: string;
    settledAt: string | null;
    /** The house writer's refusal, verbatim, when rejected. */
    reason: string | null;
}

export interface BoardEventView extends BoardEvent {
    /** Written in the Cockpit but not yet in the house's copy of the board. */
    pending: boolean;
}

export interface BoardThreadView {
    threadId: string;
    opener: string | null;
    recipients: string[];
    participants: string[];
    tags: string[];
    lastDate: string | null;
    closed: boolean;
    closedBy: string | null;
    pending: boolean;
    events: BoardEventView[];
}

export interface BoardView {
    /** When the Mac last pushed the board; null if it never has. */
    syncedAt: string | null;
    threads: BoardThreadView[];
    /** JJ's writes the house refused, so they are never silently lost. */
    rejected: OutboxEntry[];
    roster: readonly string[];
}

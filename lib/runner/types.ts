/**
 * Run-event taxonomy for La Casa di Ernesto — NDJSON over the SSE endpoint.
 * Borrowed pattern: the Helm runner's RunEvent stream (reference-only).
 */

export type RunEvent =
    | { type: "run.start"; runId: string; skill: string; model: string }
    | { type: "turn.start"; turn: number }
    | { type: "text"; text: string }
    | { type: "tool.use"; name: string; summary: string }
    | { type: "tool.result"; name: string; ok: boolean; summary: string }
    | { type: "science.recorded"; claim: string; source: string; url: string }
    | { type: "critics.verdict"; critic: "tatiana" | "aspasia"; verdict: string }
    | { type: "proposal.presented"; proposal: Proposal }
    | { type: "jj.asked"; question: string }
    | { type: "jj.said"; text: string }
    | { type: "run.paused"; reason: "proposal" | "question" }
    | { type: "usage"; totals: UsageTotals }
    | { type: "caption.written"; item: CaptionItem }
    | { type: "draft.created"; draftId: string; docType: string; title: string }
    | { type: "run.done"; reason: "finished" | "max-turns" | "aborted" | "error"; summary: string; draftIds: string[] }
    | { type: "run.error"; message: string };

export interface RunRequest {
    /** Skill bundle directory name under the skills dir (allow-listed). */
    skill: string;
    /** JJ's brief — what to write. */
    brief: string;
}

export interface CreatedDraft {
    draftId: string;
    docType: string;
    title: string;
}

/** One entry in Berenice's source ledger — fresh science behind the prose. */
export interface ScienceEntry {
    claim: string;
    source: string; // authority/journal + year
    url: string;
}

/** A planned visual/asset deliverable, listed in the proposal. */
export interface Deliverable {
    kind: "svg-infographic" | "illustration" | "photo" | "canva" | "video" | "other";
    title: string;
    description: string;
    /** Ready-to-paste generation prompt (Higgsfield/Canva) for assets the
     *  runner cannot produce in-page. */
    generationPrompt?: string;
    /** True when the runner will build it in-page (svgBlock) after approval. */
    inPage: boolean;
}

/** A planned interactive section, highlighted for JJ's review. */
export interface InteractiveSection {
    block: string; // e.g. faqInlineBlock, quizBlock, accordionBlock
    title: string;
    note: string;
}

/** One caption written by Family B (Samantha) on a Calendar row. */
export interface CaptionItem {
    rowId: string;
    rowTitle: string;
    platform: string | null;
    caption: string;
    hashtags: string;
}

/** Running token/cost totals for a run (all legs + critics included). */
export interface UsageTotals {
    inputTokens: number;      // full-price input
    outputTokens: number;
    cacheReadTokens: number;  // ~0.1× input price
    cacheWriteTokens: number; // 2× input price (1h TTL)
    estCostUsd: number;
}

/** The pre-draft proposal JJ reviews and chats over before anything lands in Sanity. */
export interface Proposal {
    proposalMarkdown: string;
    deliverables: Deliverable[];
    interactiveSections: InteractiveSection[];
}

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

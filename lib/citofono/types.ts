/**
 * Shared shapes for Il Citofono.
 *
 * These live apart from `voices.ts` so a tool can be defined in its own module
 * without importing the voice registry — which would be circular, since the
 * registry imports the tools. The split exists for the Ambrogio boundary (see
 * `tools/deposita-proposta.ts`), not for tidiness.
 */

export type VoiceId = "portineria" | "edmondo" | "ettore" | "ambrogio";

export interface ToolResultPayload {
    ok: boolean;
    data?: unknown;
    error?: string;
}

export interface ToolSpec {
    name: string;
    description: string;
    input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
    run: (input: Record<string, unknown>, ctx: { isWriter: boolean; voice: VoiceId }) => Promise<ToolResultPayload>;
}

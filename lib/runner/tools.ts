/**
 * Family A tool surface — copywriter → gxyjgvr0 drafts (spec §6.2, §0.0.4).
 *
 * Dedicated tools (not bash) so the harness can gate and audit each action:
 * reads go through the SAME named views the cockpit UI uses; writes go
 * through the drafts-only client. There is deliberately NO publish tool.
 */
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { VIEW_REGISTRY, isViewName } from "../views";
import { ggomedClient, ggomedRawClient } from "../sanity/clients";
import { createDraft, patchDraft } from "../sanity/write-client";
import { ALLOWED_DOC_TYPES } from "./shape";
import type { CreatedDraft, ScienceEntry } from "./types";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
    {
        name: "record_science",
        description:
            "Berenice's source ledger. Record ONE piece of fresh science you just verified via web_search — a clinical claim you intend to use, with its source. Every clinical statement in your drafts must trace back to a ledger entry. Record BEFORE drafting, one call per claim.",
        input_schema: {
            type: "object" as const,
            properties: {
                claim: { type: "string", description: "The clinical claim, in one sentence" },
                source: { type: "string", description: "Authority/journal + year (e.g. 'EAU Guidelines 2025', 'BJUI 2024')" },
                url: { type: "string", description: "URL or DOI of the source" },
            },
            required: ["claim", "source", "url"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "run_critics",
        description:
            "MANDATORY quality gate — call after your drafts are complete (and again after any revision). Runs two independent fresh-context critics over your drafts: Tatiana (adversarial: unsourced clinical claims vs the science ledger, structural gaps, GMC-compliance risk) and Aspasia (five patient personas: readability, tone, anxiety-sensitivity). Fix what they raise with update_draft, then call finish. finish REFUSES until critics have reviewed your latest state.",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "read_view",
        description:
            "Read one of the cockpit's named data views (live GROQ over the GGOMed site). Call this to see existing content before writing — check for duplicate slugs, sibling pages in a category, and current PIF state. Views: editorial-content (all site pages), asset-identity (pathname→id map), pif-ggomed (PIF criteria per page).",
        input_schema: {
            type: "object" as const,
            properties: {
                view: {
                    type: "string",
                    enum: ["editorial-content", "asset-identity", "pif-ggomed"],
                    description: "Which view to read",
                },
            },
            required: ["view"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "get_document",
        description:
            "Fetch one full Sanity document from the GGOMed site project by _id (published or draft). Call this to study an existing page's real field usage before writing a sibling page — copy the field structure of a good example rather than guessing.",
        input_schema: {
            type: "object" as const,
            properties: {
                id: { type: "string", description: "The Sanity document _id" },
            },
            required: ["id"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "create_draft",
        description:
            "Create ONE new draft document in the GGOMed site project. The id is generated server-side under drafts.* — nothing you create is published; JJ reviews and publishes in the Studio. Call once per document. The fields object must follow the schema shapes given in your instructions — study a real sibling document first with get_document.",
        input_schema: {
            type: "object" as const,
            properties: {
                docType: {
                    type: "string",
                    enum: [...ALLOWED_DOC_TYPES],
                    description: "The Sanity _type of the document to create",
                },
                title: { type: "string", description: "Human title (for the run log)" },
                fields: {
                    type: "object",
                    description:
                        "All document fields except _id/_type, exactly as they should land in Sanity (slug as {_type:'slug', current}, references as {_type:'reference', _ref}, portable text as block arrays).",
                    additionalProperties: true,
                },
            },
            required: ["docType", "title", "fields"],
            additionalProperties: false,
        },
    },
    {
        name: "update_draft",
        description:
            "Patch a draft YOU created earlier in this run (set fields). Use to wire references between your own drafts (e.g. point the page at the entity you just created).",
        input_schema: {
            type: "object" as const,
            properties: {
                draftId: { type: "string", description: "A drafts.* id returned by create_draft" },
                set: {
                    type: "object",
                    description: "Fields to set (same shapes as create_draft.fields)",
                    additionalProperties: true,
                },
            },
            required: ["draftId", "set"],
            additionalProperties: false,
        },
    },
    {
        name: "finish",
        description:
            "End the run. Call when every planned draft is created and cross-wired. Summarise what you made and what JJ should check before publishing.",
        input_schema: {
            type: "object" as const,
            properties: {
                summary: { type: "string", description: "What was created + review notes for JJ" },
            },
            required: ["summary"],
            additionalProperties: false,
        },
        strict: true,
    },
];

export interface ToolContext {
    drafts: CreatedDraft[];
    finished: { summary: string } | null;
    /** Berenice's ledger — fresh science behind the prose. */
    science: ScienceEntry[];
    /** True once run_critics has reviewed the CURRENT draft state; any
     *  create/update flips it back to false. finish is hard-gated on it. */
    criticsCleared: boolean;
    /** Injected by run.ts: fresh-context Tatiana + Aspasia calls. */
    runCritics: (
        drafts: CreatedDraft[],
        science: ScienceEntry[]
    ) => Promise<{ tatiana: string; aspasia: string }>;
    /** Injected by run.ts: emit ledger/critic events to the UI stream. */
    onScience?: (entry: ScienceEntry) => void;
    onVerdict?: (critic: "tatiana" | "aspasia", verdict: string) => void;
}

const clip = (s: string, n = 4000) => (s.length > n ? s.slice(0, n) + `… [clipped ${s.length - n} chars]` : s);

/** Execute one tool call. Returns the tool_result content string. */
export async function dispatchTool(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext
): Promise<{ ok: boolean; content: string; summary: string }> {
    switch (name) {
        case "record_science": {
            const entry = {
                claim: String(input.claim),
                source: String(input.source),
                url: String(input.url),
            };
            ctx.science.push(entry);
            ctx.onScience?.(entry);
            return { ok: true, content: `Recorded (#${ctx.science.length})`, summary: `${entry.source}: ${entry.claim.slice(0, 60)}` };
        }
        case "run_critics": {
            if (ctx.drafts.length === 0) {
                return { ok: false, content: "No drafts to review yet — draft first.", summary: "no drafts" };
            }
            const { tatiana, aspasia } = await ctx.runCritics(ctx.drafts, ctx.science);
            ctx.criticsCleared = true;
            ctx.onVerdict?.("tatiana", tatiana);
            ctx.onVerdict?.("aspasia", aspasia);
            return {
                ok: true,
                content: `## TATIANA (adversarial review)\n${tatiana}\n\n## ASPASIA (persona read)\n${aspasia}\n\nFix what matters with update_draft (critics will need to re-run), or call finish if nothing blocking was raised.`,
                summary: "both critics reported",
            };
        }
        case "read_view": {
            const view = String(input.view);
            if (!isViewName(view)) return { ok: false, content: `Unknown view ${view}`, summary: view };
            const data = await VIEW_REGISTRY[view]();
            return {
                ok: true,
                content: clip(JSON.stringify(data)),
                summary: `${view} → ${data.length} rows`,
            };
        }
        case "get_document": {
            const id = String(input.id);
            // Raw perspective for drafts (published client can't see them)
            const reader = id.startsWith("drafts.") ? ggomedRawClient : ggomedClient;
            const doc = await reader.fetch(`*[_id == $id][0]`, { id });
            if (!doc) return { ok: false, content: `No document ${id}`, summary: id };
            return { ok: true, content: clip(JSON.stringify(doc), 12000), summary: id };
        }
        case "create_draft": {
            const docType = String(input.docType);
            const title = String(input.title);
            const fields = (input.fields ?? {}) as Record<string, unknown>;
            if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(docType)) {
                return { ok: false, content: `docType ${docType} not allowed`, summary: docType };
            }
            const draftId = `drafts.cockpit-${randomUUID()}`;
            // Certification stays with JJ's engine — strip it if the model
            // ever tries (defence-in-depth on top of the prompt rule).
            delete fields.showPifTick;
            delete fields.pifTickAssessment;
            // Governance METADATA is the model's to write (JJ's rule:
            // the prohibition covers the tick-boxes, not the metadata).
            // Backstop: merge Berenice's ledger into references if omitted.
            if ((docType === "dedicatedPage" || docType === "blogPost") && ctx.science.length > 0) {
                const gov = (fields.pifTickGovernance ?? { _type: "pifTickGovernance" }) as Record<string, unknown>;
                delete gov.reviewer; // a review attestation is a human act
                if (!Array.isArray(gov.references) || gov.references.length === 0) {
                    gov.references = ctx.science.map((s) => ({
                        _type: "pifReference",
                        _key: randomUUID().slice(0, 8),
                        title: s.claim,
                        url: s.url,
                        source: s.source,
                        verified: false, // JJ verifies at review
                    }));
                }
                fields.pifTickGovernance = gov;
            }
            await createDraft({ _id: draftId, _type: docType, ...fields });
            ctx.drafts.push({ draftId, docType, title });
            ctx.criticsCleared = false; // new content → critics must re-run
            const ledgerNote =
                ctx.science.length === 0
                    ? " NOTE: your science ledger is empty — if this document makes clinical claims, research and record_science FIRST; Tatiana will reject unsourced claims."
                    : "";
            return { ok: true, content: `Created ${draftId}.${ledgerNote}`, summary: `${docType} "${title}" → ${draftId}` };
        }
        case "update_draft": {
            const draftId = String(input.draftId);
            if (!ctx.drafts.some((d) => d.draftId === draftId)) {
                return { ok: false, content: `Refusing: ${draftId} was not created in this run`, summary: draftId };
            }
            await patchDraft(draftId, (input.set ?? {}) as Record<string, unknown>);
            ctx.criticsCleared = false; // content changed → critics must re-run
            return { ok: true, content: `Patched ${draftId}`, summary: draftId };
        }
        case "finish": {
            if (ctx.drafts.length > 0 && !ctx.criticsCleared) {
                return {
                    ok: false,
                    content:
                        "REFUSED: run_critics has not reviewed the current draft state. Call run_critics, address blocking findings, then finish. (This gate is enforced in code.)",
                    summary: "blocked — critics pending",
                };
            }
            ctx.finished = { summary: String(input.summary ?? "") };
            return { ok: true, content: "Run finished.", summary: "finish" };
        }
        default:
            return { ok: false, content: `Unknown tool ${name}`, summary: name };
    }
}

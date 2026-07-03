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
import { ggomedClient } from "../sanity/clients";
import { createDraft, patchDraft } from "../sanity/write-client";
import { ALLOWED_DOC_TYPES } from "./shape";
import type { CreatedDraft } from "./types";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
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
}

const clip = (s: string, n = 4000) => (s.length > n ? s.slice(0, n) + `… [clipped ${s.length - n} chars]` : s);

/** Execute one tool call. Returns the tool_result content string. */
export async function dispatchTool(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext
): Promise<{ ok: boolean; content: string; summary: string }> {
    switch (name) {
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
            const doc = await ggomedClient.fetch(`*[_id == $id][0]`, { id });
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
            await createDraft({ _id: draftId, _type: docType, ...fields });
            ctx.drafts.push({ draftId, docType, title });
            return { ok: true, content: `Created ${draftId}`, summary: `${docType} "${title}" → ${draftId}` };
        }
        case "update_draft": {
            const draftId = String(input.draftId);
            if (!ctx.drafts.some((d) => d.draftId === draftId)) {
                return { ok: false, content: `Refusing: ${draftId} was not created in this run`, summary: draftId };
            }
            await patchDraft(draftId, (input.set ?? {}) as Record<string, unknown>);
            return { ok: true, content: `Patched ${draftId}`, summary: draftId };
        }
        case "finish": {
            ctx.finished = { summary: String(input.summary ?? "") };
            return { ok: true, content: "Run finished.", summary: "finish" };
        }
        default:
            return { ok: false, content: `Unknown tool ${name}`, summary: name };
    }
}

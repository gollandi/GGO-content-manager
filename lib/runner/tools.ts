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
import { getContentCalendar } from "../notion/editorial";
import { htmlToPortableTextWithWarnings } from "../parser/html-to-portable-text";
import { writeCalendarCaption } from "../notion/social-write";
import type { CaptionItem, CreatedDraft, Proposal, ScienceEntry } from "./types";

export type SkillFamily = "A" | "B";

/** Family B tools — Samantha: captions/hashtags on Calendar rows. */
export const FAMILY_B_TOOLS: Anthropic.Tool[] = [
    {
        name: "read_calendar",
        description:
            "Read the Notion Content Calendar rows (title, status, date, content type, existing sync state). Use it to find the posts that need captions for this batch. Publication/scheduling stays with JJ in Notion — you only prepare captions.",
        input_schema: { type: "object" as const, properties: {}, required: [], additionalProperties: false },
        strict: true,
    },
    {
        name: "write_caption",
        description:
            "Write the Caption and Hashtags onto ONE Content Calendar row (LOCKED until JJ approves your proposal). Never touches Status — JJ schedules in Notion. Caption and hashtags must already have appeared in your approved proposal.",
        input_schema: {
            type: "object" as const,
            properties: {
                rowId: { type: "string", description: "The Notion page id of the Calendar row (from read_calendar)" },
                rowTitle: { type: "string", description: "The row's title (for the run log)" },
                platform: { type: "string", description: "Target platform if known (Instagram/Facebook/LinkedIn)" },
                caption: { type: "string" },
                hashtags: { type: "string", description: "Space-separated #hashtags" },
            },
            required: ["rowId", "rowTitle", "caption", "hashtags"],
            additionalProperties: false,
        },
    },
];

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
        name: "present_proposal",
        description:
            "THE REVIEW GATE — present your plan to JJ BEFORE any draft touches Sanity. Include: the full prose proposal in markdown (structure, key messages, the actual draft text or detailed section-by-section content), the deliverables list (every visual asset: svg-infographic = you will build it in-page after approval; illustration/photo = provide a ready generation prompt; canva = layout brief), and the interactive sections you plan (block type + what goes in it). The run PAUSES for JJ's feedback — he may chat, request changes (re-present after changes), or approve. create_draft is LOCKED until he approves.",
        input_schema: {
            type: "object" as const,
            properties: {
                proposalMarkdown: {
                    type: "string",
                    description: "The full proposal: page structure, key messages, draft prose (markdown). This is what JJ reads and edits by chat.",
                },
                deliverables: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            kind: { type: "string", enum: ["svg-infographic", "illustration", "photo", "canva", "video", "other"] },
                            title: { type: "string" },
                            description: { type: "string" },
                            generationPrompt: { type: "string", description: "Ready-to-paste Higgsfield/Canva prompt (required for illustration/photo/canva/video)" },
                            inPage: { type: "boolean", description: "true only for svg-infographic you will build inline" },
                        },
                        required: ["kind", "title", "description", "inPage"],
                        additionalProperties: false,
                    },
                },
                interactiveSections: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            block: { type: "string", description: "e.g. faqInlineBlock, quizBlock, accordionBlock, highlightBlock" },
                            title: { type: "string" },
                            note: { type: "string", description: "What goes in it and why" },
                        },
                        required: ["block", "title", "note"],
                        additionalProperties: false,
                    },
                },
            },
            required: ["proposalMarkdown", "deliverables", "interactiveSections"],
            additionalProperties: false,
        },
    },
    {
        name: "ask_jj",
        description:
            "Pause the run and ask JJ one focused question when his input genuinely changes what you build (clinical judgement call, positioning choice, missing brief detail). Do not use it for things you can decide editorially.",
        input_schema: {
            type: "object" as const,
            properties: {
                question: { type: "string" },
            },
            required: ["question"],
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
        name: "create_draft_from_html",
        description:
            "THE PREFERRED WAY to create page drafts (dedicatedPage/blogPost). Author the page content as parser-ready HTML per the parser-patterns reference (headings, details/summary accordions, data-block sections for quiz/faqInline/highlight/infoBox/ctaBanner/linkCard etc.) — the battle-tested site parser converts it to portable text and reports warnings for anything it had to drop. LOCKED until JJ approves the proposal. Use appendBlocks for raw blocks the parser cannot emit (svgBlock infographics).",
        input_schema: {
            type: "object" as const,
            properties: {
                docType: { type: "string", enum: ["dedicatedPage", "blogPost"] },
                title: { type: "string" },
                contentHtml: { type: "string", description: "Parser-ready HTML for the content field" },
                appendBlocks: {
                    type: "array",
                    description: "Raw portable-text blocks appended AFTER the parsed content (e.g. svgBlock) — each needs _type and _key",
                    items: { type: "object", additionalProperties: true },
                },
                fields: {
                    type: "object",
                    description: "All OTHER document fields (slug, description, seo, refs, governance) — same shapes as create_draft.fields; do NOT put content here.",
                    additionalProperties: true,
                },
            },
            required: ["docType", "title", "contentHtml", "fields"],
            additionalProperties: false,
        },
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
    /** Which tool family this run belongs to (A = Sanity pages, B = social). */
    family: SkillFamily;
    /** Family B output — captions written on Calendar rows this run. */
    captions: CaptionItem[];
    /** JJ approved the proposal — create_draft/write_caption LOCKED until true. */
    proposalApproved: boolean;
    /** The latest presented proposal (persisted for the UI). */
    proposal: Proposal | null;
    /** Set by present_proposal / ask_jj — tells the leg to pause for JJ. */
    pause: "proposal" | "question" | null;
    /** Injected by run.ts: fresh-context Tatiana + Aspasia calls (family-aware). */
    runCritics: (input: {
        family: SkillFamily;
        drafts: CreatedDraft[];
        science: ScienceEntry[];
        captions: CaptionItem[];
    }) => Promise<{ tatiana: string; aspasia: string }>;
    /** Injected by run.ts: emit ledger/critic events to the UI stream. */
    onScience?: (entry: ScienceEntry) => void;
    onVerdict?: (critic: "tatiana" | "aspasia", verdict: string) => void;
}

const clip = (s: string, n = 4000) => (s.length > n ? s.slice(0, n) + `… [clipped ${s.length - n} chars]` : s);

/** Execute one tool call. Returns the tool_result content string. */

/** Shared draft persistence — the create_draft guards live here (both tools). */
async function persistDraft(
    docType: string,
    title: string,
    fields: Record<string, unknown>,
    ctx: ToolContext
): Promise<{ ok: boolean; content: string; summary: string }> {
    if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(docType)) {
        return { ok: false, content: `docType ${docType} not allowed`, summary: docType };
    }
    const draftId = `drafts.cockpit-${randomUUID()}`;
    // Certification stays with JJ's engine — strip it if the model ever
    // tries (defence-in-depth on top of the prompt rule).
    delete fields.showPifTick;
    delete fields.pifTickAssessment;
    // Governance METADATA is the model's to write (JJ's rule: the
    // prohibition covers the tick-boxes, not the metadata).
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

export async function dispatchTool(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext
): Promise<{ ok: boolean; content: string; summary: string }> {
    switch (name) {
        case "present_proposal": {
            ctx.proposal = {
                proposalMarkdown: String(input.proposalMarkdown ?? ""),
                deliverables: (input.deliverables ?? []) as Proposal["deliverables"],
                interactiveSections: (input.interactiveSections ?? []) as Proposal["interactiveSections"],
            };
            ctx.proposalApproved = false; // a (re)presented proposal awaits approval
            ctx.pause = "proposal";
            return {
                ok: true,
                content:
                    "Proposal delivered to JJ. The run is paused: his next message is feedback (revise and re-present) or approval (you will be told explicitly — only then draft).",
                summary: `${ctx.proposal.deliverables.length} deliverables, ${ctx.proposal.interactiveSections.length} interactive sections`,
            };
        }
        case "ask_jj": {
            ctx.pause = "question";
            return { ok: true, content: "Question delivered — the run pauses for JJ's answer.", summary: String(input.question ?? "").slice(0, 80) };
        }
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
            if (ctx.drafts.length === 0 && ctx.captions.length === 0) {
                return { ok: false, content: "Nothing to review yet — draft (or write captions) first.", summary: "nothing to review" };
            }
            const { tatiana, aspasia } = await ctx.runCritics({
                family: ctx.family,
                drafts: ctx.drafts,
                science: ctx.science,
                captions: ctx.captions,
            });
            ctx.criticsCleared = true;
            ctx.onVerdict?.("tatiana", tatiana);
            ctx.onVerdict?.("aspasia", aspasia);
            return {
                ok: true,
                content: `## TATIANA (adversarial review)\n${tatiana}\n\n## ASPASIA (persona read)\n${aspasia}\n\nFix what matters with update_draft (critics will need to re-run), or call finish if nothing blocking was raised.`,
                summary: "both critics reported",
            };
        }
        case "read_calendar": {
            const rows = await getContentCalendar();
            const slim = rows.map((r) => ({
                rowId: r.id,
                title: r.topicTitle,
                status: r.status,
                date: r.date,
                contentType: r.contentType,
                hasSanitySync: !!r.sanitySync,
            }));
            return { ok: true, content: clip(JSON.stringify(slim), 20000), summary: `${rows.length} calendar rows` };
        }
        case "write_caption": {
            if (!ctx.proposalApproved) {
                return {
                    ok: false,
                    content: "LOCKED: JJ has not approved the proposal. present_proposal first. (Enforced in code.)",
                    summary: "blocked — proposal not approved",
                };
            }
            const item: CaptionItem = {
                rowId: String(input.rowId),
                rowTitle: String(input.rowTitle),
                platform: input.platform ? String(input.platform) : null,
                caption: String(input.caption ?? ""),
                hashtags: String(input.hashtags ?? ""),
            };
            await writeCalendarCaption(item.rowId, item.caption, item.hashtags);
            ctx.captions.push(item);
            ctx.criticsCleared = false; // new captions → critics must re-run
            return { ok: true, content: `Caption scritta su "${item.rowTitle}"`, summary: item.rowTitle };
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
        case "create_draft_from_html": {
            if (!ctx.proposalApproved) {
                return {
                    ok: false,
                    content: "LOCKED: JJ has not approved a proposal for the current plan. present_proposal first. (Enforced in code.)",
                    summary: "blocked — proposal not approved",
                };
            }
            const docType = String(input.docType);
            const title = String(input.title);
            const fields = (input.fields ?? {}) as Record<string, unknown>;
            const html = String(input.contentHtml ?? "");
            if (!html.trim()) {
                return { ok: false, content: "contentHtml is empty", summary: "no html" };
            }
            const { blocks, warnings } = htmlToPortableTextWithWarnings(html);
            if (!blocks.length) {
                return { ok: false, content: `Parser produced zero blocks. Warnings: ${JSON.stringify(warnings)}`, summary: "parser: empty" };
            }
            const appendBlocks = Array.isArray(input.appendBlocks) ? (input.appendBlocks as Record<string, unknown>[]) : [];
            fields.content = [...blocks, ...appendBlocks];
            const res = await persistDraft(docType, title, fields, ctx);
            if (res.ok && warnings.length > 0) {
                res.content += `\nPARSER WARNINGS (structure dropped/adjusted — review or fix the HTML and update_draft):\n${warnings.map((w) => `- ${w}`).join("\n")}`;
            }
            return res;
        }
        case "create_draft": {
            if (!ctx.proposalApproved) {
                return {
                    ok: false,
                    content:
                        "LOCKED: JJ has not approved a proposal for the current plan. present_proposal first and wait for his approval. (Enforced in code.)",
                    summary: "blocked — proposal not approved",
                };
            }
            const docType = String(input.docType);
            const title = String(input.title);
            const fields = (input.fields ?? {}) as Record<string, unknown>;
            return persistDraft(docType, title, fields, ctx);
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
            if ((ctx.drafts.length > 0 || ctx.captions.length > 0) && !ctx.criticsCleared) {
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

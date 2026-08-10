import { notion } from "../../notion/client";
import { notionConfig } from "../../config";
import type { ToolSpec } from "../types";

/**
 * The one write Il Citofono may perform: recording a proposal in Content Needs.
 *
 * ## Why this lives in its own file
 *
 * It used to sit in `voices.ts`, beside Ambrogio's three read tools. Nothing
 * about the behaviour was wrong — the write targets Content Needs, never an
 * Ambrogio database, and Ambrogio's toolset deliberately excludes this tool.
 * But `__tests__/ambrogio-no-write.test.ts` tripped, and it was right to.
 *
 * That guard is coarse on purpose: any file naming an Ambrogio accessor must
 * contain no Notion write token at all. It does not trace call graphs, and it
 * should not have to. The property it defends is not merely "no write reaches
 * Ambrogio's registers" — it is that you can establish this by reading ONE
 * file, rather than by following tool arrays and trusting a comment. Once the
 * writer sat next to the accessors, the guarantee survived but its cheap proof
 * did not, and a guarantee that takes an argument to verify is one that erodes
 * quietly.
 *
 * So the write path moved out rather than the test being loosened — which is
 * what the test itself instructs: "do not 'fix' the test; remove the write
 * path." `voices.ts` again holds no write token, and Ambrogio's independence is
 * legible at a glance.
 *
 * Depositing is not approval. A proposal enters as `To do` and JJ triages it
 * like any other need.
 */
export const depositaProposta: ToolSpec = {
    name: "deposita_proposta",
    description:
        "Deposit a written proposal into the Content Needs register (the house's intake). Use ONLY when JJ agrees the idea is worth recording. The proposal enters as 'To do' and JJ triages it like any other need — depositing is not approval.",
    input_schema: {
        type: "object",
        properties: {
            need: { type: "string", description: "The proposal title, one line, concrete" },
            details: { type: "string", description: "The reasoning: what, why, expected effect" }
        },
        required: ["need", "details"]
    },
    run: async (input, ctx) => {
        if (!ctx.isWriter) {
            return { ok: false, error: "JJ's session lacks writer role; the proposal was not recorded." };
        }
        const need = String(input.need ?? "").trim();
        const details = String(input.details ?? "").trim();
        if (!need) return { ok: false, error: "need is required" };
        const page = await notion.pages.create({
            parent: { database_id: notionConfig.dbs.contentNeeds() },
            properties: {
                Need: { title: [{ type: "text", text: { content: need.slice(0, 190) } }] },
                Source: { select: { name: "Internal" } },
                "Action Status": { status: { name: "To do" } },
                Details: {
                    rich_text: [
                        {
                            type: "text",
                            text: {
                                content: `[Proposta di ${ctx.voice}, via citofono] ${details}`.slice(0, 1990)
                            }
                        }
                    ]
                }
            }
        });
        return { ok: true, data: { recorded: true, pageId: page.id } };
    }
};

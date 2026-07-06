/**
 * Ernesto Desk write path — La Soffitta files its improvement proposals
 * where every decision of the house already lands: one Desk row, ALWAYS
 * created Pending. JJ's flip in Notion is the only ratification.
 *
 * DELIBERATELY NARROW (same discipline as social/impact writers):
 *  - create-only (no updates, no status flips — quelli sono di JJ/desk-reader)
 *  - Status hardcoded "Pending", Type hardcoded "plan-proposal"
 *  - body as plain paragraphs (the proposal text)
 * Contract per ernesto docs/notion-databases.md: rows always created
 * Pending; JJ-only Pending→Approved/Rejected.
 */
import { notion } from "./client";
import { notionConfig } from "../config";

export async function createDeskProposal(input: {
    title: string;
    body: string;
}): Promise<string> {
    const paragraphs = input.body
        .split("\n\n")
        .filter((p) => p.trim())
        .slice(0, 90) // Notion caps children per request
        .map((p) => ({
            object: "block" as const,
            type: "paragraph" as const,
            paragraph: {
                rich_text: [{ type: "text" as const, text: { content: p.slice(0, 1990) } }],
            },
        }));
    const page = await notion.pages.create({
        parent: { database_id: notionConfig.dbs.ernestoDesk() },
        properties: {
            Item: { title: [{ type: "text", text: { content: input.title.slice(0, 190) } }] },
            Type: { select: { name: "plan-proposal" } },
            Status: { select: { name: "Pending" } }, // JJ-only flip
            Priority: { select: { name: "Normal" } },
        },
        children: paragraphs,
    });
    return page.id;
}

/**
 * Impact-loop write path — JJ records the success verdict on a Content
 * Needs row (PIF "measuring impact": success defined at intake, outcome
 * verified at review, evidence from the Feedback end of the cycle).
 *
 * DELIBERATELY NARROW: writes ONLY Impact Outcome / Impact Evidence /
 * Impact Review Date, ONLY on Content Needs rows (parent verified).
 * Action Status and the rest of the row stay with their existing owners.
 */
import { notion } from "./client";
import { notionConfig } from "../config";

export class ForbiddenImpactWriteError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = "ForbiddenImpactWriteError";
    }
}

const norm = (id: string) => id.replace(/-/g, "");
export const IMPACT_OUTCOMES = ["Pending", "Achieved", "Partially achieved", "Not achieved"] as const;

export async function recordImpactOutcome(
    pageId: string,
    outcome: (typeof IMPACT_OUTCOMES)[number],
    evidence: string,
    nextReviewDate?: string
): Promise<void> {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const parent = (page as { parent?: { type?: string; database_id?: string } }).parent;
    if (parent?.type !== "database_id" || norm(parent.database_id ?? "") !== norm(notionConfig.dbs.contentNeeds())) {
        throw new ForbiddenImpactWriteError(`Refusing: page ${pageId} is not a Content Needs row`);
    }
    await notion.pages.update({
        page_id: pageId,
        properties: {
            "Impact Outcome": { select: { name: outcome } },
            ...(evidence.trim()
                ? { "Impact Evidence": { rich_text: [{ type: "text", text: { content: evidence.slice(0, 1990) } }] } }
                : {}),
            ...(nextReviewDate ? { "Impact Review Date": { date: { start: nextReviewDate } } } : {}),
        },
    });
}

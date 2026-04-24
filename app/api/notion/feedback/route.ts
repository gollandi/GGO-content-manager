import { NextResponse } from "next/server";
import { getFeedback } from "../../../../lib/notion/services";
import { cached, invalidateCache } from "../../../../lib/cache";
import { requireAuth, requireWriter } from "../../../../lib/auth/api-guard";
import { notion } from "../../../../lib/notion/client";
import { SCHEMA } from "../../../../lib/notion/schema";

/**
 * GET — fetch all stakeholder feedback entries.
 * Requires any authenticated user (viewer OK).
 */
export async function GET() {
    const authResult = await requireAuth();
    if (!authResult.authenticated) return authResult.response;

    try {
        const data = await cached("feedback", getFeedback);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Feedback):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch feedback data" }, { status: 500 });
    }
}

/**
 * POST — create a new feedback entry.
 * Requires editor or admin role.
 *
 * Body: {
 *   feedbackId: string,
 *   feedbackType: "Patient" | "Expert" | "Clinician" | "Public",
 *   feedbackSummary: string,
 *   feedbackDate?: string (ISO),
 *   relatedContentIds?: string[],
 *   actionRequired?: boolean,
 * }
 */
export async function POST(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            feedbackId?: string;
            feedbackType?: "Patient" | "Expert" | "Clinician" | "Public";
            feedbackSummary?: string;
            feedbackDate?: string;
            relatedContentIds?: string[];
            actionRequired?: boolean;
        };

        if (!body.feedbackId || !body.feedbackSummary) {
            return NextResponse.json(
                { error: "feedbackId and feedbackSummary are required" },
                { status: 400 }
            );
        }

        const S = SCHEMA.StakeholderFeedback;
        const properties: Record<string, any> = {
            [S.feedbackId]: {
                title: [{ text: { content: body.feedbackId } }],
            },
            [S.feedbackSummary]: {
                rich_text: [{ text: { content: body.feedbackSummary } }],
            },
            [S.actionStatus]: {
                status: { name: "Not Started" },
            },
            [S.actionRequired]: {
                checkbox: body.actionRequired ?? false,
            },
        };

        if (body.feedbackType) {
            properties[S.feedbackType] = { select: { name: body.feedbackType } };
        }

        if (body.feedbackDate) {
            properties[S.feedbackDate] = { date: { start: body.feedbackDate } };
        }

        if (body.relatedContentIds && body.relatedContentIds.length > 0) {
            properties[S.relatedContent] = {
                relation: body.relatedContentIds.map((id) => ({ id })),
            };
        }

        const response = await notion.pages.create({
            parent: { database_id: SCHEMA.StakeholderFeedback.databaseId },
            properties,
        });

        invalidateCache("feedback");

        return NextResponse.json({ success: true, id: response.id });
    } catch (error: unknown) {
        console.error("Notion Write Error (Feedback):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
    }
}

/**
 * PATCH — update feedback entry (resolve/dismiss, update status).
 * Requires editor or admin role.
 *
 * Body: {
 *   pageId: string,
 *   actionStatus?: "Not Started" | "In Progress" | "Completed",
 *   actionTaken?: string,
 * }
 */
export async function PATCH(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            pageId?: string;
            actionStatus?: "Not Started" | "In Progress" | "Completed";
            actionTaken?: string;
        };

        if (!body.pageId) {
            return NextResponse.json({ error: "pageId is required" }, { status: 400 });
        }

        const S = SCHEMA.StakeholderFeedback;
        const properties: Record<string, any> = {};

        if (body.actionStatus) {
            properties[S.actionStatus] = { status: { name: body.actionStatus } };
        }

        if (body.actionTaken !== undefined) {
            properties[S.actionTaken] = {
                rich_text: [{ text: { content: body.actionTaken } }],
            };
        }

        await notion.pages.update({
            page_id: body.pageId,
            properties,
        });

        invalidateCache("feedback");

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Notion Update Error (Feedback):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
    }
}

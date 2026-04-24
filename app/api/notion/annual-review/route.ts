import { NextResponse } from "next/server";
import { getAnnualReviewLog } from "../../../../lib/notion/services";
import { cached, invalidateCache } from "../../../../lib/cache";
import { requireAuth, requireWriter } from "../../../../lib/auth/api-guard";
import { notion } from "../../../../lib/notion/client";
import { SCHEMA } from "../../../../lib/notion/schema";

/**
 * GET — fetch all Annual Review Log entries (all cycles, all criteria).
 * Any authenticated user may read.
 */
export async function GET() {
    const authResult = await requireAuth();
    if (!authResult.authenticated) return authResult.response;

    try {
        const data = await cached("annual-review", getAnnualReviewLog);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Annual Review):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch annual review data" }, { status: 500 });
    }
}

/**
 * PATCH — update a single Annual Review Log row (sign-off with today's date,
 * toggle Needs Discussion, update Structural Change / Pending carryover).
 * Requires editor or admin role.
 *
 * Body: {
 *   pageId: string,
 *   reviewDate?: string (ISO, defaults to today if signOff=true),
 *   needsDiscussion?: boolean,
 *   structuralChange?: string,
 *   pendingFromPreviousCycle?: string,
 *   entry?: string,
 *   signOff?: boolean,          // convenience: sets reviewDate = today
 * }
 */
export async function PATCH(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            pageId?: string;
            reviewDate?: string;
            needsDiscussion?: boolean;
            structuralChange?: string;
            pendingFromPreviousCycle?: string;
            entry?: string;
            signOff?: boolean;
        };

        if (!body.pageId) {
            return NextResponse.json({ error: "pageId is required" }, { status: 400 });
        }

        const S = SCHEMA.AnnualReviewLog;
        const properties: Record<string, any> = {};

        const effectiveReviewDate =
            body.signOff ? new Date().toISOString().slice(0, 10) : body.reviewDate;

        if (effectiveReviewDate) {
            properties[S.reviewDate] = { date: { start: effectiveReviewDate } };
        }

        if (body.needsDiscussion !== undefined) {
            properties[S.needsDiscussion] = { checkbox: body.needsDiscussion };
        }

        if (body.structuralChange !== undefined) {
            properties[S.structuralChange] = {
                rich_text: [{ text: { content: body.structuralChange } }],
            };
        }

        if (body.pendingFromPreviousCycle !== undefined) {
            properties[S.pendingFromPreviousCycle] = {
                rich_text: [{ text: { content: body.pendingFromPreviousCycle } }],
            };
        }

        if (body.entry !== undefined) {
            properties[S.entry] = {
                title: [{ text: { content: body.entry } }],
            };
        }

        await notion.pages.update({
            page_id: body.pageId,
            properties,
        });

        invalidateCache("annual-review");

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Notion Update Error (Annual Review):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to update annual review entry" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { getContentAssets } from "../../../../lib/notion/services";
import { cached, invalidateCache } from "../../../../lib/cache";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { notion } from "../../../../lib/notion/client";
import { SCHEMA } from "../../../../lib/notion/schema";

export async function GET() {
    try {
        const data = await cached("content", getContentAssets);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Content):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch content data" }, { status: 500 });
    }
}

/**
 * POST — Update review status on a Content Asset page.
 * Requires editor or admin role.
 *
 * Body: { pageId: string, status?: string, lastReviewed?: string }
 */
export async function POST(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            pageId?: string;
            status?: string;
            lastReviewed?: string;
        };

        if (!body.pageId) {
            return NextResponse.json({ error: "pageId is required" }, { status: 400 });
        }

        const S = SCHEMA.ContentMaster;
                const properties: Record<string, any> = {};

        if (body.status) {
            properties[S.status] = {
                select: { name: body.status },
            };
        }

        if (body.lastReviewed) {
            properties[S.lastReviewed] = {
                date: { start: body.lastReviewed },
            };
        }

        await notion.pages.update({
            page_id: body.pageId,
            properties,
        });

        // Invalidate cache so next GET reflects the update
        invalidateCache("content");

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Notion Write Error (Content):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to update content data" }, { status: 500 });
    }
}

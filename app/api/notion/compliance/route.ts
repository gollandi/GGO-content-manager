import { NextResponse } from "next/server";
import { getPifValidations } from "../../../../lib/notion/services";
import { cached, invalidateCache } from "../../../../lib/cache";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { notion } from "../../../../lib/notion/client";
import { SCHEMA } from "../../../../lib/notion/schema";

export async function GET() {
    try {
        const data = await cached("compliance", getPifValidations);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Compliance):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch compliance data" }, { status: 500 });
    }
}

/**
 * POST — Save AI validation result to a PIF Compliance page.
 * Requires editor or admin role.
 *
 * Body: { pageId: string, status: string, automationLog: string }
 */
export async function POST(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            pageId?: string;
            status?: string;
            automationLog?: string;
        };

        if (!body.pageId) {
            return NextResponse.json({ error: "pageId is required" }, { status: 400 });
        }

        const S = SCHEMA.PifValidation;
                const properties: Record<string, any> = {};

        if (body.automationLog) {
            properties[S.automationLog] = {
                rich_text: [{ text: { content: body.automationLog } }],
            };
        }

        if (body.status) {
            properties[S.llmProvisionalResult] = {
                select: { name: body.status },
            };
        }

        await notion.pages.update({
            page_id: body.pageId,
            properties,
        });

        // Invalidate cache so next GET reflects the update
        invalidateCache("compliance");

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Notion Write Error (Compliance):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to update compliance data" }, { status: 500 });
    }
}

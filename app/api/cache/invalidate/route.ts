import { NextResponse } from "next/server";
import { invalidateCache, getCacheStats } from "../../../../lib/cache";

/**
 * POST /api/cache/invalidate
 * Body: { "key": "content" } to invalidate one, or omit to clear all.
 *
 * Call this after updating Notion to force a fresh fetch on next request.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const key = body?.key as string | undefined;

        invalidateCache(key);

        return NextResponse.json({
            success: true,
            invalidated: key || "all",
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/cache/invalidate — returns cache stats (for debugging)
 */
export async function GET() {
    return NextResponse.json({ entries: getCacheStats() });
}

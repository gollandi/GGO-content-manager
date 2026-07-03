import { NextRequest, NextResponse } from "next/server";
import { VIEW_REGISTRY, isViewName } from "../../../../lib/views";
import { requireAuth } from "../../../../lib/auth/api-guard";

/**
 * HTTP surface of the named GROQ view layer (spec §2.2).
 *
 * GET /api/views/<name> — read-only, auth-gated, sanitised errors.
 * The view name is the public contract; out-of-process consumers (the
 * editorial skills, Phase 3) call this instead of holding Sanity tokens.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ view: string }> }
) {
    const authResult = await requireAuth();
    if (!authResult.authenticated) return authResult.response;

    const { view } = await params;

    if (!isViewName(view)) {
        return NextResponse.json(
            {
                error: `Unknown view "${view}"`,
                available: Object.keys(VIEW_REGISTRY),
            },
            { status: 404 }
        );
    }

    try {
        const data = await VIEW_REGISTRY[view]();
        return NextResponse.json(
            { view, count: data.length, data },
            {
                headers: {
                    // Live-ish reads; private because responses are auth-gated
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
                },
            }
        );
    } catch (err) {
        console.error(`[views] "${view}" failed:`, err);
        return NextResponse.json(
            { error: `View "${view}" failed — check server logs` },
            { status: 502 }
        );
    }
}

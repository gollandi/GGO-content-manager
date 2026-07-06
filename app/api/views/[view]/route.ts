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
/**
 * Machine-to-machine access for headless consumers (ernesto's cron/skills):
 * `Authorization: Bearer $COCKPIT_SERVICE_TOKEN`. Env-gated — when the env
 * var is unset there is NO bypass and only the NextAuth session works.
 */
function serviceTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_SERVICE_TOKEN;
    if (!expected) return false;
    return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ view: string }> }
) {
    if (!serviceTokenOk(req)) {
        const authResult = await requireAuth();
        if (!authResult.authenticated) return authResult.response;
    }

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

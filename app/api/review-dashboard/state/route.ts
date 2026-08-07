import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { loadCancelloState } from "../../../../lib/cancello/state";

/**
 * Il Cancello's state, assembled natively — the resident review-dashboard
 * service on :4317 is retired; the cockpit reads Notion, the patch store and
 * Sanity itself. Response shape unchanged.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine-to-machine read access (the media-sync job on the Mac): same
 * env-gated bearer as /api/views. Read-only — decisions stay session-only.
 */
function serviceTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_SERVICE_TOKEN;
    if (!expected) return false;
    return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
    if (!serviceTokenOk(req)) {
        const auth = await requireAuth();
        if (!auth.authenticated) return auth.response;
    }

    try {
        const state = await loadCancelloState({
            refresh: req.nextUrl.searchParams.get("refresh") === "1",
        });
        return NextResponse.json(state);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

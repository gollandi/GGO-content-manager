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

export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

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

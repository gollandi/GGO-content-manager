import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { getHouseState } from "../../../../lib/house/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The state of the house, once. The Sidebar's margin count, the Atrio and
 * the Portineria's pulse all read this — no surface derives its own queue.
 * Read-only: the cockpit observes, it never writes from here.
 */
export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    try {
        return NextResponse.json(await getHouseState({ refresh }));
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

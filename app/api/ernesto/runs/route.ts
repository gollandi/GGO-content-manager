import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { listRuns } from "../../../../lib/runner/store";

/** GET /api/ernesto/runs — run history (persists until archived). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    return NextResponse.json({ runs: listRuns() });
}

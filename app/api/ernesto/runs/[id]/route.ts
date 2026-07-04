import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth/api-guard";
import { loadEvents, loadMeta, runExists } from "../../../../../lib/runner/store";

/** GET /api/ernesto/runs/[id] — meta + full event journal (UI replay). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    const { id } = await params;
    try {
        if (!runExists(id)) {
            return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        return NextResponse.json({ meta: loadMeta(id), events: loadEvents(id) });
    } catch {
        return NextResponse.json({ error: "invalid run id" }, { status: 400 });
    }
}

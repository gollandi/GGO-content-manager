import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../../../../lib/auth/api-guard";
import { loadMeta, runExists, saveMeta } from "../../../../../../lib/runner/store";

/**
 * POST /api/ernesto/runs/[id]/archive — JJ's "published, done" signal.
 * The run leaves the active list; the journal stays on disk.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    const { id } = await params;
    try {
        if (!runExists(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
        const meta = loadMeta(id);
        meta.status = "archived";
        saveMeta(meta);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "invalid run id" }, { status: 400 });
    }
}

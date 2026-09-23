import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { getMorningBrief } from "../../../../lib/notion/brief";

/**
 * GET — the morning brief as Markdown (read model over the Notion page
 * ernesto-agents-house rewrites at 07:00). The Shell never writes it; the
 * only writer stays the morning-brief job.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    try {
        const brief = await getMorningBrief();
        return NextResponse.json(brief);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "brief unavailable" },
            { status: 502 }
        );
    }
}

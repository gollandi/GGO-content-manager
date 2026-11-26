import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { getNatasciaReports } from "../../../../lib/notion/natascia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Natascia's weekly readings, newest first. Read-only; any signed-in role
 * that reaches the route may read it (the middleware fence decides which).
 * A Notion refusal is reported as such, never as an empty list.
 */
export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    try {
        const reports = await getNatasciaReports();
        return NextResponse.json({ reports }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[natascia/weekly]", message);
        const notShared = /could not find database|object_not_found/i.test(message);
        return NextResponse.json(
            { error: notShared ? "Natascia's reports are not shared with the cockpit's Notion integration" : "Could not read Natascia's reports" },
            { status: 502 },
        );
    }
}

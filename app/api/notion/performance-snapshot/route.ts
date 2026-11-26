import { NextResponse } from "next/server";
import { getPerformanceSnapshot } from "../../../../lib/notion/editorial";
import { requireAuth } from "../../../../lib/auth/api-guard";

export async function GET() {
    // The middleware admits any session here; the route re-reads the store so
    // a switched-off collaborator is refused at once.
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    try {
        const data = await getPerformanceSnapshot();
        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error: unknown) {
        console.error(
            "Notion API Error (Performance Snapshot):",
            error instanceof Error ? error.message : error
        );
        return NextResponse.json(
            { error: "Failed to fetch performance snapshot data" },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { getPerformanceSnapshot } from "../../../../lib/notion/editorial";

export async function GET() {
    try {
        const data = await getPerformanceSnapshot();
        return NextResponse.json(data, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
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

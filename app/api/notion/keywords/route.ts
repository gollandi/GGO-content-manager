import { NextResponse } from "next/server";
import { getKeywords } from "../../../../lib/notion/services";
import { cached } from "../../../../lib/cache";

export async function GET() {
    try {
        const data = await cached("keywords", getKeywords);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Keywords):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch keywords data" }, { status: 500 });
    }
}

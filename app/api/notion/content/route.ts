import { NextResponse } from "next/server";
import { getContentAssets } from "../../../../lib/notion/services";
import { cached } from "../../../../lib/cache";

export async function GET() {
    try {
        const data = await cached("content", getContentAssets);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
    } catch (error: any) {
        console.error("Notion API Error (Content):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

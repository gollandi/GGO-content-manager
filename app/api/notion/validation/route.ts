import { NextResponse } from "next/server";
import { getSchemaValidations } from "../../../../lib/notion/services";
import { cached } from "../../../../lib/cache";

export async function GET() {
    try {
        const data = await cached("validation", getSchemaValidations);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Validation):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch validation data" }, { status: 500 });
    }
}

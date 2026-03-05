import { NextResponse } from "next/server";
import { getContentAssets } from "../../../../lib/notion/services";

export async function GET() {
    try {
        const data = await getContentAssets();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Notion API Error (Content):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

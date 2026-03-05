import { NextResponse } from "next/server";
import { getEvidenceSources } from "../../../../lib/notion/services";

export async function GET() {
    try {
        const data = await getEvidenceSources();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Notion API Error (Evidence):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

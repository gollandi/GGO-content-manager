import { NextResponse } from "next/server";
import { getKeywords } from "../../../../lib/notion/services";

export async function GET() {
    try {
        const data = await getKeywords();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

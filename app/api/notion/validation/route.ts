import { NextResponse } from "next/server";
import { getSchemaValidations } from "../../../../lib/notion/services";

export async function GET() {
    try {
        const data = await getSchemaValidations();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Notion API Error (Validation):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

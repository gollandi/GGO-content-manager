import { NextResponse } from "next/server";
import { getPatientJourneys } from "../../../../lib/notion/services";

export async function GET() {
    try {
        const data = await getPatientJourneys();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Notion API Error (Patient Journeys):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

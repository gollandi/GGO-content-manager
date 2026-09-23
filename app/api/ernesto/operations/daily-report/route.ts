import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth/api-guard";
import { getDailyReports } from "../../../../../lib/briefing/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prepared narrative first, with a factual prose fallback; never wait for an LLM. */
export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    try {
        return NextResponse.json(await getDailyReports({ start: req.nextUrl.searchParams.get("prose") !== "0" }),
            { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Il registro delle attività non è disponibile. Non è possibile ricostruire la giornata." }, { status: 502 });
    }
}

import { NextResponse } from "next/server";
import { requireWriter } from "../../../lib/auth/api-guard";
import { runRetro, listRetros } from "../../../lib/retro/run";

/** La Soffitta — POST runs a retrospective; GET lists past reports. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    return NextResponse.json({ retros: listRetros() });
}

export async function POST() {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    try {
        const result = await runRetro();
        return NextResponse.json(result);
    } catch (err) {
        console.error("[retro] failed:", err);
        return NextResponse.json({ error: "Retro failed — check server logs" }, { status: 502 });
    }
}

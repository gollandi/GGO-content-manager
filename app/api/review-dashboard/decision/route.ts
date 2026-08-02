import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../../lib/auth/api-guard";

const REVIEW_DASHBOARD = process.env.REVIEW_DASHBOARD_URL ?? "http://127.0.0.1:4317";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const upstream = await fetch(`${REVIEW_DASHBOARD}/api/decision`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8" },
        });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: `review dashboard unavailable: ${err instanceof Error ? err.message : String(err)}` },
            { status: 502 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";

const REVIEW_DASHBOARD = process.env.REVIEW_DASHBOARD_URL ?? "http://127.0.0.1:4317";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const refresh = req.nextUrl.searchParams.get("refresh") === "1" ? "?refresh=1" : "";
    try {
        const upstream = await fetch(`${REVIEW_DASHBOARD}/api/state${refresh}`, { cache: "no-store" });
        const body = await upstream.text();
        return new NextResponse(body, {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8" },
        });
    } catch (err) {
        return NextResponse.json(
            { error: `review dashboard unavailable: ${err instanceof Error ? err.message : String(err)}` },
            { status: 502 }
        );
    }
}

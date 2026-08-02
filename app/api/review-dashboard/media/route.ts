import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";

const REVIEW_DASHBOARD = process.env.REVIEW_DASHBOARD_URL ?? "http://127.0.0.1:4317";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function proxyReviewMedia(req: NextRequest, kind: "media" | "video") {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const path = req.nextUrl.searchParams.get("path");
    if (!path) return new NextResponse("path required", { status: 400 });

    const headers: HeadersInit = {};
    const range = req.headers.get("range");
    if (range) headers.range = range;

    try {
        const upstream = await fetch(`${REVIEW_DASHBOARD}/${kind}?path=${encodeURIComponent(path)}`, { headers });
        const responseHeaders = new Headers();
        for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
            const value = upstream.headers.get(key);
            if (value) responseHeaders.set(key, value);
        }
        return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch (err) {
        return new NextResponse(`review dashboard unavailable: ${err instanceof Error ? err.message : String(err)}`, { status: 502 });
    }
}

export async function GET(req: NextRequest) {
    return proxyReviewMedia(req, "media");
}

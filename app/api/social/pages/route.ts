import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { cached } from "../../../../lib/cache";
import { getContentAssets } from "../../../../lib/notion/services";
import { toPublicPage } from "../../../../lib/social/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The website registry, read-only and trimmed to what a page's state needs:
 * title, type, state, address, review and change dates. GET only — the
 * owner's /api/notion/content also takes a POST that writes Content Asset
 * Status, and the role fence is per path, so the social role reads here.
 */
export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    try {
        const items = await cached("content", getContentAssets);
        return NextResponse.json(items.map(toPublicPage), { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
        console.error("[social/pages]", err instanceof Error ? err.message : err);
        return NextResponse.json({ error: "Could not read the website registry" }, { status: 502 });
    }
}

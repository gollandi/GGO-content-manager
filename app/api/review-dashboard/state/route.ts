import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { warmBriefings } from "../../../../lib/briefing/warm";
import { getHouseState } from "../../../../lib/house/state";
import {
    CancelloStateTimeoutError, loadCancelloState, loadCancelloStateWithin,
} from "../../../../lib/cancello/state";
import { viewFor } from "../../../../lib/cancello/view";
import type { Role } from "../../../../lib/auth/roles";

/**
 * Il Cancello's state, assembled natively — the resident review-dashboard
 * service on :4317 is retired; the cockpit reads Notion, the patch store and
 * Sanity itself. Response shape unchanged.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine-to-machine read access (the media-sync job on the Mac): same
 * env-gated bearer as /api/views. Read-only — decisions stay session-only.
 */
function serviceTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_SERVICE_TOKEN;
    if (!expected) return false;
    return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
    let role: Role | null = null;
    if (!serviceTokenOk(req)) {
        const auth = await requireAuth();
        if (!auth.authenticated) return auth.response;
        role = auth.role;
    }
    // Warming is the machine's job; a restricted session has no use for it.
    if (role && role !== "admin" && req.nextUrl.searchParams.get("warm") === "1") {
        return NextResponse.json({ error: "Not available for your role" }, { status: 403 });
    }

    try {
        // Same read-only service capability; no decision, approval or publish code.
        // The systemd timer uses this process, sharing its body cache and limiter.
        if (req.nextUrl.searchParams.get("warm") === "1") {
            const started = Date.now();
            const house = await getHouseState({ revalidate: true });
            const cancello = await loadCancelloState();
            const briefings = await warmBriefings();
            return NextResponse.json({ ok: true, briefings, elapsedMs: Date.now() - started,
                cancelloGeneratedAt: cancello.generatedAt, houseGeneratedAt: house.generatedAt,
                warnings: cancello.warnings.length, errors: house.errors.length },
                { headers: { "Cache-Control": "private, no-store" } });
        }
        // An interactive read waits a bounded time: a cold crawl (after a
        // restart, or "Rileggi") takes minutes, and the page must say so
        // instead of hanging.
        const state = await loadCancelloStateWithin(undefined, {
            // A full re-crawl takes minutes against Notion: JJ's (and the
            // machine's) to ask for, not a collaborator's to repeat.
            refresh: req.nextUrl.searchParams.get("refresh") === "1" && (role === null || role === "admin"),
        });
        return NextResponse.json(viewFor(state, role), { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
        if (err instanceof CancelloStateTimeoutError) {
            return NextResponse.json(
                { error: err.message, code: "CANCELLO_STATE_TIMEOUT" },
                { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "30" } }
            );
        }
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { BoardInputError, applySync, pendingEvents } from "../../../../lib/board/store";

/**
 * The Mac bridge's door (ernesto-agents-house, `operations/board-cockpit-bridge.js`).
 *
 * GET  → JJ's writes still waiting for the house writer.
 * POST → { acks, events }: the house's verdicts, then the whole board.
 *
 * Service token only: no browser session reaches this route.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

function serviceTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_SERVICE_TOKEN;
    if (!expected) return false;
    return req.headers.get("authorization") === `Bearer ${expected}`;
}

const denied = () => NextResponse.json({ error: "Service token required" }, { status: 401 });

export async function GET(req: NextRequest) {
    if (!serviceTokenOk(req)) return denied();
    try {
        const events = pendingEvents();
        return NextResponse.json({ count: events.length, events }, { headers: noStore });
    } catch (err) {
        console.error("[board/sync]", err);
        return NextResponse.json({ error: "Could not read the outbox" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!serviceTokenOk(req)) return denied();
    let payload: Parameters<typeof applySync>[0];
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    try {
        return NextResponse.json(await applySync(payload), { headers: noStore });
    } catch (err) {
        if (err instanceof BoardInputError) {
            return NextResponse.json({ error: err.message }, { status: 422 });
        }
        console.error("[board/sync]", err);
        return NextResponse.json({ error: "Could not store the board" }, { status: 500 });
    }
}

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sweepOrderedRows } from "../../../../lib/cancello/buffer-send";
import { invalidateCancelloCache } from "../../../../lib/cancello/state";

/**
 * The Buffer sweep — sends the rows JJ ordered once the house has staged
 * them (lib/cancello/buffer-send.ts). Its only caller is the VPS timer
 * `ggo-buffer-sweep.timer`, with a bearer that exists for this route alone:
 * the read-only COCKPIT_SERVICE_TOKEN is deliberately not accepted, so a
 * reader of snapshots can never cause a publication.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sweepTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_BUFFER_SWEEP_TOKEN;
    if (!expected) return false;
    const given = req.headers.get("authorization") ?? "";
    const a = Buffer.from(given);
    const b = Buffer.from(`Bearer ${expected}`);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
    if (!sweepTokenOk(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    try {
        const result = await sweepOrderedRows();
        if (result.rows.length > 0) invalidateCancelloCache();
        // Operational metadata only: ids and outcomes, never captions.
        return NextResponse.json({
            ok: true,
            considered: result.considered,
            rows: result.rows.map((r) => ({
                rowId: r.rowId,
                outcome: r.outcome,
                calendarStatus: r.calendarStatus ?? null,
                posts: r.posts.map((p) => ({ sanityId: p.sanityId, outcome: p.outcome, detail: p.detail ?? null })),
            })),
        });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

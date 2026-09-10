import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "../../../../lib/auth/api-guard";
import { lift, summary } from "../../../../lib/llm/guard";

/**
 * Il Guardiano — what the cockpit has spent on the model today, what it has
 * refused and why. GET shows the ledger; POST lifts a block (JJ only):
 *   { fp }       one blocked request body
 *   { origin }   one paused room or job
 *   { all: true } everything
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    return NextResponse.json(summary(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    const body = (await req.json().catch(() => ({}))) as { fp?: unknown; origin?: unknown; all?: unknown };
    const target = {
        fp: typeof body.fp === "string" && /^[a-f0-9]{64}$/.test(body.fp) ? body.fp : undefined,
        origin: typeof body.origin === "string" && body.origin.length <= 64 ? body.origin : undefined,
        all: body.all === true,
    };
    if (!target.fp && !target.origin && !target.all) return NextResponse.json({ error: "Nothing to lift: pass fp, origin or all." }, { status: 400 });
    lift(target);
    return NextResponse.json({ ok: true, ...summary() });
}

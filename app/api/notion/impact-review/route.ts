import { NextResponse } from "next/server";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { recordImpactOutcome, IMPACT_OUTCOMES } from "../../../../lib/notion/impact-write";
import { invalidateCache } from "../../../../lib/cache";

/** POST — JJ's impact verdict on a Content Needs row. */
export async function POST(req: Request) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: { id?: string; outcome?: string; evidence?: string; nextReviewDate?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body.id || !(IMPACT_OUTCOMES as readonly string[]).includes(body.outcome ?? "")) {
        return NextResponse.json({ error: `id and outcome (${IMPACT_OUTCOMES.join("/")}) required` }, { status: 400 });
    }
    try {
        await recordImpactOutcome(
            body.id,
            body.outcome as (typeof IMPACT_OUTCOMES)[number],
            body.evidence ?? "",
            body.nextReviewDate
        );
        invalidateCache("editorial:content-needs");
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[impact-review] failed:", err);
        return NextResponse.json({ error: "Write failed — check server logs" }, { status: 502 });
    }
}

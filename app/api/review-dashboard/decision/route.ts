import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { applyCancelloDecision, type DecisionInput } from "../../../../lib/cancello/decision";

/**
 * JJ's acts on the register, applied natively. The status flip happens only
 * in direct response to the click that reaches this route; heavy pipeline
 * legs (Sanity staging, Buffer publish, patch apply) are delegated to the
 * house's own jobs and CLIs — see lib/cancello/decision.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: DecisionInput;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const result = await applyCancelloDecision(body);
        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

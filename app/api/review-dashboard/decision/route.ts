import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import {
    applyCancelloDecision, DecisionForbiddenError, type DecisionInput,
} from "../../../../lib/cancello/decision";

/**
 * Acts on the register, applied natively. The status flip happens only in
 * direct response to the click that reaches this route; heavy pipeline legs
 * (Sanity staging, Buffer publish, patch apply) are delegated to the house's
 * own jobs and CLIs — see lib/cancello/decision.ts.
 *
 * Who may do what is decided per role, target and act in
 * lib/auth/permissions.ts and enforced inside applyCancelloDecision, so the
 * route only establishes who is acting.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    let body: DecisionInput;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const result = await applyCancelloDecision(body, { email: auth.email, name: auth.name, role: auth.role });
        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        const forbidden = err instanceof DecisionForbiddenError;
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: forbidden ? 403 : 500 }
        );
    }
}

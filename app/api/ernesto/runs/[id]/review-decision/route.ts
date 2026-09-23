import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../../../../lib/auth/api-guard";
import {
    runExists,
    upsertReviewDecision,
    type ReviewDecisionValue,
    type ReviewTargetType,
} from "../../../../../../lib/runner/store";

const TARGET_TYPES = new Set<ReviewTargetType>(["proposal", "deliverable", "draft", "caption"]);
const DECISIONS = new Set<ReviewDecisionValue>(["approved", "rejected", "needs-changes"]);

interface DecisionBody {
    targetType?: string;
    targetId?: string;
    decision?: string;
    note?: string | null;
}

/** POST /api/ernesto/runs/[id]/review-decision — JJ's local approval gate. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    const { id } = await params;

    let body: DecisionBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!runExists(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!body.targetType || !TARGET_TYPES.has(body.targetType as ReviewTargetType)) {
        return NextResponse.json({ error: "invalid targetType" }, { status: 400 });
    }
    if (!body.targetId?.trim()) {
        return NextResponse.json({ error: "targetId required" }, { status: 400 });
    }
    if (!body.decision || !DECISIONS.has(body.decision as ReviewDecisionValue)) {
        return NextResponse.json({ error: "invalid decision" }, { status: 400 });
    }

    const reviewDecision = upsertReviewDecision(id, {
        targetType: body.targetType as ReviewTargetType,
        targetId: body.targetId.trim(),
        decision: body.decision as ReviewDecisionValue,
        note: body.note ?? null,
    });

    return NextResponse.json({ ok: true, decision: reviewDecision });
}

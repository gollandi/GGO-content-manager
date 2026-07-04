import { NextRequest } from "next/server";
import { requireWriter } from "../../../../../../lib/auth/api-guard";
import { streamLeg } from "../../../stream";

/**
 * POST /api/ernesto/runs/[id]/reply — continue the conversation.
 * Body: { message?: string, approve?: boolean } — approve unlocks drafting.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    const { id } = await params;
    let body: { message?: string; approve?: boolean };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }
    if (!body.approve && !body.message?.trim()) {
        return new Response(JSON.stringify({ error: "message or approve required" }), { status: 400 });
    }
    return streamLeg(req, { runId: id, userMessage: body.message, approve: body.approve });
}

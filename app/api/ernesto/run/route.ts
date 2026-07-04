import { NextRequest } from "next/server";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { streamLeg } from "../stream";

/** POST /api/ernesto/run — start a NEW conversational run (leg 1). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: { skill?: string; brief?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }
    if (!body?.skill || !body?.brief?.trim()) {
        return new Response(JSON.stringify({ error: "skill and brief are required" }), { status: 400 });
    }
    return streamLeg(req, { skill: body.skill, brief: body.brief });
}

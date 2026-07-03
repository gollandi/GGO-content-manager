import { NextRequest } from "next/server";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { runSkill } from "../../../../lib/runner/run";
import type { RunEvent, RunRequest } from "../../../../lib/runner/types";

/**
 * POST /api/ernesto/run — start a generative run, stream NDJSON events.
 * Writer role required (viewers observe; they don't generate drafts).
 * Runs can take minutes — Node runtime, no static optimisation.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: RunRequest;
    try {
        body = (await req.json()) as RunRequest;
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }
    if (!body?.skill || !body?.brief?.trim()) {
        return new Response(JSON.stringify({ error: "skill and brief are required" }), { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const emit = (event: RunEvent) => {
                try {
                    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                } catch {
                    /* client went away — the abort signal handles shutdown */
                }
            };
            try {
                await runSkill(body, emit, req.signal);
            } finally {
                try { controller.close(); } catch { /* already closed */ }
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    });
}

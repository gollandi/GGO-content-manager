import { NextRequest } from "next/server";
import { runLeg, type LegInput } from "../../../lib/runner/run";
import type { RunEvent } from "../../../lib/runner/types";

/** Shared NDJSON streaming wrapper around one runner leg. */
export function streamLeg(req: NextRequest, input: LegInput): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const emit = (event: RunEvent) => {
                try {
                    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                } catch {
                    /* client gone — the journal still records everything */
                }
            };
            try {
                await runLeg(input, emit, req.signal);
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

import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../lib/auth/api-guard";
import { runRetro, listRetros } from "../../../lib/retro/run";
import { runOfficina } from "../../../lib/retro/officina";

/**
 * La Soffitta — GET lists reports; POST runs:
 *   {mode:"retro"}    → proposte sole (report + Desk row)
 *   {mode:"officina"} → pipeline autonoma fino alla PR (stream NDJSON del log)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET() {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    return NextResponse.json({ retros: listRetros() });
}

export async function POST(req: NextRequest) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;
    let mode = "retro";
    try {
        mode = ((await req.json()) as { mode?: string }).mode ?? "retro";
    } catch {
        /* body vuoto = retro */
    }

    if (mode === "officina") {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const emit = (line: string) => {
                    try {
                        controller.enqueue(encoder.encode(JSON.stringify({ line }) + "\n"));
                    } catch { /* client gone */ }
                };
                try {
                    const result = await runOfficina(emit);
                    controller.enqueue(encoder.encode(JSON.stringify({ done: result }) + "\n"));
                } catch (err) {
                    controller.enqueue(
                        encoder.encode(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + "\n")
                    );
                } finally {
                    try { controller.close(); } catch { /* closed */ }
                }
            },
        });
        return new Response(stream, {
            headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
        });
    }

    try {
        const result = await runRetro();
        return NextResponse.json(result);
    } catch (err) {
        console.error("[retro] failed:", err);
        return NextResponse.json({ error: "Retro failed — check server logs" }, { status: 502 });
    }
}

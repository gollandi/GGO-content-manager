import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth/api-guard";
import { BoardInputError, readBoard, submit, type ComposeInput } from "../../../lib/board/store";

/**
 * La Bacheca — JJ reads and writes the house board (HOUSE-0010).
 *
 * Admin only: the whole board, open and closed, is for JJ (and Ambrogio, on
 * the Mac). Every write is posted as `jj` and queued for the Mac bridge,
 * which runs it through the house writer; nothing here touches git, Sanity,
 * Notion or any publish gate.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    try {
        return NextResponse.json(readBoard(), { headers: noStore });
    } catch (err) {
        console.error("[board]", err);
        return NextResponse.json({ error: "Could not read the board" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    let input: ComposeInput;
    try {
        input = (await req.json()) as ComposeInput;
    } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    try {
        const result = await submit(input);
        return NextResponse.json(result, { status: result.queued ? 201 : 200, headers: noStore });
    } catch (err) {
        if (err instanceof BoardInputError) {
            return NextResponse.json({ error: err.message }, { status: 422 });
        }
        console.error("[board]", err);
        return NextResponse.json({ error: "Could not queue the message" }, { status: 500 });
    }
}

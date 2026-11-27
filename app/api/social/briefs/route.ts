import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { BoardInputError, collaboratorRecipients, readBoardFor, submit } from "../../../../lib/board/store";
import { BriefError, toCompose, type BriefRequest } from "../../../../lib/social/briefs";

/**
 * Briefs — a collaborator speaks to the house on its board, under their own
 * name (HOUSE-0010; JJ, 2026-11-26). GET: the threads that are theirs. POST:
 * open a brief or a strategy, reply, or close their own thread. Every write
 * is checked by the house's own writer, here and again on the Mac.
 *
 * The owner writes from La Bacheca (/api/board), not here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

async function who(): Promise<{ error: NextResponse } | { handle: string }> {
    const auth = await requireAuth();
    if (!auth.authenticated) return { error: auth.response };
    if (auth.role !== "social") return { error: NextResponse.json({ error: "Briefs are for collaborators; JJ writes from La Bacheca." }, { status: 403 }) };
    if (!auth.houseHandle) {
        return { error: NextResponse.json({ error: "I brief non sono ancora attivi per te: JJ ti assegna un nome sulla bacheca della casa, in Impostazioni." }, { status: 409 }) };
    }
    return { handle: auth.houseHandle };
}

export async function GET() {
    const me = await who();
    if ("error" in me) return me.error;
    try {
        return NextResponse.json({ handle: me.handle, recipients: await collaboratorRecipients(), board: readBoardFor(me.handle) }, { headers: noStore });
    } catch (err) {
        console.error("[social/briefs]", err);
        return NextResponse.json({ error: "Non riesco a leggere la bacheca" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const me = await who();
    if ("error" in me) return me.error;
    let body: BriefRequest;
    try {
        body = (await req.json()) as BriefRequest;
    } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (!["open", "reply", "close"].includes(body?.mode)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    try {
        if (body.mode !== "open") {
            const mine = readBoardFor(me.handle).threads.some((t) => t.threadId === body.threadId);
            if (!mine) return NextResponse.json({ error: "Questa conversazione non è tua." }, { status: 403 });
        }
        const input = toCompose(body, me.handle, await collaboratorRecipients(), new Date());
        const result = await submit(input, new Date(), me.handle);
        return NextResponse.json(result, { status: result.queued ? 201 : 200, headers: noStore });
    } catch (err) {
        if (err instanceof BriefError || err instanceof BoardInputError) {
            return NextResponse.json({ error: err.message }, { status: 422 });
        }
        console.error("[social/briefs]", err);
        return NextResponse.json({ error: "Non sono riuscito a mettere in coda il brief" }, { status: 500 });
    }
}

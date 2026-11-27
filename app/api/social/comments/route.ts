import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { mayPublish } from "../../../../lib/auth/permissions";
import { approveReply, CommentActError, listComments, markManual, markReady, suggestReply } from "../../../../lib/social/comments-notion";
import { collaboratorTitle } from "../../../../lib/board/store";

/**
 * Comments — the YouTube comments waiting for a reply, with Samantha's draft.
 * GET: the rows. POST {rowId, act, text?, draftSeen?}:
 *  - suggest: a collaborator's (or JJ's) suggested reply or direction;
 *    Samantha drafts again through Aspasia; the row stays Pending.
 *  - ready: "I checked draft n"; a mark for JJ, nothing else.
 *  - manual: the comment carries health details: handled by hand, never put
 *    before an agent again (contract clause 10.4); flagged for JJ.
 *  - approve: posting the reply in public — only the roles
 *    PUBLISH_AUTHORITY["comment-reply"] names (JJ alone today).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const SPEAKERS = new Set(["admin", "social"]);

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!SPEAKERS.has(auth.role)) return NextResponse.json({ error: "Not available for your role" }, { status: 403 });
    try {
        const { rows, unreadable } = await listComments();
        return NextResponse.json({ rows, unreadable, mayApprove: mayPublish(auth.role, "comment-reply") }, { headers: noStore });
    } catch (err) {
        console.error("[social/comments]", (err as Error).message);
        return NextResponse.json({ error: "Non riesco a leggere i commenti" }, { status: 502 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!SPEAKERS.has(auth.role)) return NextResponse.json({ error: "Not available for your role" }, { status: 403 });
    let body: { rowId?: unknown; act?: unknown; text?: unknown; draftSeen?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (typeof body.rowId !== "string" || !body.rowId) return NextResponse.json({ error: "rowId is required" }, { status: 400 });
    const title = auth.houseHandle ? await collaboratorTitle(auth.houseHandle) : null;
    const actor = { label: auth.role === "admin" ? "JJ" : title ? `${auth.name}, ${title}` : auth.name };
    const draftSeen = Number(body.draftSeen);
    try {
        switch (body.act) {
            case "suggest": {
                if (typeof body.text !== "string") return NextResponse.json({ error: "text is required" }, { status: 400 });
                const { k } = await suggestReply(body.rowId, actor, body.text);
                return NextResponse.json({ ok: true, suggestion: k }, { headers: noStore });
            }
            case "manual":
                await markManual(body.rowId, actor);
                return NextResponse.json({ ok: true }, { headers: noStore });
            case "ready":
                if (!Number.isInteger(draftSeen)) return NextResponse.json({ error: "draftSeen is required" }, { status: 400 });
                await markReady(body.rowId, actor, draftSeen);
                return NextResponse.json({ ok: true }, { headers: noStore });
            case "approve":
                if (!mayPublish(auth.role, "comment-reply")) {
                    return NextResponse.json({ error: "Posting a reply in public is JJ's decision." }, { status: 403 });
                }
                if (!Number.isInteger(draftSeen)) return NextResponse.json({ error: "draftSeen is required" }, { status: 400 });
                await approveReply(body.rowId, actor, draftSeen);
                return NextResponse.json({ ok: true, status: "Approved" }, { headers: noStore });
            default:
                return NextResponse.json({ error: "Unknown act" }, { status: 400 });
        }
    } catch (err) {
        if (err instanceof CommentActError || /Prima scrivi la risposta|Tieni il suggerimento/.test((err as Error).message)) {
            return NextResponse.json({ error: (err as Error).message }, { status: 422 });
        }
        console.error("[social/comments]", (err as Error).message);
        return NextResponse.json({ error: "Non sono riuscito a salvare" }, { status: 502 });
    }
}

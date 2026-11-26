import { NextRequest, NextResponse } from "next/server";
import { describeInvite } from "../../../../lib/auth/users";
import { viewFor } from "../../../../lib/contracts/store";

/**
 * The agreement an invitation leads to, read before any password exists.
 * POST {token}: the one-time token is the credential (as for redeem); it
 * travels in the body, never the URL. Open in the middleware, like redeem.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(req: NextRequest) {
    let body: { token?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
    }
    const invite = describeInvite(typeof body.token === "string" ? body.token : "");
    if (!invite) return NextResponse.json({ error: "This link is not valid any more. Ask for a new one." }, { status: 404, headers: noStore });
    try {
        const view = viewFor(invite.email);
        if (!view) return NextResponse.json({ error: "Your agreement is still being prepared. GGO Med will send you a new link when it is ready.", code: "CONTRACT_UNASSIGNED" }, { status: 409, headers: noStore });
        return NextResponse.json({ view }, { headers: noStore });
    } catch (err) {
        console.error("[auth-invite/contract]", (err as Error).message);
        return NextResponse.json({ error: "The agreement could not be opened. GGO Med has been told; try again later." }, { status: 503, headers: noStore });
    }
}

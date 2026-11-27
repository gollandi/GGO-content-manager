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
    if (!invite) return NextResponse.json({ error: "Questo link non è più valido. Chiedine uno nuovo." }, { status: 404, headers: noStore });
    try {
        const view = viewFor(invite.email);
        if (!view) return NextResponse.json({ error: "Il tuo accordo è ancora in preparazione. GGO Med ti manderà un nuovo link quando è pronto.", code: "CONTRACT_UNASSIGNED" }, { status: 409, headers: noStore });
        return NextResponse.json({ view }, { headers: noStore });
    } catch (err) {
        console.error("[auth-invite/contract]", (err as Error).message);
        return NextResponse.json({ error: "Non riesco ad aprire l'accordo. GGO Med è stata avvisata; riprova più tardi." }, { status: 503, headers: noStore });
    }
}

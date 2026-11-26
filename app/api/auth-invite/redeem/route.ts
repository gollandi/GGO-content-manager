import { NextRequest, NextResponse } from "next/server";
import { describeInvite, MIN_PASSWORD_LENGTH, redeemInvite } from "../../../../lib/auth/users";

/**
 * The invitation, from the invitee's side. Reached without a session (the
 * middleware exempts this path); the one-time token is the credential.
 *
 *   POST {token}            → {email, name} if the link is still valid
 *   POST {token, password}  → sets the password and spends the link
 *
 * The token arrives in the body, never the URL, so it stays out of logs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(req: NextRequest) {
    let body: { token?: unknown; password?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
    }
    const token = typeof body.token === "string" ? body.token : "";
    try {
        if (body.password === undefined) {
            const invite = describeInvite(token);
            if (!invite) {
                return NextResponse.json({ error: "This link is not valid any more. Ask for a new one." }, { status: 404, headers: noStore });
            }
            return NextResponse.json({ ...invite, minPasswordLength: MIN_PASSWORD_LENGTH }, { headers: noStore });
        }
        if (typeof body.password !== "string") {
            return NextResponse.json({ error: "A password is required." }, { status: 400, headers: noStore });
        }
        const user = await redeemInvite(token, body.password);
        return NextResponse.json({ ok: true, email: user.email }, { headers: noStore });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400, headers: noStore });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { describeInvite, findUser, MIN_PASSWORD_LENGTH, redeemInvite, validatePassword } from "../../../../lib/auth/users";
import { clientIp } from "../../../../lib/auth/credentials";
import { acceptContract, type AcceptanceInput } from "../../../../lib/contracts/accept";
import { ContractError, userMessage } from "../../../../lib/contracts/contract";

/**
 * The invitation, from the invitee's side. Reached without a session (the
 * middleware exempts this path); the one-time token is the credential.
 *
 *   POST {token}                        → {email, name} if the link is still valid
 *   POST {token, password, acceptance}  → records the signed agreement, then
 *                                         sets the password and spends the link
 *
 * No password without the agreement: access must not start before it is
 * accepted (the contract's gate 2). The record is written first; if setting
 * the password then fails, the signature stands and the link can be used again.
 *
 * The token arrives in the body, never the URL, so it stays out of logs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(req: NextRequest) {
    let body: { token?: unknown; password?: unknown; acceptance?: unknown };
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
        const invite = describeInvite(token);
        if (!invite) {
            return NextResponse.json({ error: "This link is not valid any more. Ask for a new one." }, { status: 404, headers: noStore });
        }
        // A password that would be refused is refused before anything is signed.
        const problem = validatePassword(body.password);
        if (problem) return NextResponse.json({ error: problem }, { status: 400, headers: noStore });
        const stored = findUser(invite.email);
        await acceptContract(body.acceptance as AcceptanceInput, {
            email: invite.email,
            storeName: invite.name,
            method: "invitation",
            // An id for the link, not the link: a hash of the stored hash.
            inviteTokenId: stored?.invite ? createHash("sha256").update(stored.invite.tokenHash).digest("hex").slice(0, 16) : null,
            ip: clientIp(req),
            userAgent: req.headers.get("user-agent") ?? "",
        });
        const user = await redeemInvite(token, body.password);
        return NextResponse.json({ ok: true, email: user.email }, { headers: noStore });
    } catch (err) {
        if (err instanceof ContractError) {
            if (!err.userFacing) console.error("[contract]", err.message);
            return NextResponse.json({ error: userMessage(err), code: "CONTRACT" }, { status: 422, headers: noStore });
        }
        const message = (err as Error).message;
        // The user store's own refusals are written for the invitee; anything
        // else stays in the server log (it can quote a file).
        if (/password|link|not valid/i.test(message) && !/[{}\/]/.test(message)) return NextResponse.json({ error: message }, { status: 400, headers: noStore });
        console.error("[auth-invite/redeem]", message);
        return NextResponse.json({ error: "Something went wrong on our side. Nothing was changed; try again later." }, { status: 500, headers: noStore });
    }
}

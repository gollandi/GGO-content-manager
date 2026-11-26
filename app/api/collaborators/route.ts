import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth/api-guard";
import { inviteUser, listUsers } from "../../../lib/auth/users";
import { isAssignableRole } from "../../../lib/auth/roles";

/**
 * Collaborators — JJ's list of the people he lets into the cockpit.
 *
 *   GET   the list (never a hash or a token)
 *   POST  {email, name, role} → a one-time invitation link, valid 72 hours.
 *         The same call on an existing collaborator issues a fresh link
 *         (a password reset); the current password works until it is used.
 *
 * The link carries the token in its #fragment, so it never reaches a
 * server log or a Referer header.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    try {
        return NextResponse.json({ users: listUsers() }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    let body: { email?: unknown; name?: unknown; role?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.email !== "string" || typeof body.name !== "string" || !isAssignableRole(body.role)) {
        return NextResponse.json({ error: "email, name and a valid role are required" }, { status: 400 });
    }
    try {
        const { user, token, expiresAt } = await inviteUser({
            email: body.email, name: body.name, role: body.role, by: auth.email,
        });
        const base = (process.env.AUTH_URL || req.nextUrl.origin).replace(/\/$/, "");
        return NextResponse.json(
            { user, link: `${base}/invito#${token}`, expiresAt },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}

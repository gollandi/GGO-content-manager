import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/api-guard";
import { setHouseHandle } from "../../../../lib/auth/users";
import { houseCollaborators } from "../../../../lib/board/store";

/**
 * POST {email, handle: string | null} — the owner gives a collaborator their
 * name on the house board (or takes it away). Only names on the house's own
 * collaborator roster are accepted.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    return NextResponse.json({ handles: await houseCollaborators() });
}

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    let body: { email?: unknown; handle?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.email !== "string" || !(typeof body.handle === "string" || body.handle === null)) {
        return NextResponse.json({ error: "email and handle (string or null) are required" }, { status: 400 });
    }
    try {
        const user = await setHouseHandle(body.email, body.handle, await houseCollaborators());
        return NextResponse.json({ user });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/api-guard";
import { setDisabled } from "../../../../lib/auth/users";

/**
 * POST {email, disabled: boolean} — switch a collaborator's access off or
 * back on. Takes effect on the next request (every guarded route re-reads
 * the store). Nothing is deleted: a disabled collaborator keeps the record
 * and its history.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    let body: { email?: unknown; disabled?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.email !== "string" || typeof body.disabled !== "boolean") {
        return NextResponse.json({ error: "email and disabled (boolean) are required" }, { status: 400 });
    }
    try {
        const user = await setDisabled(body.email, body.disabled);
        return NextResponse.json({ user });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/api-guard";
import { clientIp } from "../../../../lib/auth/credentials";
import { countersign } from "../../../../lib/contracts/accept";
import { ContractError } from "../../../../lib/contracts/contract";

/** POST {email, contractSha256, typedName, confirm: true} — JJ signs for GGO Med Ltd the version the contractor signed. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    let body: { email?: unknown; contractSha256?: unknown; typedName?: unknown; confirm?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (typeof body.email !== "string" || typeof body.contractSha256 !== "string" || typeof body.typedName !== "string" || body.confirm !== true) {
        return NextResponse.json({ error: "email, contractSha256, typedName and confirm are required" }, { status: 400 });
    }
    try {
        const r = await countersign(body.email, body.contractSha256, body.typedName, { email: auth.email, name: auth.name, ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? "" });
        return NextResponse.json({ ok: true, acceptedAt: r.accepted_at_utc });
    } catch (err) {
        if (err instanceof ContractError) return NextResponse.json({ error: err.message }, { status: 422 });
        throw err;
    }
}

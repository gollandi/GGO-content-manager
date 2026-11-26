import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth/api-guard";
import { clientIp } from "../../../lib/auth/credentials";
import { acceptContract, type AcceptanceInput } from "../../../lib/contracts/accept";
import { ContractError } from "../../../lib/contracts/contract";
import { contractStanding } from "../../../lib/contracts/store";

/**
 * The signed-in collaborator's agreement: the welcome page reads it here,
 * and signs it here when it was not signed with the invitation (a link
 * redeemed before the onboarding existed, or a new version). The only route
 * a collaborator reaches before signing, with /api/contract/signed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
    const auth = await requireAuth({ contract: "pending-ok" });
    if (!auth.authenticated) return auth.response;
    if (auth.role === "admin") return NextResponse.json({ kind: "owner" }, { headers: noStore });
    try {
        const s = contractStanding(auth.email);
        if (s.kind === "accepted") {
            return NextResponse.json({ kind: "accepted", version: s.record.contract_version, acceptedAt: s.record.accepted_at_utc, sha256: s.record.contract_sha256, countersigned: s.countersigned }, { headers: noStore });
        }
        return NextResponse.json(s, { headers: noStore });
    } catch (err) {
        console.error("[onboarding]", (err as Error).message);
        return NextResponse.json({ error: "The agreement could not be opened. GGO Med has been told; try again later." }, { status: 503, headers: noStore });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth({ contract: "pending-ok" });
    if (!auth.authenticated) return auth.response;
    if (auth.role === "admin") return NextResponse.json({ error: "JJ countersigns in Settings." }, { status: 403 });
    let body: { acceptance?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    try {
        const record = await acceptContract(body.acceptance as AcceptanceInput, {
            email: auth.email, storeName: auth.name, method: "session", inviteTokenId: null,
            ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? "",
        });
        return NextResponse.json({ ok: true, version: record.contract_version, acceptedAt: record.accepted_at_utc }, { headers: noStore });
    } catch (err) {
        if (err instanceof ContractError) return NextResponse.json({ error: err.message }, { status: 422 });
        console.error("[onboarding]", (err as Error).message);
        return NextResponse.json({ error: "Could not record your signature. Nothing was signed; try again." }, { status: 500 });
    }
}

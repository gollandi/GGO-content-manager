import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/api-guard";
import { integrityProblem, readRecords } from "../../../../lib/contracts/store";

/** JJ's view of every signature: who, which version, when, from where, and whether the chain verifies. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    let raw;
    try { raw = readRecords(); } catch (err) {
        return NextResponse.json({ records: [], chainBrokenAt: (err as Error).message }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const records = raw.map((r) => ({
        record_id: r.record_id, contract_id: r.contract_id, contract_version: r.contract_version, contract_sha256: r.contract_sha256,
        signatory_role: r.signatory_role, signatory_name_typed: r.signatory_name_typed, signatory_email: r.signatory_email,
        countersigns: r.countersigns ?? null, accepted_at_utc: r.accepted_at_utc, ip_address: r.ip_address, method: r.auth_evidence.method,
    }));
    return NextResponse.json({ records, chainBrokenAt: integrityProblem(raw) }, { headers: { "Cache-Control": "private, no-store" } });
}

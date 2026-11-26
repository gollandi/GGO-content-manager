import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { readRecords, signedCopy } from "../../../../lib/contracts/store";

/**
 * Download a signed agreement: the exact text accepted, then the signature
 * page. A collaborator gets their own; JJ any (?email=). Markdown, so it opens
 * anywhere and prints to PDF from the browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const auth = await requireAuth({ contract: "pending-ok" });
    if (!auth.authenticated) return auth.response;
    const asked = req.nextUrl.searchParams.get("email");
    const email = (auth.role === "admin" && asked ? asked : auth.email).trim().toLowerCase();
    if (auth.role !== "admin" && asked && asked.trim().toLowerCase() !== email) {
        return NextResponse.json({ error: "Not yours" }, { status: 403 });
    }
    const mine = readRecords().filter((r) => r.signatory_role === "contractor" && r.signatory_email === email).at(-1);
    if (!mine) return NextResponse.json({ error: "No signed agreement yet" }, { status: 404 });
    const body = signedCopy(email, mine.contract_sha256);
    return new NextResponse(body, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${mine.contract_id}-v${mine.contract_version}-signed.md"`,
            "Cache-Control": "private, no-store",
        },
    });
}

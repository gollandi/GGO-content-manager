import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { logDownload, readRecords, signedCopyData } from "../../../../lib/contracts/store";
import { renderSignedPdf } from "../../../../lib/contracts/pdf";
import { clientIp } from "../../../../lib/auth/credentials";

/**
 * Download a signed agreement as a GGO Med PDF: the exact text accepted, laid
 * out in the brand, then the signature page from the records. A collaborator
 * gets their own; JJ any (?email=). The text's hash is printed on every page
 * and the exact text is attached inside the PDF (lib/contracts/pdf.ts).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const auth = await requireAuth({ contract: "pending-ok" });
    if (!auth.authenticated) return auth.response;
    const asked = req.nextUrl.searchParams.get("email");
    const email = (auth.role === "admin" && asked ? asked : auth.email).trim().toLowerCase();
    if (auth.role !== "admin" && asked && asked.trim().toLowerCase() !== email) {
        return NextResponse.json({ error: "Non è tuo" }, { status: 403 });
    }
    let mine, body: Buffer;
    try {
        mine = readRecords().filter((r) => r.signatory_role === "contractor" && r.signatory_email === email).at(-1);
        if (!mine) return NextResponse.json({ error: "Non c'è ancora un accordo firmato" }, { status: 404 });
        body = await renderSignedPdf(signedCopyData(email, mine.contract_sha256));
    } catch (err) {
        console.error("[contract/signed]", (err as Error).message);
        return NextResponse.json({ error: "Non sono riuscito a preparare la copia firmata." }, { status: 503 });
    }
    logDownload({ by: auth.email.trim().toLowerCase(), contractor: email, contract_sha256: mine.contract_sha256, at: new Date().toISOString(), ip: clientIp(req) });
    return new NextResponse(new Uint8Array(body), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${mine.contract_id}-v${mine.contract_version}-signed.pdf"`,
            "Cache-Control": "private, no-store",
        },
    });
}

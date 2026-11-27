import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth/api-guard";
import { mayReadLibrary, readDocument } from "../../../../../lib/library/store";

/**
 * One document from the library (lib/library/store.ts), for the people who
 * work on GGO Med's content: the owner, editors and the social media manager,
 * once their agreement stands. Not the viewer role, which is what an address
 * the cockpit does not know is given. Read-only.
 *
 * The HTML guide is a self-contained page with its own inline script, served
 * on the cockpit's origin, so it runs with that origin's storage (which is
 * how its checklist remembers). The policy below stops it loading or sending
 * anything over the network and being framed; it does not stop a link. That
 * is enough only because the file is placed on the server by its owner and
 * never comes from a request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENT_POLICY = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data:",
    "font-src data:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
].join("; ");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ doc: string }> }) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!mayReadLibrary(auth.role)) return NextResponse.json({ error: "Not available for your role" }, { status: 403 });
    const { doc } = await params;
    let read;
    try {
        read = readDocument(doc);
    } catch (err) {
        console.error("[social/library]", (err as Error).message);
        return NextResponse.json({ error: "The document could not be read." }, { status: 503 });
    }
    if (read.kind === "unknown") return NextResponse.json({ error: "No such document" }, { status: 404 });
    if (read.kind === "missing") return NextResponse.json({ error: "This document is not on the server yet." }, { status: 404 });
    return new NextResponse(new Uint8Array(read.body), {
        headers: {
            "Content-Type": read.document.contentType,
            "Content-Disposition": `${read.document.disposition}; filename="${read.document.file}"`,
            "Content-Security-Policy": DOCUMENT_POLICY,
            "Cache-Control": "private, no-store",
        },
    });
}

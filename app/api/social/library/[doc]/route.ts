import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth/api-guard";
import { readDocument } from "../../../../../lib/library/store";

/**
 * One document from the library (lib/library/store.ts), for anyone signed in
 * whose agreement stands. Read-only. The HTML guide is a self-contained page
 * with its own inline script, served on the cockpit's origin: the policy
 * below lets it run and keep its checklist, and lets it reach nothing.
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

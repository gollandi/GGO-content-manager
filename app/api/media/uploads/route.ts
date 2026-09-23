import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWriter } from "../../../../lib/auth/api-guard";
import { createUpload, listInbox, MediaInboxError } from "../../../../lib/media/inbox";

/**
 * Il Carico — open an upload, or read what is already in the inbox.
 *
 * POST declares intent (name, kind, size) and gets back an id; the bytes
 * follow as chunks on /api/media/uploads/<id>. Ingest only: nothing here
 * writes to Sanity or Notion, and no publish gate is touched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Family C worker may poll the inbox headlessly, as the views do. */
function serviceTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_SERVICE_TOKEN;
    if (!expected) return false;
    return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
    if (!serviceTokenOk(req)) {
        const auth = await requireAuth();
        if (!auth.authenticated) return auth.response;
    }

    try {
        const uploads = await listInbox();
        return NextResponse.json(
            { count: uploads.length, uploads },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err) {
        return fail(err, "Could not read the inbox");
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: { filename?: string; kind?: string; note?: string; size?: number };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        const manifest = await createUpload({
            filename: body.filename ?? "",
            kind: body.kind ?? "altro",
            note: body.note,
            declaredBytes: Number(body.size),
            operator: auth.email,
        });
        return NextResponse.json({ ok: true, upload: manifest }, { status: 201 });
    } catch (err) {
        return fail(err, "Could not open the upload");
    }
}

function fail(err: unknown, fallback: string): NextResponse {
    if (err instanceof MediaInboxError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[media/uploads]", err);
    return NextResponse.json({ error: fallback }, { status: 500 });
}

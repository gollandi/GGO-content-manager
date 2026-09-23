import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../../../lib/auth/api-guard";
import {
    abortUpload,
    completeUpload,
    MediaInboxError,
    readManifest,
    writeChunk,
} from "../../../../../lib/media/inbox";

/**
 * Il Carico — the body of one upload.
 *
 *   PUT    ?index=N   deposit a chunk (idempotent by index — a phone that
 *                     drops signal mid-chunk resends it and stays correct)
 *   POST              assemble the chunks and hand the file to the worker
 *   GET               progress, so a resumed page knows where it stopped
 *   DELETE            abandon and reclaim the staging directory
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;
    try {
        const manifest = await readManifest(id);
        if (!manifest) return NextResponse.json({ error: "Unknown upload" }, { status: 404 });
        return NextResponse.json({ upload: manifest });
    } catch (err) {
        return fail(err, "Could not read the upload");
    }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;
    const index = Number(req.nextUrl.searchParams.get("index"));

    try {
        const body = new Uint8Array(await req.arrayBuffer());
        const manifest = await writeChunk(id, index, body);
        return NextResponse.json({
            ok: true,
            receivedBytes: manifest.receivedBytes,
            declaredBytes: manifest.declaredBytes,
        });
    } catch (err) {
        return fail(err, "Could not store the chunk");
    }
}

export async function POST(_req: NextRequest, { params }: Ctx) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;
    try {
        const manifest = await completeUpload(id);
        return NextResponse.json({ ok: true, upload: manifest });
    } catch (err) {
        return fail(err, "Could not assemble the upload");
    }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;
    try {
        await abortUpload(id);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return fail(err, "Could not abandon the upload");
    }
}

function fail(err: unknown, fallback: string): NextResponse {
    if (err instanceof MediaInboxError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[media/uploads/:id]", err);
    return NextResponse.json({ error: fallback }, { status: 500 });
}

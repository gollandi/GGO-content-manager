import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { requireAuth } from "../../../../lib/auth/api-guard";
import {
    IMAGE_EXTS, IMAGE_MIME, VIDEO_EXTS, VIDEO_MIME, isPathWithinRoots,
} from "../../../../lib/cancello/paths";

/**
 * Local media for Il Cancello, served natively — images inline, videos with
 * Range support so the browser can seek. Path-guarded to JJ's own media
 * trees (~/GGOMed, ~/Movies); nothing else is readable through this route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toWebStream(stream: fs.ReadStream): ReadableStream {
    return Readable.toWeb(stream) as ReadableStream;
}

export async function serveLocalMedia(req: NextRequest): Promise<NextResponse> {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const p = req.nextUrl.searchParams.get("path");
    if (!p) return new NextResponse("path required", { status: 400 });
    if (!isPathWithinRoots(p)) return new NextResponse("forbidden", { status: 403 });

    let stat: fs.Stats;
    try {
        stat = fs.statSync(p);
    } catch {
        return new NextResponse("not found", { status: 404 });
    }

    const ext = path.extname(p).toLowerCase();

    if (IMAGE_EXTS.has(ext)) {
        return new NextResponse(toWebStream(fs.createReadStream(p)), {
            status: 200,
            headers: { "content-type": IMAGE_MIME[ext], "content-length": String(stat.size) },
        });
    }

    if (!VIDEO_EXTS.has(ext)) return new NextResponse("unsupported", { status: 415 });
    const type = VIDEO_MIME[ext] || "application/octet-stream";

    const range = req.headers.get("range");
    if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start > end || end >= stat.size) {
            return new NextResponse(null, {
                status: 416,
                headers: { "content-range": `bytes */${stat.size}` },
            });
        }
        return new NextResponse(toWebStream(fs.createReadStream(p, { start, end })), {
            status: 206,
            headers: {
                "content-range": `bytes ${start}-${end}/${stat.size}`,
                "accept-ranges": "bytes",
                "content-length": String(end - start + 1),
                "content-type": type,
            },
        });
    }

    return new NextResponse(toWebStream(fs.createReadStream(p)), {
        status: 200,
        headers: {
            "content-length": String(stat.size),
            "content-type": type,
            "accept-ranges": "bytes",
        },
    });
}

export async function GET(req: NextRequest) {
    return serveLocalMedia(req);
}

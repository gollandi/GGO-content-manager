import { NextRequest } from "next/server";
import { serveLocalMedia } from "../media/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    return serveLocalMedia(req);
}

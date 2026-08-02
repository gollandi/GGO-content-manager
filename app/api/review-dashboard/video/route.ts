import { NextRequest } from "next/server";
import { proxyReviewMedia } from "../media/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    return proxyReviewMedia(req, "video");
}

import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { loadPipelineHealth } from "../../../../lib/pipeline/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  return NextResponse.json(await loadPipelineHealth(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import {
  getAgentsActivityLog,
  getErnestoDesk,
  getMediaAssets,
} from "../../../../lib/notion/editorial";
import { settle } from "../../../../lib/settle";

/**
 * Read model for the operations wall. The records remain owned by Notion and
 * Ernesto's house; this endpoint only distributes their current state.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const [activity, media, desk] = await Promise.all([
    settle(getAgentsActivityLog),
    settle(getMediaAssets),
    settle(getErnestoDesk),
  ]);

  return NextResponse.json({
    activity: activity.data ?? [],
    media: media.data ?? [],
    desk: desk.data ?? [],
    errors: [activity.error, media.error, desk.error].filter(Boolean),
    generatedAt: new Date().toISOString(),
  });
}

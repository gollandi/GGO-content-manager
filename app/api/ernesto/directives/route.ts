import { NextRequest, NextResponse } from "next/server";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { invalidateCache } from "../../../../lib/cache";
import {
  createDeskDirective,
  DIRECTIVE_TYPES,
  type DirectiveType,
} from "../../../../lib/notion/directive-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIORITIES = ["Urgent", "Normal", "Low"] as const;

export async function POST(req: NextRequest) {
  const auth = await requireWriter();
  if (!auth.authenticated) return auth.response;

  let body: {
    title?: string;
    instruction?: string;
    agent?: string;
    type?: DirectiveType;
    priority?: (typeof PRIORITIES)[number];
    mediaAssetIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.instruction?.trim() || !body.agent?.trim()) {
    return NextResponse.json(
      { error: "title, instruction and agent are required" },
      { status: 400 }
    );
  }
  if (
    !body.type ||
    !DIRECTIVE_TYPES.includes(body.type) ||
    !body.priority ||
    !PRIORITIES.includes(body.priority)
  ) {
    return NextResponse.json({ error: "Invalid directive type or priority" }, { status: 400 });
  }
  if (
    body.mediaAssetIds &&
    (!Array.isArray(body.mediaAssetIds) || body.mediaAssetIds.some((id) => typeof id !== "string"))
  ) {
    return NextResponse.json({ error: "mediaAssetIds must be an array of ids" }, { status: 400 });
  }

  try {
    const rowId = await createDeskDirective({
      title: body.title,
      instruction: body.instruction,
      agent: body.agent,
      type: body.type,
      priority: body.priority,
      mediaAssetIds: body.mediaAssetIds,
    });
    invalidateCache("editorial:desk");
    return NextResponse.json({ rowId, status: "Pending" }, { status: 201 });
  } catch (err) {
    console.error("[ernesto/directives] failed", err);
    return NextResponse.json({ error: "Unable to file directive" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { notion } from "../../../../lib/notion/client";
import { notionConfig } from "../../../../lib/config";
import { requireWriter } from "../../../../lib/auth/api-guard";
import { invalidateCache } from "../../../../lib/cache";

/**
 * POST — record a patient/clinical need (il primum movens del ciclo
 * contenuti). Creates a Content Needs row exactly as Berenice's
 * content-needs-writer does: Need (title), Source (select), Details,
 * Action Status = "To do".
 */
export async function POST(req: Request) {
    const auth = await requireWriter();
    if (!auth.authenticated) return auth.response;

    let body: { need?: string; source?: string; details?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const need = body.need?.trim();
    if (!need) return NextResponse.json({ error: "need is required" }, { status: 400 });
    const SOURCES = ["Search", "Patient", "Clinical", "Internal", "Compliance"];
    const source = SOURCES.includes(body.source ?? "") ? body.source! : "Patient";

    try {
        const page = await notion.pages.create({
            parent: { database_id: notionConfig.dbs.contentNeeds() },
            properties: {
                Need: { title: [{ type: "text", text: { content: need.slice(0, 190) } }] },
                Source: { select: { name: source } },
                "Action Status": { status: { name: "To do" } },
                ...(body.details?.trim()
                    ? { Details: { rich_text: [{ type: "text", text: { content: body.details.slice(0, 1990) } }] } }
                    : {}),
            },
        });
        invalidateCache("editorial:content-needs");
        return NextResponse.json({ ok: true, id: page.id });
    } catch (err) {
        console.error("[content-needs] create failed:", err);
        return NextResponse.json({ error: "Notion create failed — check server logs" }, { status: 502 });
    }
}

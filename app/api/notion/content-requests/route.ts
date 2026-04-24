import { NextResponse } from "next/server";
import { getContentRequests } from "../../../../lib/notion/services";
import { cached, invalidateCache } from "../../../../lib/cache";
import { requireAuth, requireWriter } from "../../../../lib/auth/api-guard";
import { notion } from "../../../../lib/notion/client";
import { SCHEMA } from "../../../../lib/notion/schema";

/**
 * GET — fetch all content requests.
 * Any authenticated user may read.
 */
export async function GET() {
    const authResult = await requireAuth();
    if (!authResult.authenticated) return authResult.response;

    try {
        const data = await cached("content-requests", getContentRequests);
        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
        });
    } catch (error: unknown) {
        console.error("Notion API Error (Content Requests):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to fetch content requests" }, { status: 500 });
    }
}

/**
 * POST — create a new content request.
 * Requires editor or admin role.
 */
export async function POST(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            requestTitle?: string;
            requestSource?: "Patient" | "Clinician" | "Analytics" | "Team";
            priority?: "High" | "Medium" | "Low";
            formatRequested?: "Blog" | "Video" | "Guide" | "Infographic";
            targetAudience?: ("Patient" | "Caregiver" | "Healthcare Professional")[];
            whyNeeded?: string;
            dueDate?: string;
        };

        if (!body.requestTitle) {
            return NextResponse.json({ error: "requestTitle is required" }, { status: 400 });
        }

        const S = SCHEMA.ContentRequests;
        const properties: Record<string, any> = {
            [S.requestTitle]: {
                title: [{ text: { content: body.requestTitle } }],
            },
            [S.status]: {
                status: { name: "Not Started" },
            },
            [S.requestDate]: {
                date: { start: new Date().toISOString().slice(0, 10) },
            },
        };

        if (body.requestSource) {
            properties[S.requestSource] = { select: { name: body.requestSource } };
        }
        if (body.priority) {
            properties[S.priority] = { select: { name: body.priority } };
        }
        if (body.formatRequested) {
            properties[S.formatRequested] = { select: { name: body.formatRequested } };
        }
        if (body.targetAudience && body.targetAudience.length > 0) {
            properties[S.targetAudience] = {
                multi_select: body.targetAudience.map((name) => ({ name })),
            };
        }
        if (body.whyNeeded) {
            properties[S.whyNeeded] = {
                rich_text: [{ text: { content: body.whyNeeded } }],
            };
        }
        if (body.dueDate) {
            properties[S.dueDate] = { date: { start: body.dueDate } };
        }

        const response = await notion.pages.create({
            parent: { database_id: SCHEMA.ContentRequests.databaseId },
            properties,
        });

        invalidateCache("content-requests");

        return NextResponse.json({ success: true, id: response.id });
    } catch (error: unknown) {
        console.error("Notion Write Error (Content Requests):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to create content request" }, { status: 500 });
    }
}

/**
 * PATCH — update status (Kanban move), assignee, due date, or other fields.
 * Requires editor or admin role.
 */
export async function PATCH(req: Request) {
    const authResult = await requireWriter();
    if (!authResult.authenticated) return authResult.response;

    try {
        const body = await req.json() as {
            pageId?: string;
            status?: "Not Started" | "Planning" | "Creating" | "Review" | "Published";
            priority?: "High" | "Medium" | "Low";
            dueDate?: string;
        };

        if (!body.pageId) {
            return NextResponse.json({ error: "pageId is required" }, { status: 400 });
        }

        const S = SCHEMA.ContentRequests;
        const properties: Record<string, any> = {};

        if (body.status) {
            properties[S.status] = { status: { name: body.status } };
        }
        if (body.priority) {
            properties[S.priority] = { select: { name: body.priority } };
        }
        if (body.dueDate !== undefined) {
            properties[S.dueDate] = body.dueDate
                ? { date: { start: body.dueDate } }
                : { date: null };
        }

        await notion.pages.update({
            page_id: body.pageId,
            properties,
        });

        invalidateCache("content-requests");

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Notion Update Error (Content Requests):", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Failed to update content request" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { listJobs } from "../../../../lib/media/jobs";
import { listInbox } from "../../../../lib/media/inbox";

/**
 * Il Carico — what the worker made of the material.
 *
 * Read-only: the cockpit observes the worker's output, it does not drive
 * it (the worker is a systemd timer on the VPS). No Sanity, no Notion, no
 * publish gate — JJ still reviews everything through Il Cancello.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same headless contract as the views and the inbox listing. */
function serviceTokenOk(req: NextRequest): boolean {
    const expected = process.env.COCKPIT_SERVICE_TOKEN;
    if (!expected) return false;
    return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
    let onlyFor: string | null = null;
    if (!serviceTokenOk(req)) {
        const auth = await requireAuth();
        if (!auth.authenticated) return auth.response;
        if (auth.role === "social") onlyFor = auth.email.toLowerCase();
    }

    try {
        let jobs = await listJobs();
        // The social media manager sees what the worker made of their own
        // uploads only (a job carries its upload's id).
        if (onlyFor) {
            const mine = new Set((await listInbox()).filter((u) => u.operator?.toLowerCase() === onlyFor).map((u) => u.id));
            jobs = jobs.filter((job) => mine.has(job.id));
        }
        return NextResponse.json(
            { count: jobs.length, jobs },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err) {
        console.error("[media/jobs]", err);
        return NextResponse.json({ error: "Could not read the worker output" }, { status: 500 });
    }
}

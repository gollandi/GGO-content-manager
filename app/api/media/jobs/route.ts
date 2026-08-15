import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { listJobs } from "../../../../lib/media/jobs";

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
    if (!serviceTokenOk(req)) {
        const auth = await requireAuth();
        if (!auth.authenticated) return auth.response;
    }

    try {
        const jobs = await listJobs();
        return NextResponse.json(
            { count: jobs.length, jobs },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err) {
        console.error("[media/jobs]", err);
        return NextResponse.json({ error: "Could not read the worker output" }, { status: 500 });
    }
}

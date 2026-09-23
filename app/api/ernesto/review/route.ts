import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { draftEssence } from "../../../../lib/portable-text/preview";
import { listRuns, loadReviewDecisions } from "../../../../lib/runner/store";
import { ggomedRawClient } from "../../../../lib/sanity/clients";

type DraftDoc = Record<string, unknown> & { _id: string };

/** GET /api/ernesto/review — all runs plus JJ's local gate decisions. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const baseRuns = listRuns();
    const draftIds = Array.from(new Set(baseRuns.flatMap((run) => run.drafts.map((draft) => draft.draftId))));
    const draftPreviews: Record<string, string> = {};
    if (draftIds.length > 0) {
        try {
            const docs = (await ggomedRawClient.fetch(`*[_id in $ids]`, { ids: draftIds })) as DraftDoc[];
            for (const doc of docs) draftPreviews[doc._id] = draftEssence(doc, 9000);
        } catch {
            /* Review still works without Sanity draft previews. */
        }
    }

    const runs = baseRuns.map((run) => ({
        ...run,
        reviewDecisions: loadReviewDecisions(run.runId),
    }));

    return NextResponse.json({ runs, draftPreviews });
}

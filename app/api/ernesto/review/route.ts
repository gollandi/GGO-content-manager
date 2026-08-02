import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { listRuns, loadReviewDecisions } from "../../../../lib/runner/store";
import { ggomedRawClient } from "../../../../lib/sanity/clients";

type DraftDoc = Record<string, unknown> & { _id: string };

function portableText(blocks: unknown): string {
    if (!Array.isArray(blocks)) return "";
    return blocks
        .map((block) => {
            const b = block as Record<string, unknown>;
            if (b._type === "block") {
                const children = (b.children as { text?: string }[] | undefined) ?? [];
                const prefix = b.style && b.style !== "normal" ? `[${String(b.style)}] ` : "";
                return prefix + children.map((child) => child.text ?? "").join("");
            }
            if (b._type === "accordionBlock") return `[accordion] ${String(b.title ?? "")}`;
            if (b._type === "highlightBlock" || b._type === "infoBoxBlock") return `[${String(b._type)}] ${String(b.title ?? "")}`;
            if (b._type === "quizBlock") return `[quiz] ${String(b.question ?? "")}`;
            if (b._type === "svgBlock") return `[svg] ${String(b.caption ?? "")}`;
            if (b._type === "ctaBannerBlock") return `[cta] ${String(b.title ?? "")}`;
            return `[${String(b._type ?? "block")}]`;
        })
        .filter(Boolean)
        .join("\n");
}

function draftPreview(doc: DraftDoc): string {
    const refs = ((doc.pifTickGovernance as Record<string, unknown> | undefined)?.references as Record<string, unknown>[] | undefined) ?? [];
    return [
        `## ${String(doc._type ?? "document")}: ${String(doc.title ?? doc.name ?? doc.question ?? "(untitled)")}`,
        doc.slug ? `slug: ${JSON.stringify(doc.slug)}` : "",
        doc.description ? `description: ${String(doc.description)}` : "",
        doc.answer ? `answer: ${String(doc.answer)}` : "",
        portableText(doc.content).slice(0, 9000),
        refs.length ? `references: ${refs.length}` : "references: none",
    ]
        .filter(Boolean)
        .join("\n");
}

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
            for (const doc of docs) draftPreviews[doc._id] = draftPreview(doc);
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

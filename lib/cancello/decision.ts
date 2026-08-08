/**
 * Il Cancello's acts, applied natively — the port of `applyDecision` from
 * ernesto-agents-house tools/review-dashboard/server.js.
 *
 * Governance is unchanged: a status flip happens ONLY in direct response to
 * JJ's click on the register. The state machine values are copied verbatim
 * from the house's core/publish-state.js (CALENDAR_DECISION_FLIPS) — the
 * house remains the owner of the lifecycle; this module is the conduit for
 * JJ's hand.
 *
 * Two deliberate departures from the old resident server:
 *  - Sanity staging after a calendar approve is NOT re-implemented here. The
 *    house's 06:35/06:40 crons are the idempotent staging/publish leg; when
 *    JJ asks for an immediate post, we kickstart those same jobs via
 *    launchd (`publishNow`) instead of duplicating their logic.
 *  - Website patch application runs the house's own CLI one-shot
 *    (operations/website-patch.js <id> --apply) — single source of truth.
 */
import { notion } from "../notion/client";
import { notionConfig } from "../config";
import { findPatchForAsset } from "./patches";
import { kickstartJob, runHouseScript } from "./house";
import { invalidateCancelloCache } from "./state";

export type Decision = "approve" | "modify" | "reject" | "done";
export type Target = "desk" | "calendar" | "website";

// Verbatim from the house's core/publish-state.js — approve is publish.
// `done` is JJ's broom: work already carried out elsewhere (a draft he
// published in Studio, a request that lapsed) — the row closes and stops
// haunting the register. Desk only; unproduced calendar work is
// rescheduled, never archived.
const STATUS_MAPS: Record<"desk" | "calendar", Partial<Record<Decision, string>>> = {
    desk: { approve: "Approved", reject: "Rejected", modify: "Pending", done: "Done" },
    calendar: { approve: "Approved", modify: "Draft", reject: "Blocked" },
};
const COMMENT_PROP: Record<"desk" | "calendar", string> = {
    desk: "Correction",
    calendar: "Notes",
};

export interface DecisionInput {
    rowId: string;
    decision: Decision;
    comment?: string;
    target?: Target;
    /** Calendar only: JJ edited the proposed publish date before sealing. */
    date?: string;
    /** Calendar approve only: kickstart the staging + publish jobs now. */
    publishNow?: boolean;
}

export interface DecisionResult {
    rowId: string;
    status: string;
    [key: string]: unknown;
}

const rich = (content: string) => ({ rich_text: [{ text: { content } }] });

async function createDeskRow(input: {
    title: string; type: string; priority: string; body: string; status?: string;
}): Promise<{ rowId: string }> {
    const paragraphs = input.body
        .split("\n")
        .filter((p) => p.trim())
        .slice(0, 90)
        .map((p) => ({
            object: "block" as const,
            type: "paragraph" as const,
            paragraph: { rich_text: [{ type: "text" as const, text: { content: p.slice(0, 1990) } }] },
        }));
    const page = await notion.pages.create({
        parent: { database_id: notionConfig.dbs.ernestoDesk() },
        properties: {
            Item: { title: [{ type: "text", text: { content: input.title.slice(0, 190) } }] },
            Type: { select: { name: input.type } },
            Status: { select: { name: input.status ?? "Pending" } },
            Priority: { select: { name: input.priority } },
        },
        children: paragraphs,
    });
    return { rowId: page.id };
}

export async function applyCancelloDecision(input: DecisionInput): Promise<DecisionResult> {
    const { rowId, decision, comment, target = "desk" } = input;
    if (!rowId) throw new Error("rowId is required");
    try {
        if (target === "website") return await applyWebsiteDecision(input);

        const map = STATUS_MAPS[target];
        if (!map) throw new Error(`unknown target: ${target}`);
        const status = map[decision];
        if (!status) throw new Error(`unknown decision: ${decision}`);

        const properties: Record<string, unknown> = { Status: { select: { name: status } } };
        if (typeof comment === "string" && comment.trim()) {
            properties[COMMENT_PROP[target]] = rich(comment.trim().slice(0, 1900));
        }
        // JJ may correct the proposed publish date in the same act as the seal.
        if (target === "calendar" && typeof input.date === "string" && input.date.trim()) {
            properties.Date = { date: { start: input.date.trim() } };
        }
        await notion.pages.update({ page_id: rowId, properties: properties as never });

        // Approve is publish (Level E.1). The idempotent staging/publish crons
        // remain the pipeline; `publishNow` runs those same jobs immediately.
        if (target === "calendar" && decision === "approve" && input.publishNow) {
            const sync = await kickstartJob("co.uk.ggomed.agents-house.notion-to-sanity-sync");
            const publish = await kickstartJob("co.uk.ggomed.agents-house.social-approved-publish");
            return {
                rowId,
                status,
                publishNow: true,
                kicked: { sync: sync.ok, publish: publish.ok },
                kickError: sync.error ?? publish.error ?? null,
            };
        }
        return { rowId, status };
    } finally {
        invalidateCancelloCache();
    }
}

/* ── Website: patches and work orders ────────────────────────────────── */

async function applyWebsiteDecision({ rowId, decision, comment }: DecisionInput): Promise<DecisionResult> {
    if (decision !== "approve" && decision !== "modify") {
        throw new Error("website rows support approve (apply/commission the patch) or modify (rework order with your note)");
    }
    const page = await notion.pages.retrieve({ page_id: rowId }) as {
        properties: Record<string, { type: string; title?: { plain_text: string }[]; url?: string | null }>;
    };
    const titleProp = Object.values(page.properties).find((p) => p.type === "title");
    const title = titleProp?.title?.map((t) => t.plain_text).join("") || "(untitled)";
    const liveUrl = page.properties?.["Live URL"]?.url || null;

    const note = typeof comment === "string" && comment.trim()
        ? `\nNota di JJ: ${comment.trim().slice(0, 1500)}` : "";
    const today = new Date().toISOString().slice(0, 10);
    const existing = findPatchForAsset(rowId);

    if (decision === "modify") {
        if (!note) throw new Error("modify requires a note — scrivi cosa cambiare, Edmondo la esegue");
        const desk = await createDeskRow({
            title: `Rilavora patch website: ${title}`,
            type: "recommendation",
            priority: "Normal",
            status: "Approved", // JJ's click IS the ratification
            body:
                `Richiesta di modifica di JJ dal Cancello il ${today}.\n`
                + `Destinatario: Edmondo (edmondo-il-caporedattore).\n`
                + `Articolo: ${title}${liveUrl ? ` (${liveUrl})` : ""} — Content Asset ${rowId}.\n`
                + (existing
                    ? `La patch preparata "${existing.id}" NON e' stata applicata: va rifatta secondo la nota.\n`
                    : "Nessuna patch preparata: il lavoro va impostato secondo la nota.\n")
                + "Produrre la nuova versione come patch preparata (mai publish — gate di JJ)."
                + note,
        });
        return { rowId, status: "Rilavorazione → Edmondo", deskRowId: desk.rowId };
    }

    // Approve with a prepared patch: apply THAT patch now, via the house's
    // own CLI — the thing JJ approved is the thing that lands.
    if (existing) {
        const run = await runHouseScript("operations/website-patch.js", [existing.id, "--apply"]);
        let applied: { alreadyApplied?: boolean; draftId?: string; operations?: string[] } | null = null;
        if (run.ok) {
            try { applied = JSON.parse(run.stdout); } catch { /* CLI printed non-JSON */ }
        }

        if (applied?.alreadyApplied) {
            return {
                rowId,
                status: `Già applicata — la bozza ${applied.draftId} esiste già`,
                patchId: existing.id,
                draftId: applied.draftId,
                alreadyApplied: true,
            };
        }

        const failure = run.ok && applied ? null : (run.error || run.stderr || "output CLI non interpretabile");
        const desk = await createDeskRow({
            title: failure
                ? `Patch website FALLITA — intervento richiesto: ${title}`
                : `Bozza Sanity pronta da pubblicare: ${title}`,
            type: failure ? "question" : "publish-approval",
            priority: failure ? "Urgent" : "Normal",
            body: failure
                ? `La patch preparata "${existing.id}" NON e' stata applicata.\n`
                  + `Motivo: ${String(failure).slice(0, 800)}\n`
                  + `Articolo: ${title}${liveUrl ? ` (${liveUrl})` : ""} — Content Asset ${rowId}.\n`
                  + `Documento Sanity: ${existing.sanityDocId}.${note}`
                : `Patch "${existing.id}" applicata come BOZZA Sanity il ${new Date().toISOString().slice(0, 16).replace("T", " ")}.\n`
                  + `Documento: ${applied!.draftId} (${(applied!.operations ?? []).length} operazione/i).\n`
                  + `Articolo: ${title}${liveUrl ? ` (${liveUrl})` : ""}.\n`
                  + `Motivazione editoriale: ${existing.rationale || "(non registrata)"}\n`
                  + "La bozza NON e' pubblicata: aprila in Sanity Studio, rileggi e pubblica tu. Il gate #1 resta tuo."
                  + note,
        });
        return {
            rowId,
            status: failure
                ? "Patch NON applicata — riga Desk aperta"
                : `Bozza Sanity creata (${applied!.draftId})`,
            deskRowId: desk.rowId,
            patchId: existing.id,
            draftId: applied?.draftId ?? null,
            ok: !failure,
        };
    }

    // No prepared patch → commission the work order, ratified in the same act.
    const desk = await createDeskRow({
        title: `Patch articolo website: ${title}`,
        type: "recommendation",
        priority: "Normal",
        status: "Approved",
        body:
            `Work order commissionato da JJ dal Cancello il ${today}.\n`
            + `Destinatario: Edmondo (edmondo-il-caporedattore) — orchestrazione sito.\n`
            + `Articolo: ${title}${liveUrl ? ` (${liveUrl})` : ""} — Content Asset ${rowId}.\n`
            + "Preparare il patch come BOZZA Sanity (mai publish — gate #1 resta di JJ). "
            + "Al termine, filare una riga publish-approval sul Desk per la finalizzazione."
            + note,
    });
    return { rowId, status: "Work order → Edmondo", deskRowId: desk.rowId };
}

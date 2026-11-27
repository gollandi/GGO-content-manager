/**
 * Il Cancello's acts, applied natively — the port of `applyDecision` from
 * ernesto-agents-house tools/review-dashboard/server.js.
 *
 * Governance: a status flip happens ONLY in direct response to a click on
 * the register, and the acts that close or release work (approve — which is
 * publish — send, reject, done, delete) are JJ's alone (../auth/permissions).
 * Collaborators may comment, mark a post ready for JJ or request changes —
 * notes only, never a status. Every act carries its actor, and notes are appended and
 * attributed, never overwritten (./notes.ts). The state machine values are copied verbatim
 * from the house's core/publish-state.js (CALENDAR_DECISION_FLIPS) — the
 * house remains the owner of the lifecycle; this module is the conduit for
 * JJ's hand.
 *
 * Two deliberate departures from the old resident server:
 *  - Sanity staging after a calendar approve is NOT re-implemented here: the
 *    house's 06:35 cron stages approved rows. The hand-off to Buffer is the
 *    cockpit's own (./buffer-send.ts) — the house's publisher was retired on
 *    2026-09-08, and launchd kickstarts never worked on the VPS.
 *  - Website patch application runs the house's own CLI one-shot
 *    (operations/website-patch.js <id> --apply) — single source of truth.
 */
import { notion } from "../notion/client";
import { notionConfig } from "../config";
import { findPatchForAsset } from "./patches";
import { runHouseScript } from "./house";
import { alreadySent, liveDeps, sendRow } from "./buffer-send";
import { recordSendOrder, withdrawSendOrder } from "./send-orders";
import { invalidateCancelloCache } from "./state";
import { appendNote, formatNote, type NoteKind } from "./notes";
import { mayAct, type CancelloAct } from "../auth/permissions";
import { CommentActError, prepareDeskDecision } from "../social/comments-notion";
import type { Role } from "../auth/roles";

export type Decision = CancelloAct;
export type Target = "desk" | "calendar" | "website";

// Verbatim from the house's core/publish-state.js — approve is publish.
// `done` is JJ's broom: work already carried out elsewhere (a draft he
// published in Studio, a request that lapsed) — the row closes and stops
// haunting the register. `delete` is different: it archives the Notion page
// itself after an explicit destructive confirmation in the UI.
const STATUS_MAPS: Record<"desk" | "calendar", Partial<Record<Decision, string>>> = {
    desk: { approve: "Approved", reject: "Rejected", modify: "Pending", done: "Done" },
    calendar: { approve: "Approved", modify: "Draft", reject: "Blocked", done: "Archived" },
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
}

/** Who is acting. The owner is the default only for callers that predate attribution. */
export interface Actor {
    email: string;
    name: string;
    role: Role;
}
export const OWNER: Actor = { email: "", name: "JJ", role: "admin" };

/** The admin is JJ; the house's roster and every existing text call him so. */
export function actorLabel(actor: Actor): string {
    if (actor.role === "admin") return "JJ";
    const label = actor.name || actor.email || "unknown";
    // "JJ" on a notes line is the owner's decision, and an approval signed so
    // authorises a send: nobody else may sign with it, whatever their account
    // is called.
    // Compared after Unicode folding, without zero-width or punctuation, so
    // "J J", "JJ\u200b" or full-width letters cannot pass for the owner.
    const folded = label.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
    return folded === "JJ" ? (actor.email || "unknown") : label;
}

export class DecisionForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DecisionForbiddenError";
    }
}

const NOTE_KIND: Partial<Record<Decision, NoteKind>> = {
    approve: "approve", modify: "rework", reject: "reject", done: "done", delete: "delete",
    comment: "note", ready: "ready", request: "changes",
};

export interface DecisionResult {
    rowId: string;
    status: string;
    [key: string]: unknown;
}

const normaliseNotionId = (id: string) => id.replace(/-/g, "");

function statusOf(page: { properties?: Record<string, unknown> }): string | null {
    const p = page.properties?.Status as { type?: string; select?: { name?: string } | null } | undefined;
    return p?.type === "select" ? p.select?.name ?? null : null;
}

const assertRowOf = (rowId: string, target: "desk" | "calendar") => assertDeletablePage(rowId, target, "act on");

async function assertDeletablePage(rowId: string, target: "desk" | "calendar", verb = "delete"): Promise<{ properties?: Record<string, unknown> }> {
    const page = await notion.pages.retrieve({ page_id: rowId }) as {
        parent?: { type?: string; database_id?: string };
        properties?: Record<string, unknown>;
    };
    const expected = target === "desk"
        ? notionConfig.dbs.ernestoDesk()
        : notionConfig.dbs.contentCalendar();
    if (
        page.parent?.type !== "database_id" ||
        normaliseNotionId(page.parent.database_id ?? "") !== normaliseNotionId(expected)
    ) {
        throw new Error(`refusing to ${verb} ${rowId}: it is not a ${target} proposal`);
    }
    return page;
}

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

/**
 * The row's notes property with one attributed line appended (calendar).
 * The Desk's `Correction` keeps its old meaning — JJ's latest instruction,
 * overwritten — because the house reads it whole as that (desk-reader,
 * youtube-reply-drafts); only JJ acts on Desk rows.
 */
async function appendedNotes(
    rowId: string, target: "desk" | "calendar", actor: Actor, kind: NoteKind, text: string,
    page?: { properties?: Record<string, unknown> },
): Promise<{ prop: string; value: unknown; text: string }> {
    const prop = COMMENT_PROP[target];
    if (target === "desk") {
        const content = text.slice(0, 1900);
        return { prop, value: { rich_text: [{ text: { content } }] }, text: content };
    }
    const current = page ?? await notion.pages.retrieve({ page_id: rowId }) as { properties?: Record<string, unknown> };
    const line = formatNote({ label: actorLabel(actor) }, kind, text);
    const { rich_text, text: full } = appendNote(current.properties?.[prop], line);
    return { prop, value: { rich_text }, text: full };
}

/**
 * JJ's decision never fails because of its note: on main a note simply
 * overwrote the field and the act always went through. If his note cannot be
 * appended (the field is at its limit, or the read failed) the status flip
 * still happens and the result says the note was not saved, so the page can
 * tell him. A collaborator's note is the whole act, so for them it throws.
 */
async function ownerNotes(
    rowId: string, target: "desk" | "calendar", actor: Actor, kind: NoteKind, text: string,
    page?: { properties?: Record<string, unknown> },
): Promise<{ prop?: string; value?: unknown; text?: string; skipped?: string }> {
    try {
        return await appendedNotes(rowId, target, actor, kind, text, page);
    } catch (err) {
        // A rework order IS its note: flipping to Draft without the
        // instruction would send the team work with nothing to do. Refuse.
        if (actor.role !== "admin" || kind === "rework") throw err;
        return { skipped: `note not saved: ${(err as Error).message}` };
    }
}

/**
 * Whether the row's staging may be cleared so the house stages it afresh.
 * Only a row still being worked on (Review or Draft): an Approved row is on
 * its way, and a Scheduled or Published one is found by its `Sanity Sync`
 * (social-publish-sync). And never while any of its staged posts is with
 * Buffer, half-sent or sent: re-staging rewrites the draft, and that draft is
 * the only record that stops a second send.
 */
async function mayRestage(rowId: string): Promise<boolean> {
    const page = await notion.pages.retrieve({ page_id: rowId }) as { properties?: Record<string, unknown> } | undefined;
    const status = page ? statusOf(page) : null;
    if (status !== "Review" && status !== "Draft") return false;
    const facts = await liveDeps.getRow(rowId);
    if (!facts?.sanityIds?.length) return true;
    const docs = await liveDeps.fetchDocs(facts.sanityIds.flatMap((id) => [`drafts.${id}`, id]));
    return !docs.some((d) => alreadySent(d) || d.buffer?.status === "sending");
}

export async function applyCancelloDecision(input: DecisionInput, actor: Actor): Promise<DecisionResult> {
    const { rowId, decision, target = "desk" } = input;
    const comment = typeof input.comment === "string" ? input.comment.trim() : "";
    if (!rowId) throw new Error("rowId is required");
    if (target !== "desk" && target !== "calendar" && target !== "website") throw new Error(`unknown target: ${target}`);
    if (decision === "send" && target !== "calendar") throw new Error("send applies to calendar rows only");
    if (!mayAct(actor.role, target, decision)) {
        throw new DecisionForbiddenError(`"${decision}" on ${target} rows is not available to the ${actor.role} role`);
    }
    // A rework order or a comment with nothing in it tells nobody anything.
    if ((decision === "modify" || decision === "comment" || decision === "request") && !comment) {
        throw new Error(`${decision} requires a note`);
    }
    // Only the owner may move a publish date (it is part of his seal).
    if (actor.role !== "admin" && typeof input.date === "string" && input.date.trim()) {
        throw new DecisionForbiddenError("only JJ may change a publish date");
    }
    let noteSkipped: string | undefined;
    try {
        if (target === "website") return await applyWebsiteDecision(input, actor);
        // A collaborator's act must land on a real row of the declared
        // table, and only on a post in Review — the queue they are shown.
        let collaboratorPage: { properties?: Record<string, unknown> } | undefined;
        if (actor.role !== "admin") {
            collaboratorPage = await assertRowOf(rowId, target);
            const current = statusOf(collaboratorPage);
            if (current !== "Review") {
                throw new DecisionForbiddenError(`only a post in Review can be acted on (this one is ${current ?? "without a status"})`);
            }
        }

        const map = STATUS_MAPS[target];

        if (decision === "delete") {
            const page = await assertDeletablePage(rowId, target);
            const properties: Record<string, unknown> = {};
            if (comment) {
                const notes = await ownerNotes(rowId, target, actor, "delete", comment, page);
                if (notes.prop) properties[notes.prop] = notes.value;
                if (notes.skipped) noteSkipped = notes.skipped;
            }
            await notion.pages.update({
                page_id: rowId,
                archived: true,
                ...(Object.keys(properties).length > 0 ? { properties: properties as never } : {}),
            });
            if (target === "calendar") withdrawSendOrder(rowId);
            return { rowId, status: "Deleted", archived: true, ...(noteSkipped ? { noteSkipped } : {}) };
        }

        // Speaking on a row without deciding it: the status stays where it is.
        if (decision === "comment" || decision === "ready" || decision === "request") {
            const notes = await appendedNotes(rowId, target, actor, NOTE_KIND[decision]!, comment, collaboratorPage);
            await notion.pages.update({ page_id: rowId, properties: { [notes.prop]: notes.value } as never });
            const label = decision === "ready" ? "Ready for JJ" : decision === "request" ? "Changes requested" : "Noted";
            return { rowId, status: label, notes: notes.text };
        }

        // The second flip: JJ authorises the hand-off of an approved, staged
        // row to Buffer. The row's status moves only when every post landed.
        if (decision === "send") {
            if (target !== "calendar") throw new Error("send applies to calendar rows only");
            const send = await sendRow(rowId, liveDeps, { budget: { immediate: 1 }, retryFailed: true });
            if (send.outcome === "handed-off") withdrawSendOrder(rowId);
            return { rowId, status: send.calendarStatus ?? "Approved", send };
        }

        const status = map[decision];
        if (!status) throw new Error(`unknown decision: ${decision}`);
        // A YouTube reply row: approving is posting, so the draft is stamped
        // (or the act refused); a rework clears earlier stamps.
        if (target === "desk") {
            try {
                await prepareDeskDecision(rowId, null, decision, { label: actorLabel(actor) });
            } catch (err) {
                if (err instanceof CommentActError) throw new DecisionForbiddenError(err.message);
                throw err;
            }
        }

        const properties: Record<string, unknown> = { Status: { select: { name: status } } };
        let notesText: string | undefined;
        // A calendar approval always leaves JJ's signed line in the notes,
        // comment or not, for the row's history. What authorises the send is
        // the order recorded below on the cockpit's disk, not this line.
        const signsApproval = target === "calendar" && decision === "approve";
        if (comment || signsApproval) {
            const notes = await ownerNotes(rowId, target, actor, NOTE_KIND[decision] ?? "note", comment, collaboratorPage);
            if (notes.prop) properties[notes.prop] = notes.value;
            notesText = notes.text;
            if (notes.skipped) noteSkipped = notes.skipped;
        }
        // JJ may correct the proposed publish date in the same act as the seal.
        if (target === "calendar" && typeof input.date === "string" && input.date.trim()) {
            properties.Date = { date: { start: input.date.trim() } };
        }
        // What JJ approves is what he sees: the row as it stands in Notion.
        // Drafts staged earlier (before a send-back and rework, or before a
        // date change) must not go out in its place, so an approval or a
        // send-back clears the staging and the house stages the row afresh
        // (notion-to-sanity-sync picks rows whose Sanity Sync is empty).
        if (target === "calendar" && actor.role === "admin" && await mayRestage(rowId)) {
            properties["Sanity Sync"] = { rich_text: [] };
        }
        await notion.pages.update({ page_id: rowId, properties: properties as never });
        if (target === "calendar") {
            // Any decision of his replaces the one before: an approval records
            // the order to send, anything else withdraws it.
            if (signsApproval) recordSendOrder(rowId, actor.email || "JJ");
            else if (actor.role === "admin") withdrawSendOrder(rowId);
        }

        // JJ's approval is final for every row, whoever proposed it (JJ,
        // 27 November 2026): if the drafts are staged the hand-off happens
        // now, otherwise the Buffer sweep sends the row once staging lands,
        // knowing it from the order recorded above.
        if (signsApproval) {
            const send = await sendRow(rowId, liveDeps, { budget: { immediate: 1 }, retryFailed: false });
            if (send.outcome === "handed-off") withdrawSendOrder(rowId);
            return { rowId, status: send.calendarStatus ?? status, send, notes: notesText, ...(noteSkipped ? { noteSkipped } : {}) };
        }
        return { rowId, status, notes: notesText, ...(noteSkipped ? { noteSkipped } : {}) };
    } finally {
        invalidateCancelloCache();
    }
}

/* ── Website: patches and work orders ────────────────────────────────── */

async function applyWebsiteDecision({ rowId, decision, comment }: DecisionInput, actor: Actor): Promise<DecisionResult> {
    const who = actorLabel(actor);
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
        ? `\nNota di ${who}: ${comment.trim().slice(0, 1500)}` : "";
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
                `Richiesta di modifica di ${who} dal Cancello il ${today}.\n`
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
            `Work order commissionato da ${who} dal Cancello il ${today}.\n`
            + `Destinatario: Edmondo (edmondo-il-caporedattore) — orchestrazione sito.\n`
            + `Articolo: ${title}${liveUrl ? ` (${liveUrl})` : ""} — Content Asset ${rowId}.\n`
            + "Preparare il patch come BOZZA Sanity (mai publish — gate #1 resta di JJ). "
            + "Al termine, filare una riga publish-approval sul Desk per la finalizzazione."
            + note,
    });
    return { rowId, status: "Work order → Edmondo", deskRowId: desk.rowId };
}

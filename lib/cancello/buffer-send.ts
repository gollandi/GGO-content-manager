/**
 * The Buffer hand-off — the leg that turns JJ's approval of a Content
 * Calendar row into scheduled posts, replacing the house's retired
 * `social-approved-publish` (ernesto-agents-house dd55354, 2026-09-08).
 *
 * Who authorises a send (JJ, 2026-09-26):
 *  - a row whose `Ordered By` is JJ: his first flip is the final approval,
 *    so the sweep sends it as soon as the house has staged its drafts;
 *  - any other row (the team's own proposals, or `Ordered By` unset): the
 *    first flip approves the content, and a second flip in the Cancello —
 *    "Invia a Buffer" — authorises the send.
 *
 * The route is the site's own `/api/social-posts/publish` (the path the
 * Studio's "Send to Buffer" action uses): it requires `status == approved`,
 * refuses a post that already carries a Buffer id (409), and hands the post
 * to Buffer. The route does not write back; this module does, with the same
 * fields the Studio action writes.
 *
 * No duplicate can leave here:
 *  1. a post already published, or carrying a Buffer id that did not fail,
 *     is skipped;
 *  2. before the call the draft is locked (`buffer.status = sending`) with
 *     an optimistic revision check, so two concurrent sends cannot both pass;
 *  3. a post found in `sending` is never retried automatically — a crash
 *     between the call and the write-back would otherwise send it twice —
 *     and is reported for a human look instead.
 *
 * Everything stays a draft: the cockpit writes drafts.* only.
 */
import { notion } from "../notion/client";
import { notionConfig, sanityGgomedWriteConfig } from "../config";
import { multiSelect, prop, relationIds, richText, select } from "../notion/extract";
import { fetchByIds, patchDraft, patchDraftIfRevision } from "../sanity/write-client";

type Props = Parameters<typeof prop>[0];

export interface CalendarRowFacts {
    rowId: string;
    title: string;
    status: string | null;
    orderedBy: string | null;
    platforms: string[];
    /** Bare socialPost ids (no drafts. prefix) from `Sanity Sync`. */
    sanityIds: string[];
    topicIds: string[];
}

export interface SocialDoc {
    _id: string;
    _rev: string;
    status?: string | null;
    scheduledFor?: string | null;
    buffer?: {
        postId?: string | null;
        status?: string | null;
        lastError?: string | null;
    } | null;
}

export interface SitePayload {
    status?: string;
    remoteStatus?: string;
    shareMode?: string;
    postId?: string;
    channelId?: string;
    channelService?: string;
    externalLink?: string;
    dueAt?: string;
    sentAt?: string;
    attemptedAt?: string;
}

export type SiteResult =
    | { kind: "ok"; payload: SitePayload }
    | { kind: "conflict" }
    | { kind: "error"; status: number; message: string };

export type PostOutcome =
    | "sent"
    | "already-sent"
    | "deferred"
    | "stuck"
    | "concurrent"
    | "missing"
    | "failed";

export interface PostResult {
    sanityId: string;
    outcome: PostOutcome;
    intent?: "queue" | "publishNow";
    detail?: string;
    bufferStatus?: string;
}

export type RowOutcome =
    | "not-approved"
    | "awaiting-staging"
    | "handed-off"
    | "partial";

export interface RowResult {
    rowId: string;
    title: string;
    outcome: RowOutcome;
    posts: PostResult[];
    calendarStatus?: string;
    topicsClosed?: string[];
}

export interface SendDeps {
    getRow(rowId: string): Promise<CalendarRowFacts>;
    fetchDocs(ids: string[]): Promise<SocialDoc[]>;
    lock(id: string, rev: string, set: Record<string, unknown>): Promise<unknown>;
    writeBack(id: string, set: Record<string, unknown>): Promise<unknown>;
    postToSite(sanityId: string, action: "queue" | "publishNow"): Promise<SiteResult>;
    setRowStatus(rowId: string, status: string): Promise<unknown>;
    getTopicStatus(topicId: string): Promise<string | null>;
    setTopicStatus(topicId: string, status: string): Promise<unknown>;
    now(): Date;
}

/**
 * A future slot is honoured through Buffer's scheduler; a slot already past
 * (or none) goes out now — the house's retired publisher did the same.
 */
export function pickIntent(scheduledFor: string | null | undefined, now: Date): "queue" | "publishNow" {
    if (!scheduledFor) return "publishNow";
    const slot = new Date(scheduledFor);
    if (Number.isNaN(slot.getTime()) || slot <= now) return "publishNow";
    return "queue";
}

/** Published, or handed to Buffer by any path (Studio, a previous run). */
export function alreadySent(doc: SocialDoc | undefined): boolean {
    if (!doc) return false;
    if (doc.status === "published") return true;
    return Boolean(doc.buffer?.postId) && doc.buffer?.status !== "failed";
}

export function isOrderedByJJ(row: Pick<CalendarRowFacts, "orderedBy">): boolean {
    return row.orderedBy === "JJ";
}

const CLOSED_TOPIC_STATES = new Set(["Done"]);

export interface SendOptions {
    /**
     * Rows allowed to go out immediately in this call — no output leaves as a
     * block (JJ, 2026-08-13). One row's platforms (Instagram + Facebook of the
     * same carousel) count once; future-dated posts are not counted at all,
     * because Buffer's own slots already space them.
     */
    budget?: { immediate: number };
    /** A post whose last attempt failed is retried only on JJ's click, never by the sweep. */
    retryFailed?: boolean;
}

export async function sendRow(
    rowId: string,
    deps: SendDeps,
    { budget = { immediate: 1 }, retryFailed = true }: SendOptions = {}
): Promise<RowResult> {
    const row = await deps.getRow(rowId);
    const base = { rowId, title: row.title };
    if (row.status !== "Approved") return { ...base, outcome: "not-approved", posts: [] };
    if (row.sanityIds.length === 0) return { ...base, outcome: "awaiting-staging", posts: [] };

    const docs = await deps.fetchDocs(row.sanityIds.flatMap((id) => [`drafts.${id}`, id]));
    const byId = new Map(docs.map((d) => [d._id, d]));
    const posts: PostResult[] = [];
    let rowUsedImmediate = false;

    for (const id of row.sanityIds) {
        const draft = byId.get(`drafts.${id}`);
        const published = byId.get(id);
        if (alreadySent(draft) || alreadySent(published)) {
            posts.push({
                sanityId: id,
                outcome: "already-sent",
                bufferStatus: (draft ?? published)?.buffer?.status ?? undefined,
            });
            continue;
        }
        if (!draft) {
            posts.push({ sanityId: id, outcome: "missing", detail: "no staged draft for this id" });
            continue;
        }
        if (draft.buffer?.status === "sending") {
            posts.push({
                sanityId: id,
                outcome: "stuck",
                detail: "left in 'sending' by an interrupted hand-off — check Buffer before resetting",
            });
            continue;
        }
        if (draft.buffer?.status === "failed" && !retryFailed) {
            posts.push({
                sanityId: id,
                outcome: "failed",
                detail: `last attempt failed (${draft.buffer.lastError ?? "no reason recorded"}) — retry from the Cancello`,
            });
            continue;
        }

        const intent = pickIntent(draft.scheduledFor, deps.now());
        if (intent === "publishNow" && !rowUsedImmediate && budget.immediate <= 0) {
            posts.push({ sanityId: id, outcome: "deferred", intent, detail: "one immediate row per run" });
            continue;
        }

        const attemptedAt = deps.now().toISOString();
        try {
            await deps.lock(draft._id, draft._rev, {
                status: "approved",
                "buffer.status": "sending",
                "buffer.lastAttemptedAt": attemptedAt,
            });
        } catch {
            posts.push({ sanityId: id, outcome: "concurrent", detail: "the draft changed under the hand-off" });
            continue;
        }
        if (intent === "publishNow" && !rowUsedImmediate) {
            budget.immediate -= 1;
            rowUsedImmediate = true;
        }

        const result = await deps.postToSite(id, intent);
        if (result.kind === "ok") {
            const p = result.payload;
            const set: Record<string, unknown> = {
                "buffer.status": p.status ?? "queued",
                "buffer.lastAttemptedAt": p.attemptedAt ?? attemptedAt,
            };
            for (const key of ["remoteStatus", "shareMode", "postId", "channelId", "channelService", "externalLink", "dueAt", "sentAt"] as const) {
                if (p[key]) set[`buffer.${key}`] = p[key];
            }
            if (p.status === "published") set.status = "published";
            await deps.writeBack(draft._id, set);
            posts.push({ sanityId: id, outcome: "sent", intent, bufferStatus: String(set["buffer.status"]) });
        } else if (result.kind === "conflict") {
            // The site already holds a Buffer id for this post: sent by another
            // path between our read and our call. Leave the lock for a human.
            posts.push({ sanityId: id, outcome: "stuck", intent, detail: "site answered 409 already-sent" });
        } else {
            await deps.writeBack(draft._id, {
                "buffer.status": "failed",
                "buffer.lastError": result.message.slice(0, 500),
                "buffer.lastAttemptedAt": attemptedAt,
            });
            posts.push({ sanityId: id, outcome: "failed", intent, detail: `HTTP ${result.status}: ${result.message}` });
        }
    }

    const done = posts.every((p) => p.outcome === "sent" || p.outcome === "already-sent");
    if (!done) return { ...base, outcome: "partial", posts };

    // Close the loop: the row leaves the approval queue, and the topic it
    // served stops being an open need.
    const allPublished = posts.every((p) => p.bufferStatus === "published");
    const calendarStatus = allPublished ? "Published" : "Scheduled";
    await deps.setRowStatus(rowId, calendarStatus);
    const topicsClosed: string[] = [];
    for (const topicId of row.topicIds) {
        const current = await deps.getTopicStatus(topicId);
        if (current && CLOSED_TOPIC_STATES.has(current)) continue;
        await deps.setTopicStatus(topicId, "Done");
        topicsClosed.push(topicId);
    }
    return { ...base, outcome: "handed-off", posts, calendarStatus, topicsClosed };
}

/* ── Live dependencies ───────────────────────────────────────────────── */

const splitIds = (value: string): string[] =>
    value
        .split(",")
        .map((s) => s.trim().replace(/^drafts\./, ""))
        .filter((s) => s.startsWith("social-"));

export function calendarFactsFromPage(page: { id: string; properties: Props }): CalendarRowFacts {
    const props = page.properties;
    const titleProp = prop(props, "Topic Title");
    return {
        rowId: page.id,
        title: titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "(untitled)",
        status: select(prop(props, "Status")),
        orderedBy: select(prop(props, "Ordered By")),
        platforms: multiSelect(prop(props, "Platform")),
        sanityIds: splitIds(richText(prop(props, "Sanity Sync"))),
        topicIds: relationIds(prop(props, "Topic")),
    };
}

export function siteBaseUrl(): string {
    return (process.env.GGOMED_SITE_URL || "https://ggomed.co.uk").replace(/\/$/, "");
}

/**
 * The site accepts either a server-to-server bearer or a Sanity token with
 * write scope (probed by a dry-run create). The cockpit prefers a dedicated
 * bearer when one is configured and otherwise presents its own write token.
 */
async function postToSite(sanityId: string, action: "queue" | "publishNow"): Promise<SiteResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const bearer = process.env.GGOMED_PUBLISH_BEARER;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    else headers["x-sanity-token"] = sanityGgomedWriteConfig.writeToken;
    let res: Response;
    try {
        res = await fetch(`${siteBaseUrl()}/api/social-posts/publish`, {
            method: "POST",
            headers,
            body: JSON.stringify({ action, sanityId }),
            signal: AbortSignal.timeout(60_000),
        });
    } catch (err) {
        return { kind: "error", status: 0, message: err instanceof Error ? err.message : String(err) };
    }
    const payload = (await res.json().catch(() => null)) as (SitePayload & { error?: string }) | null;
    if (res.status === 409) return { kind: "conflict" };
    if (!res.ok || !payload) {
        return { kind: "error", status: res.status, message: payload?.error || `HTTP ${res.status}` };
    }
    return { kind: "ok", payload };
}

export const liveDeps: SendDeps = {
    async getRow(rowId) {
        const page = (await notion.pages.retrieve({ page_id: rowId })) as unknown as {
            id: string; properties: Props;
        };
        return calendarFactsFromPage(page);
    },
    fetchDocs: (ids) =>
        fetchByIds<SocialDoc>(ids, "{_id, _rev, status, scheduledFor, buffer{postId, status, lastError}}"),
    lock: (id, rev, set) => patchDraftIfRevision(id, rev, set, ["buffer.lastError"]),
    writeBack: (id, set) => patchDraft(id, set),
    postToSite,
    setRowStatus: (rowId, status) =>
        notion.pages.update({ page_id: rowId, properties: { Status: { select: { name: status } } } as never }),
    async getTopicStatus(topicId) {
        const page = (await notion.pages.retrieve({ page_id: topicId })) as unknown as { properties: Props };
        return select(prop(page.properties, "Status"));
    },
    setTopicStatus: (topicId, status) =>
        notion.pages.update({ page_id: topicId, properties: { Status: { select: { name: status } } } as never }),
    now: () => new Date(),
};

/* ── The sweep: JJ's own orders, sent once the house has staged them ──── */

export interface SweepResult {
    considered: number;
    rows: RowResult[];
}

export async function sweepOrderedRows(
    deps: SendDeps = liveDeps,
    listRows: () => Promise<CalendarRowFacts[]> = listApprovedStagedRows
): Promise<SweepResult> {
    const rows = (await listRows()).filter(isOrderedByJJ);
    const budget = { immediate: 1 };
    const results: RowResult[] = [];
    for (const row of rows) {
        results.push(await sendRow(row.rowId, deps, { budget, retryFailed: false }));
    }
    return { considered: rows.length, rows: results };
}

export async function listApprovedStagedRows(): Promise<CalendarRowFacts[]> {
    const out: CalendarRowFacts[] = [];
    let cursor: string | undefined;
    do {
        const res = await notion.databases.query({
            database_id: notionConfig.dbs.contentCalendar(),
            filter: {
                and: [
                    { property: "Status", select: { equals: "Approved" } },
                    { property: "Sanity Sync", rich_text: { is_not_empty: true } },
                ],
            },
            start_cursor: cursor,
            page_size: 100,
        });
        for (const page of res.results) {
            if ("properties" in page) out.push(calendarFactsFromPage(page as unknown as { id: string; properties: Props }));
        }
        cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return out;
}

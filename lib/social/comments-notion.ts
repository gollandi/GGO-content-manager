/**
 * The Comments room's reads and writes on the Ernesto Desk's `[yt:…]` rows.
 *
 * What a collaborator may do here is speak on a Pending comment row: suggest
 * a reply (a marked block the house's drafting step reads) or mark the
 * latest draft as checked. Neither moves a status or touches `Correction`,
 * which stays JJ's instruction. Approving a reply is posting it in public:
 * it is whoever PUBLISH_AUTHORITY["comment-reply"] names — JJ alone today —
 * and the approval stamps the draft on screen, so the dispatcher posts
 * exactly that draft or nothing.
 */
import type { PageObjectResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "../notion/client";
import { notionConfig } from "../config";
import { cached, invalidateCache } from "../cache";
import * as x from "../notion/extract";
import { approvalBlock, commentIdFromTitle, parseCommentRow, readyBlock, suggestionBlocks, type Block, type ParsedComment } from "./comments";

const DESK_TYPE = "publish-approval";
const OPEN_STATUSES = ["Pending", "Approved", "In production"];
const RECENT_DONE_DAYS = 14;
const TTL_MS = 2 * 60 * 1000;
const CACHE_KEY = "social:comments";

export interface CommentRow extends ParsedComment {
    rowId: string;
    status: string | null;
    lastEdited: string;
}

export class CommentActError extends Error {}

async function listBlocks(pageId: string): Promise<Block[]> {
    const out: Block[] = [];
    let cursor: string | undefined;
    do {
        const res = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
        out.push(...(res.results as Block[]));
        cursor = res.next_cursor || undefined;
    } while (cursor);
    return out;
}

async function queryRows(): Promise<PageObjectResponse[]> {
    const since = new Date(Date.now() - RECENT_DONE_DAYS * 86_400_000).toISOString();
    const rows: PageObjectResponse[] = [];
    let cursor: string | undefined;
    do {
        const res: QueryDatabaseResponse = await notion.databases.query({
            database_id: notionConfig.dbs.ernestoDesk(),
            start_cursor: cursor,
            filter: {
                and: [
                    { property: "Type", select: { equals: DESK_TYPE } },
                    { property: "Item", title: { contains: "[yt:" } },
                    { or: [
                        ...OPEN_STATUSES.map((s) => ({ property: "Status", select: { equals: s } })),
                        { and: [{ property: "Status", select: { equals: "Done" } }, { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } }] },
                    ] },
                ],
            } as never,
            sorts: [{ timestamp: "created_time", direction: "descending" }],
        });
        rows.push(...res.results.filter((r): r is PageObjectResponse => "properties" in r));
        cursor = res.next_cursor || undefined;
    } while (cursor && rows.length < 200);
    return rows;
}

async function readUncached(): Promise<{ rows: CommentRow[]; unreadable: number }> {
    const pages = await queryRows();
    const rows: CommentRow[] = [];
    let unreadable = 0;
    for (const page of pages) {
        const commentId = commentIdFromTitle(x.anyTitle(page.properties));
        if (!commentId) continue;
        try {
            rows.push({ rowId: page.id, status: x.select(x.prop(page.properties, "Status")), lastEdited: page.last_edited_time,
                ...parseCommentRow(await listBlocks(page.id), commentId) });
        } catch (err) {
            unreadable += 1;
            console.error("[social/comments] row unreadable", page.id, (err as Error).message);
        }
    }
    return { rows, unreadable };
}

/** Comment rows waiting or recently answered, newest first. `unreadable` is said, never hidden. */
export function listComments(): Promise<{ rows: CommentRow[]; unreadable: number }> {
    return cached(CACHE_KEY, readUncached, TTL_MS);
}

/** The row, checked to be a `[yt:…]` comment row of the Desk, with its parsed body. */
async function loadRow(rowId: string): Promise<{ page: PageObjectResponse; row: ParsedComment; status: string | null }> {
    const page = await notion.pages.retrieve({ page_id: rowId }) as PageObjectResponse;
    const parent = page.parent as { type?: string; database_id?: string };
    if (parent?.type !== "database_id" || (parent.database_id ?? "").replace(/-/g, "") !== notionConfig.dbs.ernestoDesk().replace(/-/g, "")) {
        throw new CommentActError("That is not a row of the Ernesto Desk.");
    }
    if (x.select(x.prop(page.properties, "Type")) !== DESK_TYPE) throw new CommentActError("That row is not a reply awaiting approval.");
    const commentId = commentIdFromTitle(x.anyTitle(page.properties));
    if (!commentId) throw new CommentActError("That row is not a YouTube comment.");
    return { page, row: parseCommentRow(await listBlocks(rowId), commentId), status: x.select(x.prop(page.properties, "Status")) };
}

export interface CommentActor { label: string }

/** A collaborator's suggested reply or direction: appended, signed; the row stays Pending. */
export async function suggestReply(rowId: string, actor: CommentActor, text: string, now = new Date()): Promise<{ k: number }> {
    const { row, status } = await loadRow(rowId);
    if (status !== "Pending") throw new CommentActError(`Only a comment waiting for a reply can take a suggestion (this one is ${status ?? "without a status"}).`);
    const k = (row.suggestions.at(-1)?.k ?? 0) + 1;
    await notion.blocks.children.append({ block_id: rowId, children: suggestionBlocks(row.commentId, k, actor.label, text, now) as never });
    invalidateCache(CACHE_KEY);
    return { k };
}

/** "I checked the latest draft": a signed mark for JJ. Never asks for a new draft. */
export async function markReady(rowId: string, actor: CommentActor, draftSeen: number, now = new Date()): Promise<void> {
    const { row, status } = await loadRow(rowId);
    if (status !== "Pending") throw new CommentActError(`Only a comment waiting for a reply can be marked (this one is ${status ?? "without a status"}).`);
    if (!row.latestDraft) throw new CommentActError("There is no draft to check yet.");
    if (row.latestDraft.n !== draftSeen) throw new CommentActError(`A newer draft (${row.latestDraft.n}) has arrived; read it first.`);
    await notion.blocks.children.append({ block_id: rowId, children: [readyBlock(row.commentId, actor.label, draftSeen, now)] as never });
    invalidateCache(CACHE_KEY);
}

/**
 * Approve the reply: stamp the draft on screen, then flip Pending → Approved.
 * The house's dispatcher posts that draft, or nothing if a newer one came.
 * Callers check PUBLISH_AUTHORITY first; this refuses a stale screen itself.
 */
export async function approveReply(rowId: string, actor: CommentActor, draftSeen: number, now = new Date()): Promise<void> {
    const { row, status } = await loadRow(rowId);
    if (status !== "Pending") throw new CommentActError(`Only a Pending comment row can be approved (this one is ${status ?? "without a status"}).`);
    if (!row.latestDraft) throw new CommentActError("There is no draft to approve; nothing would be posted.");
    if (row.latestDraft.n !== draftSeen) throw new CommentActError(`A newer draft (${row.latestDraft.n}) has arrived; read it before approving.`);
    await stampApproval(rowId, row.commentId, draftSeen, actor, now);
    await notion.pages.update({ page_id: rowId, properties: { Status: { select: { name: "Approved" } } } as never });
    invalidateCache(CACHE_KEY);
}

export async function stampApproval(rowId: string, commentId: string, n: number, actor: CommentActor, now = new Date()): Promise<void> {
    await notion.blocks.children.append({ block_id: rowId, children: [approvalBlock(commentId, n, actor.label, now)] as never });
}

/**
 * For an approval taken elsewhere (the Desk in Il Cancello): stamp the latest
 * draft if the row is a `[yt:…]` reply row, so the dispatcher posts the draft
 * that was there at the click. Returns the draft stamped, or null.
 */
export async function stampLatestIfReply(rowId: string, actor: CommentActor, now = new Date()): Promise<number | null> {
    let loaded;
    try {
        loaded = await loadRow(rowId);
    } catch (err) {
        if (err instanceof CommentActError) return null; // not a reply row
        throw err;
    }
    if (!loaded.row.latestDraft) return null;
    await stampApproval(rowId, loaded.row.commentId, loaded.row.latestDraft.n, actor, now);
    invalidateCache(CACHE_KEY);
    return loaded.row.latestDraft.n;
}

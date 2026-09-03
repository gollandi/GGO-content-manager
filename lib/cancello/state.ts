/**
 * Il Cancello's state, read natively — the port of ernesto-agents-house
 * tools/review-dashboard/server.js `loadState`, byte-compatible in response
 * shape so the register page did not have to change its reading habits.
 *
 * Truth stays where it lives: workflow state in Notion, prepared patches on
 * the house's disk, patch progress in Sanity. This module only assembles the
 * snapshot; decisions live in ./decision.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { notion } from "../notion/client";
import { notionConfig } from "../config";
import { ggomedRawClient } from "../sanity/clients";
import { selectCalendarRowsForGate } from "../notion/story-policy";
import {
    extractVideoPaths, isPathWithinRoots, resolveLocalMediaPath, IMAGE_EXTS, VIDEO_EXTS,
} from "./paths";
import {
    findPatchForAsset, patchAlreadyApplied, operationViews,
    type PreparedPatch, type PatchOperationView,
} from "./patches";
import type {
    PageObjectResponse, QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";

/* ── Response shapes (mirror the old server exactly) ─────────────────── */

export interface VideoRef { url: string; name: string; path: string; ageDays: number }
export interface MediaRef { kind: "image" | "video"; url: string }
export interface DeskRow {
    rowId: string; url: string; title: string; type: string; status: string | null;
    priority: string; due: string | null; correction: string; body: string;
    /** Local clips (body + Media Assets): the wall's freshness reads their age. */
    videos: VideoRef[];
    /** Everything else the row points at: local stills, the Calendar Row's
     *  own assets, and hosted copies when nothing local is on this machine. */
    media: MediaRef[];
}
export interface CalendarRow {
    rowId: string; title: string; contentType: string | null; status: string | null;
    platforms: string | null; date: string | null; variant: string | null;
    caption: string; hashtags: string; notes: string; canva: string | null;
    hasAssets: boolean; media: MediaRef[]; url: string; sourceUrl: string | null; createdAt: string;
}
export interface WebsiteArticle {
    rowId: string; title: string; status: string | null; category: string | null;
    reviewDue: string | null; lastReviewed: string | null; liveUrl: string | null; url: string;
    proposals: { need: string; details: string; actionStatus: string | null; url: string }[];
    patch: {
        id: string; title: string | null; rationale: string | null; sources: string[];
        operations: PatchOperationView[]; sanityDocId: string; batch: string;
    } | null;
    patchState?: "awaiting-publish" | "published";
    draftId?: string;
}
export interface CancelloState {
    wall: DeskRow[]; desk: DeskRow[]; calendar: CalendarRow[]; website: WebsiteArticle[];
    generatedAt: string; cached: boolean; warnings: string[];
}

/* ── Constants (unchanged from the house) ────────────────────────────── */

const OPEN_DESK_STATES = ["Pending", "Approved", "In production"];
const ACTIVE_CALENDAR_STATES = ["Draft", "In Production", "Review", "Scheduled"];
const WEBSITE_REVIEW_STATES = ["👁️ Review", "⚠️ Needs Update", "📝 Draft", "🔧 To Create"];
const FRESH_DAYS = Number(process.env.REVIEW_DASHBOARD_FRESH_DAYS) || 14;

/* ── Small Notion helpers ────────────────────────────────────────────── */

type Props = PageObjectResponse["properties"];
type Prop = Props[string];

function propText(props: Props, name: string): string | null {
    const p = props?.[name] as Prop | undefined;
    if (!p) return null;
    switch (p.type) {
        case "title": return p.title.map((t) => t.plain_text).join("") || null;
        case "rich_text": return p.rich_text.map((t) => t.plain_text).join("") || null;
        case "select": return p.select?.name ?? null;
        case "status": return p.status?.name ?? null;
        case "multi_select": return p.multi_select.length ? p.multi_select.map((o) => o.name).join(", ") : null;
        case "date": return p.date?.start ?? null;
        case "url": return p.url ?? null;
        case "number": return p.number != null ? String(p.number) : null;
        default: return null;
    }
}

function relationIds(props: Props, name: string): string[] {
    const p = props?.[name] as Prop | undefined;
    return p?.type === "relation" ? p.relation.map((r) => r.id) : [];
}

async function queryAll(databaseId: string, filter?: object, sorts?: object[]): Promise<PageObjectResponse[]> {
    const rows: PageObjectResponse[] = [];
    let cursor: string | undefined;
    do {
        const res: QueryDatabaseResponse = await notion.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
            // The SDK's filter type is stricter than the shapes we build.
            filter: filter as never,
            sorts: sorts as never,
        });
        rows.push(...(res.results as PageObjectResponse[]));
        cursor = res.next_cursor || undefined;
    } while (cursor);
    return rows;
}

async function pageBodyText(pageId: string): Promise<string> {
    const lines: string[] = [];
    let cursor: string | undefined;
    do {
        const res = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor });
        for (const block of res.results) {
            const b = block as unknown as Record<string, { rich_text?: { plain_text?: string }[] }> & { type?: string };
            const rich = (b.type && b[b.type]?.rich_text) || [];
            lines.push(rich.map((t) => t.plain_text || "").join(""));
        }
        cursor = res.next_cursor || undefined;
    } while (cursor);
    return lines.join("\n");
}

/**
 * Map with bounded concurrency — enough parallelism to collapse the
 * per-row Notion round-trips, low enough to stay within Notion's ~3 req/s
 * comfort zone once the SDK's own throttling is accounted for.
 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

const NOTION_CONCURRENCY = 4;

const orStatus = (states: string[]) => ({
    or: states.map((s) => ({ property: "Status", select: { equals: s } })),
});

/* ── Media resolution ────────────────────────────────────────────────── */

const MEDIA_URL = (p: string) => `/media?path=${encodeURIComponent(p)}`;
const VIDEO_URL = (p: string) => `/video?path=${encodeURIComponent(p)}`;

async function fileLocationsOf(assetIds: string[]): Promise<string[]> {
    const locations = await mapLimit(assetIds, NOTION_CONCURRENCY, async (id) => {
        try {
            const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
            return propText(page.properties, "File Location");
        } catch { return null; /* a missing asset yields no media — not fatal */ }
    });
    return locations.filter((loc): loc is string => Boolean(loc));
}

async function resolveRowMedia(props: Props): Promise<MediaRef[]> {
    const media: MediaRef[] = [];
    for (const loc of await fileLocationsOf(relationIds(props, "Media Assets"))) {
        for (const m of loc.matchAll(/file:\/\/(\/[^\s<>"]+)/gi)) {
            let p = m[1];
            try { p = decodeURIComponent(p); } catch { /* keep raw */ }
            const ext = path.extname(p).toLowerCase();
            const local = resolveLocalMediaPath(p);
            if (!isPathWithinRoots(local) || !fs.existsSync(local)) continue;
            if (IMAGE_EXTS.has(ext)) media.push({ kind: "image", url: MEDIA_URL(p) });
            else if (VIDEO_EXTS.has(ext)) media.push({ kind: "video", url: VIDEO_URL(p) });
        }
    }
    // Stories carry no Media Assets relation: their card is a parameterised
    // image rendered by ggomed.co.uk, referenced in the Card URL property
    // (page-story-writer, ernesto-agents-house 1a59714). Same-host only, in
    // the spirit of the brand-asset guard.
    if (media.length === 0) {
        const cardUrl = propText(props, "Card URL");
        if (cardUrl) {
            try {
                const host = new URL(cardUrl).hostname;
                if (host === "ggomed.co.uk" || host.endsWith(".ggomed.co.uk")) {
                    media.push({ kind: "image", url: cardUrl });
                }
            } catch { /* an unparseable URL yields no media — not fatal */ }
        }
    }
    return media;
}

/** Desk types whose body is scanned for the calendar row it speaks of. */
const EDITORIAL_LOOKUP_TYPES = new Set(["publish-approval", "clip-script", "long-video-proposal"]);

/** Hosts whose media a desk row may embed when the local file is absent. */
const HOSTED_MEDIA_HOSTS = ["cdn.sanity.io", "ggomed.co.uk"];
const HOSTED_MEDIA_RE = /https:\/\/[^\s<>"')]+\.(?:mp4|mov|m4v|webm|jpg|jpeg|png|webp|gif)(?:\?[^\s<>"')]*)?/gi;
const LOCAL_MEDIA_RE = /file:\/\/(\/[^\s<>"')]+\.(?:mp4|mov|m4v|webm|jpg|jpeg|png|webp|gif))/gi;

/** Local stills referenced in `text` that exist on this machine. */
function localImagesFromText(text: string): MediaRef[] {
    const out: MediaRef[] = [];
    for (const m of text.matchAll(LOCAL_MEDIA_RE)) {
        let p = m[1];
        try { p = decodeURIComponent(p); } catch { /* keep raw */ }
        if (!IMAGE_EXTS.has(path.extname(p).toLowerCase())) continue;
        const local = resolveLocalMediaPath(p);
        if (!isPathWithinRoots(local) || !fs.existsSync(local)) continue;
        out.push({ kind: "image", url: MEDIA_URL(p) });
    }
    return out;
}

/** Hosted copies (Sanity CDN, the site) named in `text` — the fallback when
 *  the local file is not on this machine, as on the VPS. */
function hostedMediaFromText(text: string): MediaRef[] {
    const out: MediaRef[] = [];
    for (const m of text.matchAll(HOSTED_MEDIA_RE)) {
        try {
            const u = new URL(m[0]);
            if (!HOSTED_MEDIA_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) continue;
            const ext = path.extname(u.pathname).toLowerCase();
            out.push({ kind: IMAGE_EXTS.has(ext) ? "image" : "video", url: u.toString() });
        } catch { /* not a URL — skip */ }
    }
    return out;
}

const NOTION_ID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const bareId = (id: string) => id.replace(/-/g, "").toLowerCase();
const MAX_BODY_IDS = 4;

/** The assets of the Calendar Rows a desk row points at (reel, cover, slides).
 *  The girls name the calendar row two ways: the "Calendar Row" relation, or
 *  its page id written in the body ("4 slides landed in Review on Content
 *  Calendar row 3acd…"). Both are followed; only pages that live in the
 *  Content Calendar count, and each page is fetched once per load. */
async function calendarRowMedia(props: Props, bodyText: string, memo: Map<string, Promise<MediaRef[]>>): Promise<MediaRef[]> {
    const calendarDb = bareId(notionConfig.dbs.contentCalendar());
    const ids = new Set<string>(relationIds(props, "Calendar Row").map(bareId));
    for (const m of bodyText.matchAll(NOTION_ID_RE)) {
        if (ids.size >= MAX_BODY_IDS + relationIds(props, "Calendar Row").length) break;
        ids.add(bareId(m[0]));
    }
    if (ids.size === 0) return [];
    const fetchOne = (id: string): Promise<MediaRef[]> => {
        const cached = memo.get(id);
        if (cached) return cached;
        const task = (async () => {
            try {
                const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
                const parent = page.parent.type === "database_id" ? bareId(page.parent.database_id) : "";
                if (parent !== calendarDb) return [];
                return await resolveRowMedia(page.properties);
            } catch { return []; }
        })();
        memo.set(id, task);
        return task;
    };
    const nested = await mapLimit([...ids], NOTION_CONCURRENCY, fetchOne);
    return nested.flat();
}

/* ── The three families ──────────────────────────────────────────────── */

async function loadDeskRows(): Promise<DeskRow[]> {
    const rows = await queryAll(
        notionConfig.dbs.ernestoDesk(),
        orStatus(OPEN_DESK_STATES),
        [{ property: "Priority", direction: "ascending" }]
    );
    // One fetch per calendar page across the whole desk, however many rows name it.
    const calendarMemo = new Map<string, Promise<MediaRef[]>>();
    return mapLimit(rows, NOTION_CONCURRENCY, async (row) => {
        let bodyText = "";
        try { bodyText = await pageBodyText(row.id); } catch { /* body is enrichment */ }

        const locations = await fileLocationsOf(relationIds(row.properties, "Media Assets"));
        const candidatePaths = extractVideoPaths(bodyText);
        for (const loc of locations) candidatePaths.push(...extractVideoPaths(loc));

        const seen = new Set<string>();
        const videos: VideoRef[] = [];
        for (const p of candidatePaths) {
            if (seen.has(p)) continue;
            seen.add(p);
            const local = resolveLocalMediaPath(p);
            if (!isPathWithinRoots(local) || !fs.existsSync(local)) continue;
            const mtimeMs = fs.statSync(local).mtimeMs;
            videos.push({
                url: VIDEO_URL(p),
                name: path.basename(p),
                path: p,
                ageDays: Math.floor((Date.now() - mtimeMs) / 86_400_000),
            });
        }

        // Stills named in the body or in the assets, the Calendar Row's own
        // media (reel, cover, carousel slides), and — only when nothing local
        // resolved on this machine — the hosted copies the body names.
        const media: MediaRef[] = [];
        const known = new Set<string>(videos.map((v) => v.url));
        const add = (refs: MediaRef[]) => {
            for (const ref of refs) {
                if (known.has(ref.url)) continue;
                known.add(ref.url);
                media.push(ref);
            }
        };
        add(localImagesFromText([bodyText, ...locations].join("\n")));
        // Following ids named in the body costs a page read each: only the
        // editorial types earn it, questions keep their relation-only path.
        const type = propText(row.properties, "Type") || "other";
        const follow = EDITORIAL_LOOKUP_TYPES.has(type) ? bodyText : "";
        try { add(await calendarRowMedia(row.properties, follow, calendarMemo)); } catch { /* enrichment only */ }
        if (videos.length === 0 && media.length === 0) add(hostedMediaFromText(bodyText));

        return {
            rowId: row.id,
            url: row.url,
            title: propText(row.properties, "Item") || "(untitled)",
            type: propText(row.properties, "Type") || "other",
            status: propText(row.properties, "Status"),
            priority: propText(row.properties, "Priority") || "Normal",
            due: propText(row.properties, "Due"),
            correction: propText(row.properties, "Correction") || "",
            body: bodyText.slice(0, 700),
            videos,
            media,
        };
    });
}

/** Only rows that still wait on JJ: Pending, playable, gate-bound or fresh. */
export function wallFromDeskRows(deskRows: DeskRow[], freshDays = FRESH_DAYS): DeskRow[] {
    return deskRows.filter((r) => {
        if (r.status !== "Pending") return false;
        if (r.videos.length === 0) return false;
        const newestAge = Math.min(...r.videos.map((v) => v.ageDays));
        return r.type === "publish-approval" || newestAge <= freshDays;
    });
}

async function loadCalendarRows(): Promise<CalendarRow[]> {
    const rows = await queryAll(notionConfig.dbs.contentCalendar(), orStatus(ACTIVE_CALENDAR_STATES));
    return mapLimit(rows, NOTION_CONCURRENCY, async (row) => {
        const status = propText(row.properties, "Status");
        return {
            rowId: row.id,
            title: propText(row.properties, "Topic Title") || "(untitled)",
            contentType: propText(row.properties, "Content Type"),
            status,
            platforms: propText(row.properties, "Platform"),
            date: propText(row.properties, "Date"),
            variant: propText(row.properties, "Variant"),
            caption: propText(row.properties, "Caption") || "",
            hashtags: propText(row.properties, "Hashtags") || "",
            notes: propText(row.properties, "Notes") || "",
            sourceUrl: propText(row.properties, "Source URL"),
            createdAt: row.created_time,
            canva: propText(row.properties, "Canva Link"),
            hasAssets:
                relationIds(row.properties, "Media Assets").length > 0 ||
                Boolean(propText(row.properties, "Card URL")),
            // Inline media only where JJ decides (Review) — resolving assets
            // for every Draft row was most of the old load time.
            media: status === "Review" ? await resolveRowMedia(row.properties) : [],
            url: row.url,
        };
    });
}

async function loadWebsiteReview(warnings: string[]): Promise<WebsiteArticle[]> {
    let dbId: string;
    try {
        dbId = notionConfig.dbs.contentAssetHouse();
    } catch {
        warnings.push("NOTION_CONTENT_ASSET_DB non configurato — la sezione website è vuota.");
        return [];
    }
    const rows = await queryAll(dbId, orStatus(WEBSITE_REVIEW_STATES));
    const articles: WebsiteArticle[] = await mapLimit(rows, NOTION_CONCURRENCY, async (row) => {
        const fetched = await mapLimit(
            relationIds(row.properties, "Content Needs"),
            NOTION_CONCURRENCY,
            async (relId): Promise<WebsiteArticle["proposals"][number] | null> => {
                try {
                    const need = (await notion.pages.retrieve({ page_id: relId })) as PageObjectResponse;
                    const actionStatus = propText(need.properties, "Action Status");
                    if (actionStatus === "Done") return null;
                    return {
                        need: propText(need.properties, "Need") || "(untitled)",
                        details: (propText(need.properties, "Details") || "").slice(0, 500),
                        actionStatus,
                        url: need.url,
                    };
                } catch { return null; /* a missing need yields no proposal */ }
            }
        );
        const proposals = fetched.filter((p): p is WebsiteArticle["proposals"][number] => p !== null);
        const patch = findPatchForAsset(row.id);
        return {
            rowId: row.id,
            title: propText(row.properties, "Title") || "(untitled)",
            status: propText(row.properties, "Status"),
            category: propText(row.properties, "Medical Category"),
            reviewDue: propText(row.properties, "Review Due"),
            lastReviewed: propText(row.properties, "Last Reviewed"),
            liveUrl: propText(row.properties, "Live URL"),
            url: row.url,
            proposals,
            patch: patch ? {
                id: patch.id,
                title: patch.title || null,
                rationale: patch.rationale || null,
                sources: patch.sources || [],
                operations: operationViews(patch),
                sanityDocId: patch.sanityDocId,
                batch: patch.batch,
            } : null,
        };
    });

    // A card must stop asking for a decision once Sanity says the work is
    // done: draft carrying the patch → awaiting-publish; published carrying
    // it → dropped entirely.
    const patched = articles.filter((a) => a.patch);
    if (patched.length > 0) {
        const ids = patched.flatMap((a) => [a.patch!.sanityDocId, `drafts.${a.patch!.sanityDocId}`]);
        let docs: Record<string, unknown>[] = [];
        try {
            docs = await ggomedRawClient.fetch<Record<string, unknown>[]>("*[_id in $ids]", { ids });
        } catch (err) {
            warnings.push(`Verifica patch su Sanity fallita — le card tengono i bottoni (${err instanceof Error ? err.message : String(err)})`);
        }
        const byId = new Map(docs.map((d) => [d._id as string, d]));
        for (const a of patched) {
            const full: PreparedPatch | null = findPatchForAsset(a.rowId);
            if (!full) continue;
            const field = full.contentField || "content";
            const draft = byId.get(`drafts.${full.sanityDocId}`);
            const published = byId.get(full.sanityDocId);
            if (draft && patchAlreadyApplied(draft, full, field)) {
                a.patchState = "awaiting-publish";
                a.draftId = `drafts.${full.sanityDocId}`;
            } else if (published && patchAlreadyApplied(published, full, field)) {
                a.patchState = "published";
            }
        }
    }
    return articles.filter((a) => a.patchState !== "published");
}

/* ── Snapshot cache ──────────────────────────────────────────────────── */

const CACHE_TTL_MS = Number(process.env.REVIEW_DASHBOARD_CACHE_MS) || 5 * 60 * 1000;
let stateCache: { data: Omit<CancelloState, "cached">; at: number } | null = null;
let stateInflight: Promise<CancelloState> | null = null;

export function invalidateCancelloCache(): void { stateCache = null; }

export async function loadCancelloState({ refresh = false } = {}): Promise<CancelloState> {
    if (!refresh && stateCache && Date.now() - stateCache.at < CACHE_TTL_MS) {
        return { ...stateCache.data, cached: true };
    }
    // Concurrent callers (sidebar + page on the same navigation) share one
    // crawl instead of each starting their own.
    if (!refresh && stateInflight) return stateInflight;
    const promise = buildCancelloState().finally(() => { stateInflight = null; });
    if (!refresh) stateInflight = promise;
    return promise;
}

async function buildCancelloState(): Promise<CancelloState> {
    const warnings: string[] = [];
    const [desk, calendar, website] = await Promise.all([
        loadDeskRows(),
        loadCalendarRows(),
        loadWebsiteReview(warnings),
    ]);
    const selectedCalendar = selectCalendarRowsForGate(calendar);
    if (selectedCalendar.suppressed > 0) {
        warnings.push(
            `${selectedCalendar.suppressed} Story duplicate nascoste dal Cancello: stessa Source URL entro 30 giorni.`
        );
    }
    const data = {
        wall: wallFromDeskRows(desk),
        desk,
        calendar: selectedCalendar.rows,
        website,
        generatedAt: new Date().toISOString(),
        warnings,
    };
    stateCache = { data, at: Date.now() };
    return { ...data, cached: false };
}

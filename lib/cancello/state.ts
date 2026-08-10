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
    priority: string; due: string | null; correction: string; body: string; videos: VideoRef[];
}
export interface CalendarRow {
    rowId: string; title: string; contentType: string | null; status: string | null;
    platforms: string | null; date: string | null; variant: string | null;
    caption: string; hashtags: string; notes: string; canva: string | null;
    hasAssets: boolean; media: MediaRef[]; url: string;
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

const orStatus = (states: string[]) => ({
    or: states.map((s) => ({ property: "Status", select: { equals: s } })),
});

/* ── Media resolution ────────────────────────────────────────────────── */

const MEDIA_URL = (p: string) => `/media?path=${encodeURIComponent(p)}`;
const VIDEO_URL = (p: string) => `/video?path=${encodeURIComponent(p)}`;

async function fileLocationsOf(assetIds: string[]): Promise<string[]> {
    const locations: string[] = [];
    for (const id of assetIds) {
        try {
            const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
            const loc = propText(page.properties, "File Location");
            if (loc) locations.push(loc);
        } catch { /* a missing asset yields no media — not fatal */ }
    }
    return locations;
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

/* ── The three families ──────────────────────────────────────────────── */

async function loadDeskRows(): Promise<DeskRow[]> {
    const rows = await queryAll(
        notionConfig.dbs.ernestoDesk(),
        orStatus(OPEN_DESK_STATES),
        [{ property: "Priority", direction: "ascending" }]
    );
    const out: DeskRow[] = [];
    for (const row of rows) {
        let bodyText = "";
        try { bodyText = await pageBodyText(row.id); } catch { /* body is enrichment */ }

        const candidatePaths = extractVideoPaths(bodyText);
        for (const loc of await fileLocationsOf(relationIds(row.properties, "Media Assets"))) {
            candidatePaths.push(...extractVideoPaths(loc));
        }

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

        out.push({
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
        });
    }
    return out;
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
    const calendar: CalendarRow[] = [];
    for (const row of rows) {
        const status = propText(row.properties, "Status");
        calendar.push({
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
            canva: propText(row.properties, "Canva Link"),
            hasAssets:
                relationIds(row.properties, "Media Assets").length > 0 ||
                Boolean(propText(row.properties, "Card URL")),
            // Inline media only where JJ decides (Review) — resolving assets
            // for every Draft row was most of the old load time.
            media: status === "Review" ? await resolveRowMedia(row.properties) : [],
            url: row.url,
        });
    }
    return calendar;
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
    const articles: WebsiteArticle[] = [];
    for (const row of rows) {
        const proposals: WebsiteArticle["proposals"] = [];
        for (const relId of relationIds(row.properties, "Content Needs")) {
            try {
                const need = (await notion.pages.retrieve({ page_id: relId })) as PageObjectResponse;
                const actionStatus = propText(need.properties, "Action Status");
                if (actionStatus === "Done") continue;
                proposals.push({
                    need: propText(need.properties, "Need") || "(untitled)",
                    details: (propText(need.properties, "Details") || "").slice(0, 500),
                    actionStatus,
                    url: need.url,
                });
            } catch { /* a missing need yields no proposal */ }
        }
        const patch = findPatchForAsset(row.id);
        articles.push({
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
        });
    }

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

export function invalidateCancelloCache(): void { stateCache = null; }

export async function loadCancelloState({ refresh = false } = {}): Promise<CancelloState> {
    if (!refresh && stateCache && Date.now() - stateCache.at < CACHE_TTL_MS) {
        return { ...stateCache.data, cached: true };
    }
    const warnings: string[] = [];
    const desk = await loadDeskRows();
    const calendar = await loadCalendarRows();
    const website = await loadWebsiteReview(warnings);
    const data = {
        wall: wallFromDeskRows(desk),
        desk,
        calendar,
        website,
        generatedAt: new Date().toISOString(),
        warnings,
    };
    stateCache = { data, at: Date.now() };
    return { ...data, cached: false };
}

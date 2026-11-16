/**
 * Linked Notion pages (Media Assets, Content Needs, Calendar rows a desk row
 * points at), kept from one Cancello crawl to the next.
 *
 * Re-reading every linked page one request at a time was ~80% of a crawl
 * (1,052 of 1,286 requests, ~8.5 min at Notion's pace, measured 2026-11-16).
 * Freshness is not traded for it: before each crawl, one "edited since"
 * query per source database returns the pages that changed, and those
 * replace their cached copies. A database that cannot be checked drops its
 * pages; nothing is kept past a maximum age. Desk, Calendar and website rows
 * themselves are never served from here — their own queries read them fresh.
 */
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/** Pages of `databaseId` edited on or after `sinceIso` (every page of results). */
export type ChangedSince = (databaseId: string, sinceIso: string) => Promise<PageObjectResponse[]>;

type Entry = { page: PageObjectResponse; fetchedAt: number } | { missingUntil: number };

export interface PageCacheOptions {
    maxEntries?: number;
    /** Hard ceiling on any cached page, checked or not. */
    maxAgeMs?: number;
    /** How long a page Notion does not share (404) is not asked for again. */
    missTtlMs?: number;
    /** Notion rounds last_edited_time to the minute and indexes with a lag. */
    marginMs?: number;
    now?: () => number;
}

const bare = (id: string) => id.replace(/-/g, "").toLowerCase();
const parentOf = (page: PageObjectResponse): string | null =>
    page.parent?.type === "database_id" ? bare(page.parent.database_id) : null;

export function createPageCache({
    maxEntries = 5000,
    maxAgeMs = 6 * 60 * 60_000,
    missTtlMs = 30 * 60_000,
    marginMs = 5 * 60_000,
    now = Date.now,
}: PageCacheOptions = {}) {
    const entries = new Map<string, Entry>();
    /** Per source database: when its pages were last confirmed current. */
    const checkedAt = new Map<string, number>();
    let generation = 0;

    const put = (key: string, entry: Entry) => {
        entries.delete(key);
        entries.set(key, entry);
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    };

    return {
        /** Forget everything (an explicit full re-read). */
        clear() {
            generation += 1;
            entries.clear();
            checkedAt.clear();
        },
        /** A decision landed: crawls already running may neither read nor write. */
        fence() {
            generation += 1;
        },
        async validate(changedSince: ChangedSince): Promise<void> {
            const before = generation;
            const started = now();
            const oldest = new Map<string, number>();
            for (const [key, entry] of entries) {
                if ("missingUntil" in entry) {
                    if (entry.missingUntil <= started) entries.delete(key);
                    continue;
                }
                if (started - entry.fetchedAt > maxAgeMs) {
                    entries.delete(key);
                    continue;
                }
                const db = parentOf(entry.page)!;
                oldest.set(db, Math.min(oldest.get(db) ?? Infinity, entry.fetchedAt));
            }
            await Promise.all([...oldest].map(async ([db, fetchedAt]) => {
                const since = (checkedAt.get(db) ?? fetchedAt) - marginMs;
                let changed: PageObjectResponse[];
                try {
                    changed = await changedSince(db, new Date(since).toISOString());
                } catch {
                    // Unknown freshness: read these pages again.
                    for (const [key, entry] of entries) {
                        if (!("missingUntil" in entry) && parentOf(entry.page) === db) entries.delete(key);
                    }
                    checkedAt.delete(db);
                    return;
                }
                // A check that straddles a decision may describe the world before it.
                if (generation !== before) return;
                for (const page of changed) {
                    const key = bare(page.id);
                    if (entries.has(key)) put(key, { page, fetchedAt: started });
                }
                checkedAt.set(db, started);
            }));
        },
        /** Bound to the crawl that creates it: a fence cuts it off. */
        reader() {
            const before = generation;
            return {
                get(id: string): PageObjectResponse | "missing" | undefined {
                    if (before !== generation) return undefined;
                    const key = bare(id);
                    const entry = entries.get(key);
                    if (!entry) return undefined;
                    if ("missingUntil" in entry) {
                        if (entry.missingUntil > now()) return "missing";
                        entries.delete(key);
                        return undefined;
                    }
                    if (now() - entry.fetchedAt > maxAgeMs) {
                        entries.delete(key);
                        return undefined;
                    }
                    return entry.page;
                },
                /** `fetchedAt`: when the read was sent, so the next check covers it. */
                store(page: PageObjectResponse, fetchedAt: number) {
                    if (before !== generation || !parentOf(page)) return;
                    put(bare(page.id), { page, fetchedAt });
                },
                storeMissing(id: string) {
                    if (before !== generation) return;
                    put(bare(id), { missingUntil: now() + missTtlMs });
                },
            };
        },
    };
}

export type PageCache = ReturnType<typeof createPageCache>;
export type PageCacheReader = ReturnType<PageCache["reader"]>;

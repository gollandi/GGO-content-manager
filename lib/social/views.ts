/**
 * Pure helpers for the social media manager's read-only rooms (Performance,
 * Website). Kept out of the page files: Next.js allows a page only its own
 * exports.
 */
import type { PerformanceSnapshotRow } from "../notion/editorial";
import type { ContentItem } from "../notion/types";

export const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

export function summariseWeek(rows: PerformanceSnapshotRow[]) {
    const weeks = [...new Set(rows.map((r) => day(r.weekOf)).filter((w) => w !== "—"))].sort().reverse();
    const latest = weeks[0] ?? null;
    const bySource = new Map<string, { rows: number; impressions: number; clicks: number; sessions: number }>();
    for (const r of rows) {
        if (day(r.weekOf) !== latest) continue;
        const key = r.source || r.channel || "Other";
        const acc = bySource.get(key) ?? { rows: 0, impressions: 0, clicks: 0, sessions: 0 };
        acc.rows += 1;
        acc.impressions += r.impressions ?? 0;
        acc.clicks += r.clicks ?? 0;
        acc.sessions += r.sessions ?? 0;
        bySource.set(key, acc);
    }
    return { latest, weeks, bySource: [...bySource.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
}

const SITE = "https://www.ggomed.co.uk";

export function pageUrl(slug: string): string | null {
    const s = slug.trim();
    if (!s) return null;
    if (/^https?:\/\//.test(s)) return s.startsWith(SITE) ? s : null;
    return `${SITE}/${s.replace(/^\/+/, "")}`;
}

export function filterPages<T extends PublicPage>(items: T[], term: string, status: string): T[] {
    const t = term.trim().toLowerCase();
    return items
        .filter((i) => (status === "All" || i.status === status) && (!t || i.title.toLowerCase().includes(t) || i.slug.toLowerCase().includes(t)))
        .sort((a, b) => a.title.localeCompare(b.title));
}

/** A registry row as the social role sees it: no reviewers, relations or notes. */
export type PublicPage = Pick<ContentItem, "id" | "title" | "contentType" | "status" | "slug" | "lastReviewed" | "lastEditedTime">;

export function toPublicPage(i: ContentItem): PublicPage {
    return { id: i.id, title: i.title, contentType: i.contentType, status: i.status, slug: i.slug, lastReviewed: i.lastReviewed, lastEditedTime: i.lastEditedTime };
}

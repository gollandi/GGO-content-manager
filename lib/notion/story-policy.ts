export const STORY_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normaliseSourceUrl(value: string): string {
    try {
        const url = new URL(value);
        url.hash = "";
        url.search = "";
        url.pathname = url.pathname.replace(/\/+$/, "") || "/";
        return url.toString().replace(/\/$/, "").toLowerCase();
    } catch {
        return value.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
    }
}

export interface StoryPolicyRow {
    contentType: string | null;
    sourceUrl: string | null;
    createdAt: string;
}

/**
 * Keep the first active Story for an article in each 30-day window. This is a
 * defensive read rail for historical duplicates; creation-time checks remain
 * the authoritative write rail.
 */
export function selectCalendarRowsForGate<T extends StoryPolicyRow>(
    rows: T[],
    cooldownDays = STORY_COOLDOWN_DAYS
): { rows: T[]; suppressed: number } {
    const ordered = rows
        .map((row, index) => ({ row, index, createdAt: new Date(row.createdAt).getTime() }))
        .sort((a, b) => {
            if (!Number.isFinite(a.createdAt)) return 1;
            if (!Number.isFinite(b.createdAt)) return -1;
            return a.createdAt - b.createdAt || a.index - b.index;
        });
    const lastAccepted = new Map<string, number>();
    const acceptedIndexes = new Set<number>();
    let suppressed = 0;

    for (const item of ordered) {
        const isStory = item.row.contentType?.trim().toLowerCase() === "story";
        const source = item.row.sourceUrl ? normaliseSourceUrl(item.row.sourceUrl) : "";
        if (!isStory || !source || !Number.isFinite(item.createdAt)) {
            acceptedIndexes.add(item.index);
            continue;
        }
        const previous = lastAccepted.get(source);
        if (previous !== undefined && item.createdAt - previous < cooldownDays * DAY_MS) {
            suppressed += 1;
            continue;
        }
        lastAccepted.set(source, item.createdAt);
        acceptedIndexes.add(item.index);
    }

    return { rows: rows.filter((_, index) => acceptedIndexes.has(index)), suppressed };
}

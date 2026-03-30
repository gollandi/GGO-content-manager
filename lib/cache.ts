/**
 * Simple in-memory TTL cache with stale-while-revalidate.
 *
 * Since Notion data is updated ~weekly, we cache aggressively (1 hour default)
 * and serve stale data while refreshing in the background.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    refreshing: boolean;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // serve stale up to 24 hours

export async function cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
    const now = Date.now();
    const entry = store.get(key) as CacheEntry<T> | undefined;

    // Fresh hit — return immediately
    if (entry && now - entry.timestamp < ttlMs) {
        return entry.data;
    }

    // Stale hit — return stale data, refresh in background
    if (entry && now - entry.timestamp < STALE_TTL_MS && !entry.refreshing) {
        entry.refreshing = true;
        fetcher()
            .then((data) => {
                store.set(key, { data, timestamp: Date.now(), refreshing: false });
            })
            .catch((err) => {
                console.error(`[cache] Background refresh failed for "${key}":`, err);
                entry.refreshing = false;
            });
        return entry.data;
    }

    // Miss or expired beyond stale window — fetch synchronously
    const data = await fetcher();
    store.set(key, { data, timestamp: Date.now(), refreshing: false });
    return data;
}

/**
 * Invalidate one or all cache entries.
 */
export function invalidateCache(key?: string): void {
    if (key) {
        store.delete(key);
    } else {
        store.clear();
    }
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): { key: string; ageSeconds: number; stale: boolean }[] {
    const now = Date.now();
    return Array.from(store.entries()).map(([key, entry]) => ({
        key,
        ageSeconds: Math.round((now - entry.timestamp) / 1000),
        stale: now - entry.timestamp > DEFAULT_TTL_MS,
    }));
}

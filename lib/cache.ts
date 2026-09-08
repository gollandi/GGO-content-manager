/**
 * Simple in-memory TTL cache with stale-while-revalidate.
 *
 * Since Notion data is updated ~weekly, we cache aggressively (1 hour default)
 * and serve stale data while refreshing in the background.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttlMs: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // serve stale up to 24 hours

function startFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    // Register before calling the fetcher, including one that throws synchronously.
    // The promise identity also fences work invalidated by an editorial change.
    const promise = Promise.resolve().then(fetcher)
        .then((data) => {
            if (inflight.get(key) === promise) {
                store.set(key, { data, timestamp: Date.now(), ttlMs });
            }
            return data;
        })
        .finally(() => {
            if (inflight.get(key) === promise) inflight.delete(key);
        });
    inflight.set(key, promise);
    return promise;
}

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
    if (entry && now - entry.timestamp < STALE_TTL_MS) {
        if (!inflight.has(key)) {
            void startFetch(key, fetcher, ttlMs).catch((err) => {
                console.error(`[cache] Background refresh failed for "${key}":`, err);
            });
        }
        // Every reader gets stale data immediately, including readers arriving
        // during the refresh. They must not start a second, blocking fetch.
        return entry.data;
    }

    // Miss or expired beyond stale window — fetch synchronously, but share a
    // single in-flight fetch across concurrent callers (no thundering herd).
    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    return startFetch(key, fetcher, ttlMs);
}

/**
 * Invalidate one or all cache entries.
 */
export function invalidateCache(key?: string): void {
    if (key) {
        store.delete(key);
        inflight.delete(key);
    } else {
        store.clear();
        inflight.clear();
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
        stale: now - entry.timestamp >= entry.ttlMs,
    }));
}

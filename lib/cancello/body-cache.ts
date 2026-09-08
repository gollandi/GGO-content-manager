/**
 * Body reads dominate the Desk crawl. Revalidate against the page revision
 * returned by each fresh database query; never reuse media locations or status.
 * This is a display cache, not proof of approval or an immutable content hash.
 */
export function createBodyCache({ maxEntries = 512, ttlMs = 30 * 60_000 } = {}) {
    const entries = new Map<string, { revision: string; text: string; at: number }>();
    let generation = 0;
    return {
        clear() {
            generation += 1;
            entries.clear();
        },
        reader(fresh = false) {
            // Capture at crawl creation, not at each row: an invalidated crawl
            // may still have rows waiting behind the bounded concurrency gate.
            const before = generation;
            return async (id: string, revision: string, fetcher: () => Promise<string>) => {
                const cached = entries.get(id);
                const validRevision = typeof revision === "string" && Number.isFinite(Date.parse(revision));
                if (before === generation && !fresh && validRevision && cached?.revision === revision && Date.now() - cached.at < ttlMs) {
                    entries.delete(id);
                    entries.set(id, cached);
                    return cached.text;
                }
                const text = await fetcher();
                // Never retain failed/unknown reads, oversized bodies or a response
                // that was in flight when a decision invalidated the cache.
                if (validRevision && before === generation && text.length <= 20_000) {
                    entries.delete(id);
                    entries.set(id, { revision, text, at: Date.now() });
                    while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
                }
                return text;
            };
        },
    };
}

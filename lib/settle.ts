/**
 * Defensive fetch wrapper for the cockpit's server pages: a missing env id
 * or an upstream failure degrades to a labelled panel, never a crashed page.
 */
export interface Settled<T> {
    data: T | null;
    error: string | null;
}

export async function settle<T>(fetcher: () => Promise<T>): Promise<Settled<T>> {
    try {
        return { data: await fetcher(), error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

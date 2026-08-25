/**
 * Retry-on-429 fetch wrapper for the Notion client.
 *
 * Notion allows an average of ~3 requests/second per integration and rejects
 * bursts with a 429 whose body reads "You have been rate limited. Please try
 * again in a few minutes." The SDK does not retry, so without this wrapper
 * that raw message surfaces in the cockpit UI.
 *
 * Policy: retry ONLY on 429 — a 429 is guaranteed not to have executed, so
 * retrying is safe for writes (Cancello decisions, Desk deposits). 5xx
 * responses are returned as-is: Notion queries go over POST, and a retried
 * 5xx write could execute twice.
 *
 * A small concurrency gate smooths the Promise.all fan-outs (pulse,
 * operations, editorial) that trip the limit in the first place. The gate
 * slot is held while backing off, so a rate-limited response also slows the
 * queue behind it.
 */

type MinimalResponse = {
    status: number;
    headers: { get(name: string): string | null };
};

export type NotionRetryOptions = {
    /** Retries after the first attempt (default 3). */
    maxRetries?: number;
    /** First backoff delay; doubles per attempt (default 400ms). */
    baseDelayMs?: number;
    /** Cap on any single wait, including Retry-After (default 5000ms). */
    maxDelayMs?: number;
    /** Requests in flight at once (default 4). */
    maxConcurrent?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const createGate = (limit: number) => {
    let active = 0;
    const waiting: Array<() => void> = [];
    return {
        acquire: () =>
            new Promise<void>((resolve) => {
                if (active < limit) {
                    active += 1;
                    resolve();
                } else {
                    waiting.push(() => {
                        active += 1;
                        resolve();
                    });
                }
            }),
        release: () => {
            active -= 1;
            waiting.shift()?.();
        },
    };
};

/** Wait suggested by the server, in ms — or null when absent/unparsable. */
const retryAfterMs = (response: MinimalResponse): number | null => {
    const header = response.headers.get("retry-after");
    if (!header) return null;
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
};

export const withNotionRetry = <Init, Res extends MinimalResponse>(
    baseFetch: (url: string, init?: Init) => Promise<Res>,
    options: NotionRetryOptions = {},
): ((url: string, init?: Init) => Promise<Res>) => {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 400;
    const maxDelayMs = options.maxDelayMs ?? 5000;
    const gate = createGate(options.maxConcurrent ?? 4);

    return async (url, init) => {
        await gate.acquire();
        try {
            let response = await baseFetch(url, init);
            for (let attempt = 0; response.status === 429 && attempt < maxRetries; attempt += 1) {
                const backoff = baseDelayMs * 2 ** attempt * (1 + Math.random() * 0.25);
                await sleep(Math.min(retryAfterMs(response) ?? backoff, maxDelayMs));
                response = await baseFetch(url, init);
            }
            return response;
        } finally {
            gate.release();
        }
    };
};

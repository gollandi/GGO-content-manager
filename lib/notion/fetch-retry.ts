/**
 * Pace Notion requests, with one shared cooldown after upstream throttling.
 * Concurrency alone does not enforce a request rate. Retry only explicit
 * rate-limit/overload responses; never replay an ambiguous write failure.
 */

type MinimalResponse = {
    status: number;
    headers: { get(name: string): string | null };
};

export type NotionRetryOptions = {
    maxRetries?: number;
    baseDelayMs?: number;
    /** Cap the fallback backoff only, never the server's Retry-After. */
    maxDelayMs?: number;
    maxConcurrent?: number;
    /** Minimum spacing between every attempt, including retries (default 400ms). */
    minIntervalMs?: number;
    /** Entire request, queue and retries included; below the SDK's 60s timeout. */
    maxDurationMs?: number;
};

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const aborted = () => {
        clearTimeout(timer);
        reject(signal.reason);
    };
    const timer = setTimeout(() => {
        signal.removeEventListener("abort", aborted);
        resolve();
    }, ms);
    signal.addEventListener("abort", aborted, { once: true });
});

const createGate = (limit: number) => {
    let active = 0;
    const waiting: Array<() => void> = [];
    return {
        acquire: (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
            signal.throwIfAborted();
            const grant = () => {
                signal.removeEventListener("abort", aborted);
                active += 1;
                resolve();
            };
            const aborted = () => {
                const index = waiting.indexOf(grant);
                if (index !== -1) waiting.splice(index, 1);
                reject(signal.reason);
            };
            if (active < limit) grant();
            else {
                waiting.push(grant);
                signal.addEventListener("abort", aborted, { once: true });
            }
        }),
        release: () => {
            active -= 1;
            waiting.shift()?.();
        },
    };
};

const retryAfterMs = (response: MinimalResponse): number | null => {
    const header = response.headers.get("retry-after");
    if (!header?.trim()) return null;
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
    const minIntervalMs = options.minIntervalMs ?? 400;
    const maxDurationMs = options.maxDurationMs ?? 45_000;
    const maxConcurrent = options.maxConcurrent ?? 4;
    for (const value of [maxRetries, baseDelayMs, maxDelayMs, minIntervalMs]) {
        if (!Number.isFinite(value) || value < 0) throw new Error("Invalid Notion retry configuration");
    }
    if (!Number.isInteger(maxRetries) || !Number.isInteger(maxConcurrent) || maxConcurrent < 1 || !Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
        throw new Error("Invalid Notion retry configuration");
    }
    const gate = createGate(maxConcurrent);
    let nextStart = 0;
    let cooldownUntil = 0;
    let turn = Promise.resolve();

    const waitForStart = (signal: AbortSignal) => {
        const pending = turn.then(async () => {
            signal.throwIfAborted();
            // Another in-flight response may extend the cooldown while we wait.
            let delay = Math.max(nextStart, cooldownUntil) - Date.now();
            while (delay > 0) {
                await sleep(delay, signal);
                delay = Math.max(nextStart, cooldownUntil) - Date.now();
            }
            signal.throwIfAborted();
            nextStart = Date.now() + minIntervalMs;
        });
        turn = pending.catch(() => {});
        return pending;
    };

    return async (url, init) => {
        const controller = new AbortController();
        const callerSignal = (init as { signal?: AbortSignal | null } | undefined)?.signal;
        const abort = () => controller.abort(callerSignal?.reason);
        if (callerSignal?.aborted) abort();
        else callerSignal?.addEventListener("abort", abort, { once: true });
        const timeout = setTimeout(() => controller.abort(new DOMException("Notion request deadline exceeded", "TimeoutError")), maxDurationMs);
        let acquired = false;
        try {
            await gate.acquire(controller.signal);
            acquired = true;
            for (let attempt = 0; ; attempt += 1) {
                await waitForStart(controller.signal);
                const response = await baseFetch(url, { ...init, signal: controller.signal } as Init);
                if (response.status !== 429 && response.status !== 529) return response;
                const fallback = Math.min(baseDelayMs * 2 ** attempt * (1 + Math.random() * 0.25), maxDelayMs);
                cooldownUntil = Math.max(cooldownUntil, Date.now() + (retryAfterMs(response) ?? fallback));
                // An exhausted request still communicates its cooldown to others.
                // Aborted/expired work is never dispatched later.
                if (attempt >= maxRetries) return response;
            }
        } finally {
            clearTimeout(timeout);
            callerSignal?.removeEventListener("abort", abort);
            if (acquired) gate.release();
        }
    };
};

/**
 * Client-side reading of a failed Cancello state request: whether the page
 * should ask again by itself. Pure, so both registers (Il Cancello, Le
 * Questioni) and their tests share one rule.
 */

/** The default wait when the server names none. */
export const STATE_RETRY_SECONDS = 30;

/** The state is still being rebuilt (the route's 25 s deadline passed), or
 *  the proxy answered for a service that is restarting. */
export function isTransientStateFailure(status: number, body: { code?: string } | null | undefined): boolean {
    return (status === 503 && body?.code === "CANCELLO_STATE_TIMEOUT") || status === 502 || status === 504;
}

/** Seconds to wait before asking again, from Retry-After when it is usable. */
export function retryAfterSeconds(header: string | null): number {
    const n = Number(header);
    return Number.isFinite(n) && n > 0 ? n : STATE_RETRY_SECONDS;
}

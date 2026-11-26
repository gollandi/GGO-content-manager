/**
 * Password guessing brake for the credentials sign-in. A second internet-
 * facing account with a human-chosen password raises the exposure, and the
 * cockpit has no rate limit in front of /api/auth/callback/credentials.
 *
 * Collaborators only (the owner is never throttled: anyone knowing his
 * address could otherwise lock him out). In-process and per address: after MAX_FAILURES wrong passwords within
 * WINDOW_MS the address is refused (even with the right password) until the
 * window has passed. It resets on restart — a brake, not a lock.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const globals = globalThis as typeof globalThis & { __ggoSignInFailures?: Map<string, number[]> };
const failures: Map<string, number[]> = globals.__ggoSignInFailures ??= new Map();

function recent(email: string, at: number): number[] {
    const list = (failures.get(email) ?? []).filter((t) => at - t < WINDOW_MS);
    if (list.length) failures.set(email, list); else failures.delete(email);
    return list;
}

export function signInThrottled(email: string, at = Date.now()): boolean {
    return recent(email, at).length >= MAX_FAILURES;
}

/** Addresses tracked at most; random addresses must not grow the map without end. */
const MAX_TRACKED = 1000;

export function noteSignInFailure(email: string, at = Date.now()): void {
    if (!failures.has(email) && failures.size >= MAX_TRACKED) {
        for (const key of [...failures.keys()]) recent(key, at);
        // Still full of live entries: drop the oldest-tracked address.
        if (failures.size >= MAX_TRACKED) failures.delete(failures.keys().next().value as string);
    }
    failures.set(email, [...recent(email, at), at]);
}

export function resetSignInThrottle(): void {
    failures.clear();
}

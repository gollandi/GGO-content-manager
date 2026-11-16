/**
 * Read the Cancello state for the media-sync job.
 *
 * The state route answers within ~25 s: when the crawl behind it takes
 * longer it says so (503 CANCELLO_STATE_TIMEOUT) and keeps crawling, and the
 * finished state is kept for a few minutes. So ask again, honouring
 * Retry-After, until it lands or the deadline passes — instead of one request
 * that outlives Node's 300 s header timeout.
 *
 * Resolves with the state; rejects with an Error whose message is one line
 * fit for the job's log (never a response body: it may carry content).
 */
export async function readState({
    url,
    token,
    deadlineMs = 15 * 60 * 1000,
    requestTimeoutMs = 120_000,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => Date.now(),
}) {
    const started = now();
    for (let attempt = 1; ; attempt += 1) {
        let res;
        try {
            res = await fetchImpl(url, {
                headers: { authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(requestTimeoutMs),
            });
        } catch (err) {
            // Unreachable, or silent past the request timeout.
            throw new Error(`state read failed (${err?.cause?.code ?? err?.name ?? "error"}, attempt ${attempt})`);
        }
        if (res.ok) return res.json();
        const body = await res.json().catch(() => ({}));
        const waitS = Number(res.headers.get("retry-after")) || 30;
        const rebuilding = res.status === 503 && body.code === "CANCELLO_STATE_TIMEOUT";
        if (!rebuilding || now() - started + waitS * 1000 > deadlineMs) {
            throw new Error(`state read failed (HTTP ${res.status}${body.code ? ` ${body.code}` : ""}, attempt ${attempt})`);
        }
        await sleep(waitS * 1000);
    }
}

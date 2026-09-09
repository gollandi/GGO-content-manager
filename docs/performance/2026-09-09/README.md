# Remaining loading delay: deployment verification and request pacing

## Verified on the VPS

The loading fix in PR #28 was merged and deployed on 8 September 2026. A later successful deployment of `b4f719c8b651c1c6b0f5544e34391e655b07a9ae` includes it. On 9 September the live source hashes for `lib/cache.ts`, `lib/cancello/state.ts`, `lib/cancello/body-cache.ts` and `app/questioni/page.tsx` matched that repository revision. The service was active; load was 0.01 / 0.00 / 0.00 and 14,127 MiB RAM was available.

Authenticated, read-only VPS-local requests returned:

| Request | Elapsed | State |
| --- | ---: | --- |
| Review dashboard state | 18 ms | Cached; 234 Desk, 66 calendar, 28 website rows |
| Immediate repeat | 12 ms | Cached |
| Editorial content view | 7 ms | HTTP 200 |

These hot-cache checks do not measure the user's first page load. The earlier deployment health check only proved that `/login` responded. It did not establish that the slow-loading report had been resolved.

A separate, instrumented read-only process loaded the installed `getHouseState` code with an empty process cache. At 60 seconds it had not completed: it had recorded 29 successful Notion requests and 56 HTTP 429 responses. The diagnostic was stopped to avoid continued upstream pressure. No user content, authentication values, production session, or response bodies were recorded. These are observations of an isolated loader against real upstream data, not an authenticated browser trace. Other consumers may also share the integration/workspace budget.

The home page awaits this aggregate loader. It gathers nine sources, including the full Cancello read. The existing request wrapper capped concurrency at four but did not pace starts, did not pause unrelated queued requests when throttled, and shortened a server `Retry-After` to at most five seconds. Its previous unit test explicitly asserted that shortening.

## Implemented correction

The shared wrapper now spaces attempts by at least 400 ms, including retries. A 429 or explicit 529 overload response updates a common cooldown, even if the initiating request has exhausted its retry allowance. Server `Retry-After` is honoured in full; the five-second cap applies only to calculated fallback delays. These behaviours follow Notion's [request-limit guidance](https://developers.notion.com/reference/request-limits).

Each logical request has a 45-second deadline covering queueing, fetch and retry waits. This is below the installed SDK's default 60-second timeout. Deadline/caller cancellation removes waiting semaphore entries, reaches the fetch transport, and is checked before dispatch; work must not execute later after its caller has given up. Network errors, other 5xx responses and ambiguous write failures are not automatically replayed. An aborted in-flight write is not proof that the server performed no effect; existing reconciliation requirements remain.

The limiter belongs to one wrapper instance. It does not coordinate other Node processes, the Mac, ETL or separate integrations. Their aggregate budget still needs the shared scheduler from the VPS execution plan. Pacing protects the upstream service; it does not make hundreds of necessary requests instantaneous.

## Validation and limits

- Full suite: 183 passed, 5 skipped, 0 failed (188 total).
- Default Next 16.2.3 production build and its TypeScript checks passed. Existing middleware/root/trace warnings remain.
- Fake-clock tests cover six requests spaced at 400 ms, a server-requested 12-second wait despite a 2 ms fallback cap, shared cooldown after exhausted retries, explicit overload, bounded attempts, cancellation and no delayed dispatch of an expired write.
- Production code was inspected but not changed by this task. This new correction is not yet deployed; its production latency impact is NOT MEASURED.
- No authenticated browser trace was captured. The user's precise slow screen remains unconfirmed.

Durable background snapshots, progressive source loading and reducing initial body enrichment remain separate required work for consistently fast cold navigation. The previous body cache improves repeated snapshots within its lifetime; it does not eliminate the first full Notion crawl. Human review and publication authority are unchanged.

# Content Manager loading investigation

Base: `350823907b9f6b138fe760b9c8978dae129c7614`. Investigation date: 8 September 2026.

## Observed production baseline

Read-only measurements against the running cockpit, before these changes:

| Request | Time | Observation |
| --- | ---: | --- |
| Public `/login` | 0.288 s | HTTP 200 |
| VPS-local `/login` | 0.006 s | HTTP 200 |
| VPS-local `/api/review-dashboard/state`, expired/empty snapshot | 37.663 s | HTTP 200, `cached: false` |
| Immediate repeat of the same state request | 0.014 s | HTTP 200, `cached: true` |

The state response contained 233 Desk rows, 66 calendar rows and 28 website items, about 392 KB. VPS load was 0.04 / 0.01 / 0.00, with about 14 GiB available RAM. This sample points to upstream reads during snapshot construction, rather than CPU or memory pressure. It is a single diagnostic sample, not a latency distribution. The 14 ms cached response is **existing behaviour**, not a measured result of this patch.

The state builder fetched every Desk body on every snapshot expiry, including unchanged rows, and retrieved shared related pages repeatedly. The common cache also sent later stale readers down a blocking fetch path while the first reader refreshed in the background. On Le Questioni, `Promise.all` held back an already available Desk response until the house summary responded.

No credentials, session tokens or production content are included in these artefacts. Production was not modified.

## Changes and freshness boundaries

- Cache Desk bodies by page ID and the `last_edited_time` returned by each fresh database query. Bound storage to 512 entries, 20,000 characters per body and a 30-minute body-entry lifetime. Statuses and relations are queried again on every snapshot rebuild; media locations are not cached across rebuilds.
- Share related-page reads within each rebuild, including concurrent references and pages already returned by database queries. Local-media existence and path checks still run.
- Preserve the full-state cache's existing five-minute default. Explicit refresh bypasses the body cache. Concurrent explicit refreshes share a single fresh rebuild.
- Return stale common-cache data immediately to every concurrent reader while one background refresh runs, within the existing stale window. Fence pending requests on invalidation so an old response cannot restore invalidated entries or clear a newer request's slot. Apply the same protection to Cancello snapshots and queued body reads.
- Render Questioni and house signals independently; label summary failures separately and abort superseded requests and requests on navigation away.
- Remove a pre-existing unsupported named export from the media Route Handler, which failed Next's production type validation. The legacy video route delegates to the same `GET` handler. Its authentication, path and streaming logic is unchanged.

This is a display cache. A Notion timestamp is not an immutable approval digest. No decision, publishing, role or authentication guard is relaxed or replaced by cached evidence. The separate pipeline approval integration must continue to bind final human review to the selected content revision.

The first rebuild after process start, after body expiry, and an explicit full refresh can still be expensive. This patch does not establish production latency after deployment. There is no persistent snapshot or VPS sizing change.

## Reproducible request-volume check

`__tests__/cancello-loading.test.ts` uses 233 synthetic Desk rows, one body request per row, one shared media asset, realistic 100-row pagination, and empty calendar/website databases. These counts are fixture assertions, not production traffic estimates:

| Notion calls per rebuild | Original code | New first rebuild | New unchanged rebuild | New rebuild with one edited row |
| --- | ---: | ---: | ---: | ---: |
| Database queries | 5 | 5 | 5 | 5 |
| Body reads | 233 | 233 | 0 | 1 |
| Shared asset retrievals | 233 | 1 | 1 | 1 |
| Total | 471 | 239 | 6 | 7 |

The unchanged rebuild is after the five-minute snapshot expires but within the body-entry lifetime. Explicit refresh re-reads all 233 bodies. A separate test preserves linked calendar previews while reusing query results.

## Validation

- Full Vitest suite: **162 passed, 5 skipped, 0 failed**, 167 tests total. The skipped tests remain skipped; they are not claimed as evidence.
- TypeScript check passed. Production builds passed with both default Turbopack and Webpack on Next 16.2.3. Existing root/middleware/trace warnings remain.
- Running the same cache, Cancello and Questioni regression tests against unchanged base code produced **13 expected failures**; see `baseline-regressions.json`. The new standalone body-cache tests cannot run against a base which lacks that module.
- Production-build browser fixture: desktop 1280×900 and mobile 390×844. The question became visible 27 ms and 19 ms after the mocked Desk request started, while the house response was deliberately delayed 2,500 ms. No page errors or horizontal overflow. These are local fixture timings, not total page-load or live API latency. See `browser-check.json` and the screenshots.
- GitNexus upstream impact was checked before edits (`impact-before.json`). Shared cache and media traversal have high/critical caller reach; the regression tests cover concurrent reads, invalidation, edited revisions and media preservation.
- The approved pipeline cockpit patch applies cleanly with `git apply --check`. This checks textual compatibility only: the rollout manifest's pinned base/tree revisions still require reconciliation and review. It does not authorise a rollout or bypass its integrity checks.

Run the code checks with:

```sh
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

To reproduce the browser fixture, use an isolated checkout without production environment files. Build first, then start locally:

```sh
AUTH_SECRET=content-manager-local-fixture-only \
AUTH_URL=http://127.0.0.1:3112/api/auth \
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3112
```

In another terminal, run `node tools/performance/verify-browser.mjs`. Playwright must be available; `PLAYWRIGHT_MODULE` can point to its module and `CHROME_BIN` to a local Chrome executable. The script accepts only a loopback origin, blocks external requests, and supplies all API data from fixtures. The explicit `/api/auth` URL avoids the existing production-auth normalisation of a bare localhost origin. The fixture secret is deliberately public and must never be used for deployment.

## Review and deployment

JJ review is required before final merge. The repository's existing workflow deploys pushes to `main`; this feature branch does not deploy. Content publication continues to require human review.

After an approved deployment, compare multiple expired-snapshot reads and ordinary navigation against the baseline, then confirm explicit refresh and decisions still return current data. Production verification is **NOT RUN**. Roll back through a reviewed revert of this commit if necessary; there is no data migration.

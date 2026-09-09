# VPS cockpit: persistent snapshots and background refresh

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

The production Notion client is shared across Next route bundles in one server process, so those routes share its limiter. It does not coordinate other Node processes, the Mac, ETL or separate integrations. Their aggregate budget still needs the shared scheduler from the VPS execution plan. Pacing protects the upstream service; it does not make hundreds of necessary requests instantaneous.

## Validation and limits

- Full suite: 197 passed, 5 skipped, 0 failed (202 total).
- Default Next 16.2.3 production build and its TypeScript checks passed. Existing middleware/root/trace warnings remain.
- Fake-clock tests cover six requests spaced at 400 ms, a server-requested 12-second wait despite a 2 ms fallback cap, shared cooldown after exhausted retries, explicit overload, bounded attempts, cancellation and no delayed dispatch of an expired write.
- Production latency for this new correction is NOT MEASURED until the deployment and restart checks below are executed.
- No authenticated browser trace was captured. The user's precise slow screen remains unconfirmed.

## Persistent projections and VPS preparation

With `COCKPIT_SNAPSHOT_DIR` set, Cancello and House read private JSON projections outside the checkout. Fresh reads use disk without upstream work. After five minutes the last complete state remains immediately readable while one refresh runs; after 24 hours it is no longer served. A failed refresh retains the complete snapshot and backs off request-triggered retries for one minute. The UI labels stale data and refresh activity.

Files use an atomic rename, mode 0600, version and checksum validation, and a fingerprint of the deployment directory and source configuration. A shared generation fences snapshots after existing source/decision invalidation. Late crawls cannot overwrite post-decision data. Different Next route bundles share in-flight work; a full manual reread waits for a full body refresh rather than silently joining an ordinary refresh. This is a single-server-process design, not a distributed cache protocol.

House preparation awaits fresh source reads and a refreshed Cancello state, rather than stamping old SWR data as newly generated. Partial source failures, failed body/media reads and failed patch verification cannot replace a complete projection. Removed relation targets (404) remain a tolerated missing asset, and the existing intentional duplicate-story warning is accepted.

`ggo-cockpit-warm.timer` calls the running server over loopback three minutes after each completed warm-up. This keeps the existing body cache and Notion limiter resident; a separate Notion crawler is not started. Its environment contains only the existing read-only cockpit bearer. The service cannot call remote addresses and has no Notion or publication credentials. `?warm=1` returns operational metadata only. Tests verify that this bearer cannot call the decision route without a human writer session.

The main deployment now provisions the private directory and timer, restarts the app, and requires a successful warm-up of both projections before reporting success. It no longer relies only on `/login`. The initial full crawl still takes time; subsequent restarts can immediately read persisted data. Other consumers outside this Node process still share the upstream budget without participating in this limiter.

## Operations

The deployment runs `python3 tools/vps/install-cockpit-warm.py` as root. State is `/var/lib/ggo-cockpit` (0700, jj); the timer's token-only environment is `/etc/ggo-cockpit-warm.env` (0600, root). The installer leaves the existing application environment unchanged and adds a systemd drop-in. No publishing timer is enabled.

Check `systemctl status ggo-cockpit-warm.timer` and `journalctl -u ggo-cockpit-warm.service`. A failed warm-up must be investigated even when old data remains readable. `systemctl start ggo-cockpit-warm.service` performs a read-only retry. Use the existing authenticated cache invalidation or decision flow after changes; deleting a file alone is not a generation fence.

To disable this feature, stop and disable `ggo-cockpit-warm.timer`, remove only `/etc/systemd/system/ggo-content-manager.service.d/snapshots.conf`, reload systemd, and restart the app. The original in-memory path remains available when the snapshot directory is unset. Preserve the private snapshots for diagnosis, or delete them while the app is stopped; they contain content and must not be committed or served statically.

## Reproducible local browser check

`tools/performance/seed-cockpit-fixture.ts` writes synthetic projections only to `/tmp/ggo-cockpit-fixture-*`. Run it with `COCKPIT_SNAPSHOT_DIR` set, then start the production server on 127.0.0.1:3112 using that directory, `AUTH_SECRET=content-manager-local-fixture-only` and `AUTH_URL=http://127.0.0.1:3112/api/auth`. `tools/performance/verify-cockpit-snapshot.mjs` checks real SSR and API reads for Atrio and Questioni on desktop and mobile. It accepts local fixture authentication only; it does not authenticate against production. Stop and restart the server without reseeding to verify disk restoration.

Local synthetic checks observed 110–136 ms to visible content on repeated navigation; these are not VPS or user-browser measurements. A second check stopped and restarted the production server without reseeding: Atrio/Questioni became visible in 78–168 ms on desktop/mobile. No page errors or horizontal overflow were observed. Human review and publication authority are unchanged.

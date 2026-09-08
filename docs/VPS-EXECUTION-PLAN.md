# VPS execution plan

Prepared 8 September 2026, following JJ's request to use the VPS as much as practical. This is a proposed operating model and migration sequence, not a record of activation. JJ reviews the final technical change before merge; every future content package still requires its own authentic human review before publication.

## Verified starting point

Live inspection on 8 September, around 15:16 Europe/London:

| Item | Observed |
| --- | --- |
| CPU | 8 virtual CPUs, AMD EPYC-Milan |
| Memory | 15,690 MiB total; 14,154 MiB available |
| Disk | 479 GiB filesystem; 465 GiB available |
| Load | 0.00 / 0.00 / 0.00 at the sampled instant |
| Active application | GGO Content Manager |
| Active media scheduling | `ggo-carico-worker.timer`, every five minutes |
| Eight Ernesto timers | Installed, inactive and disabled; all eight Mac counterparts are still loaded |
| Media tools | FFmpeg, Whisper CLI and the base model are installed |
| GPU | Only a virtual display adapter was reported; no compute GPU was identified |
| New pipeline registry | No `/var/lib/ggo-pipeline` or `ggo-pipeline-*.service` units found |
| Ernesto credential readiness | Required Notion credentials/database IDs and Cockpit service token are empty or absent in `/etc/ggo-ernesto.env`; only the Cockpit URL is populated among those checked |

The existing web/media services run as the same `jj` user. The media service has lower scheduling priority but no CPU or memory cap. Increasing parallel work before applying the already designed identity and resource separation would compete with the interface and broaden credential access.

A bounded synthetic FFmpeg check encoded 10 seconds of 1080p30 test pattern in **3.255 seconds**, using H.264 `veryfast`, CRF 22, two codec threads, user `jj`, and `nice 10`. It read no user media and wrote no output file. This demonstrates useful CPU encoding capacity; it does not predict complete edits, 4K workloads, transcription throughput or production container performance. No load test or sustained capacity measurement was performed.

## Desired responsibility split

| Responsibility | Target owner | Practical outcome |
| --- | --- | --- |
| Cockpit reads | VPS read service with durable, revisioned local projections | Opening a page reads prepared data instead of starting a Notion crawl |
| Notion integration | VPS jobs, shared API request budget and durable checkpoints | Synchronisation continues while the Mac is offline |
| Deterministic scans and maintenance | VPS scheduler and durable job ownership | One run per schedule, restart recovery and visible failures |
| Media preparation | VPS private media worker | Upload once, then extract audio, transcribe, generate proxies/posters, prepare subtitles and renders beside the source |
| Claude/hybrid comparisons | Existing pipeline worker and comparison contracts on VPS | Reuse the same private input/template snapshot and preserve both variants for review |
| Model inference | Configured provider APIs | VPS coordinates calls and validates results; installed provider capability and budget must be verified |
| GUI-only work and local capture | Dedicated capability-specific executor; Mac where its app/session/files are required | The executor returns a private artefact to the same queue; it cannot approve or publish |
| Human review | Authenticated JJ session in Cockpit | Review the actual selected version, assets, account, channel and schedule |
| Publication | Separately credentialled publisher using the reviewed registry receipt | Only the approved immutable package can be dispatched |

Notion integration retains its existing data-ownership rules. Hosting it alongside Ernesto does not make Ernesto an ETL writer or create a second source of editorial authority.

## Migration order

### 1. Finish the faster read path

The performance code in this PR removes repeated body and related-page reads and makes Questioni render independently. The next implementation should move snapshot construction out of the interactive request path:

1. Give a read/projection worker a private persistent state directory outside release checkouts. Reuse the approved pipeline's single-host storage and job contracts; keep display projections separate from the authoritative review registry.
2. Populate a complete candidate snapshot in the background, then atomically advance the visible revision. A crash must leave the last complete snapshot readable. Partial or malformed snapshots must never replace it.
3. Let Cockpit expose snapshot age, sync progress and source failures. A stale snapshot may support browsing, but cannot establish approval authority. Review and publish must validate the exact canonical package revision and asset bytes; a mismatch requires the changed package to be reviewed again.
4. Use authenticated Notion webhook events to enqueue page IDs, collapse repeated events, and fetch current source state. Keep a periodic reconciliation pass for missed events and permission changes. Webhook payloads are hints, never approval events.
5. Coordinate Notion requests across Cockpit, ETL and Ernesto by integration identity, and respect workspace limits and `Retry-After`. More workers must not multiply the API budget.

A timer repeatedly requesting `?refresh=1` is not the target design: it forces full body reads and can recreate the bottleneck. Background sync should reuse unchanged revisions and reserve full rereads for explicit verification or reconciliation.

Acceptance: complete snapshot survives restart; no older completion replaces a newer revision; concurrent browser requests do not start duplicate crawls; duplicate/out-of-order webhooks converge; stale or altered review content is rejected. Measure ordinary-navigation p95 and request counts before and after deployment. A sub-second warm-page response is an objective, **not measured evidence**.

### 2. Transfer the eight prepared HTTP jobs

The job names and current schedules are already in `tools/vps/ernesto-jobs.txt`. Keep their Europe/London schedules:

| Job | Schedule | Inspected owner |
| --- | --- | --- |
| `nightly-review-due` | Daily 02:00 | Mac |
| `evolution-review` | Daily 05:45 | Mac |
| `morning-sitemap-fetch` | Daily 06:00 | Mac |
| `morning-orphan-check` | Daily 06:30 | Mac |
| `video-pressure` | Daily 06:55 | Mac |
| `ingester-health-check` | Daily 07:47 | Mac |
| `weekly-natascia-summary` | Monday 08:00 | Mac |
| `weekly-schema-check` | Sunday 22:47 | Mac |

Before cutover, prepare the reviewed release and dedicated scoped server credentials, prove required database access without writes, and check the job's idempotency and Activity Log path. The empty environment currently prevents activation; installing a timer is not proof of readiness.

Transfer one job at a time: stop and disable its Mac schedule, prove the old execution is absent, assign the VPS owner, then enable that one matching timer. A host-local lock does not prevent another host from running the same job. Use the central ownership/lease contract from the approved pipeline before enabling cross-host retries. Account explicitly for `Persistent=true` catch-up runs. Do not use the old bulk `enable` command for this migration.

Verify one Activity Log result per expected run, including an observable failure path. Rollback reverses ownership only after stopping the VPS execution. Record missed schedules rather than silently executing a burst of old work.

### 3. Keep preparation and rendering on the VPS

Extend the existing media path instead of downloading every intermediate file to the Mac. Source uploads and outputs stay private; a job stores input hashes, template revision, output hashes and its execution record. A ready output becomes a review candidate, never a publication instruction.

Start with one CPU-heavy render/transcription job at a time and up to two network-bound preparation jobs. Claude and hybrid comparisons can prepare their plans concurrently, then queue their renders under the same global media limit. Preserve both outputs and record real durations/costs; do not infer a winner from provider identity.

Use the approved pipeline's pinned rootless renderer, template kits and per-job mounts. The installed host FFmpeg benchmark is not permission to bypass that renderer contract. Apply CPU/memory limits to the actual containers and daemon workload as well as the process launching them.

Move proxies, audio extraction, subtitle burn-in, template composition and export variants first. Keep 4K, complex motion and long transcription workloads behind measured admission limits. GPU-heavy generation remains an external capability until separately provisioned and verified.

Acceptance: the Cockpit stays responsive during a real representative render; killed jobs recover without overwriting completed artefacts; two variants cannot write into one another's outputs; neither worker has review/publisher credentials or public storage access.

### 4. Make the VPS operationally independent

Run the prepared registry, projection, comparison and dispatcher releases with their separate service identities and state directories. Preserve both pipeline profiles and the single human review contract. Add job status, queue age, retries, last successful sync, source freshness and disk pressure to the Cockpit's technical signals.

Back up receipts, immutable packages, historical kits, job ownership and projection journals to an encrypted destination outside this VPS, and prove restoration. The 465 GiB free disk is useful private workspace, not an independent backup. Keep render scratch bounded and expire only reproducible unreferenced intermediates; approved/reviewed asset retention must follow explicit references.

The existing integration release and rollback contract remains authoritative: [pipeline rollout at the merged revision](https://github.com/GGO-Med/ernesto-agents-house/blob/977cdf0a1f59266a1173b56e0753ab1f339fbb6d/docs/pipeline-integration/ROLLOUT.md). Its external patches and pinned trees must be reconciled with the performance PR before promotion. Their merge did not install services on the VPS.

## Initial resource envelope

These are proposed starting ceilings, not reservations or measured optimal values. Keep interactive work higher priority and adjust only with representative load measurements:

| Group | CPU ceiling | Memory ceiling |
| --- | ---: | ---: |
| Cockpit and review registry | 2 vCPU | 3 GiB |
| HTTP sync/preparation | 1 vCPU | 2 GiB |
| Media processing | 3 vCPU | 6 GiB |
| Monitoring/backup work | 0.5 vCPU | 0.5 GiB |

This leaves about 1.5 vCPU and 3.8 GiB outside these envelopes for the OS, filesystem cache and headroom. Enforce aggregate limits across the group; individually limited services can still exceed a shared budget when they run together. A build should run in a separate release directory and not compete with a heavy render. Keep at least 20% disk free as an initial operating threshold.

## Sources and current status

The inventory and benchmark above were observed directly. Existing code/runbooks establish the worker and migration paths. Notion's current documentation supports [webhook-driven refresh](https://developers.notion.com/reference/webhooks), but updated content must still be fetched after an event. Its [request limits](https://developers.notion.com/reference/request-limits) cover both an average of three requests per second per connection and a separate workspace-wide limit; more server capacity does not remove either limit.

Only inspection and the bounded synthetic benchmark ran on the VPS in this task. No timer, credential, service configuration, content or publication state was changed. Migration, durable dashboard projections, additional rendering workers, backup restoration and production load acceptance are **NOT RUN / NOT IMPLEMENTED by this addendum**. The existing performance implementation remains separately validated in `performance/2026-09-08/README.md`.

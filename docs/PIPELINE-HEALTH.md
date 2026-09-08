# Sanity → Notion pipeline status

Le Questioni includes an authenticated, read-only status panel for the full ETL
and per-document webhook workflows in `GGO-Med/notion-integration`. It does not
run jobs, approve content, publish or change Notion data.

## Configuration

Set `PIPELINE_GITHUB_READ_TOKEN` on the Content Manager server. Use a
fine-grained GitHub token restricted to `GGO-Med/notion-integration`, with
Actions read and Metadata read. Do not expose it as NEXT_PUBLIC or grant writes.
Without it, the panel reports unavailable configuration. Authenticated viewers
can read status; unauthenticated requests cannot reach the loader.

The server reads the latest main-branch run for `weekly-full.yml` and
`sanity-sync.yml`, then the exact `pipeline-health-<run_attempt>` artifact. It
checks schema version, mode, run ID, run attempt, commit SHA, ordered complete
steps and consistent outcome/metrics. Archive size and extracted JSON are
bounded. Only allow-listed numerical metrics and execution metadata reach the
browser; neither credentials nor arbitrary report text is returned. GitHub
authorization is not forwarded to the signed archive URL. No stale cache is
used for operational status.

A legacy green run without the matching report is **unverified**. Missing or
expired evidence never becomes zero findings. A failed/cancelled GitHub run is
failed even when its artifact claims success. A full run older than eight days
or a disabled workflow is visible. A webhook success is per-document only,
never evidence of global validation or an editorial review.

## Evidence overflow contract

The companion ETL change writes no more than 100 IDs to each relation property:
`Evidence Sources Used`, then additive `Evidence Sources Used (ETL 2)` through
`(ETL 20)`. The primary name and related database are unchanged. The legacy
PIF reader paginates every truncated relation and unions/deduplicates all these
slots before mapping to its existing `evidenceSourceIds` array. The canonical
Sanity PIF views and editorial approval authority are unchanged.

Deploy this reader before activating the ETL overflow writer. Do not remove
an overflow field during rollback: it may contain source links. Retain this
reader until evidence has been migrated even if the health panel is reverted.

## Migration boundary

Ernesto PR 57 contains the separate central-worker/v1 projection migration.
This change does not activate it or retire mirrors. Reconcile the new health
artifact and overflow contract when moving to that worker; its enqueue-only
GitHub jobs cannot be treated as completed ETL runs. Mirror retirement still
requires consumer parity and preservation of manual edits and relation targets.

## Verification (8 September 2026)

- Unit/component/API tests exercise complete 106-reference reads, pagination
  errors, auth isolation, run-attempt/SHA mismatch, oversized/missing reports,
  high-severity findings, old green runs, missing access and UI unknown states.
  The panel cancels pending fetches on navigation and rejects malformed responses;
  integrated page tests verify independent loading and cancellation of all three reads.
- Full suite after integration with main PR 28: 177 passed, five existing skipped tests. TypeScript and production
  build passed. Targeted source lint passed.
- A real read-only GitHub smoke check correctly showed the 6 September full
  run and 2 September webhook as unverified because they predate health artifacts.
- A real read-only Notion pagination check expanded an initial 25-reference
  property response to its complete 28 references.
- No source schema mutation, live ETL execution, editorial approval, deployment
  or authenticated visual browser acceptance is claimed by these tests.

The ETL change is required to emit new reports; configure the read token and
inspect the first genuine post-activation run before claiming production health.
Merging this repository's main branch triggers its existing VPS deployment.

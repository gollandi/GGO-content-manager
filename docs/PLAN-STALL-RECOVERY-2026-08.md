# Stall recovery plan — cockpit + nightly runs (August 2026)

Written 2026-08-23 after a full health check of the Shell, the resident
services (Mac 3010, VPS) and the ernesto-agents-house nightly runs. This file
is the hand-off between sessions: each phase is self-contained, states what
to verify before and after, and what JJ must decide. Work one phase per
session; tick the boxes; keep `## Log` at the bottom current.

Branch for the work: `claude/content-manager-stallo-check-3ab67c` (worktree
`.claude/worktrees/content-manager-stallo-check-3ab67c`). Cockpit truth lives
on the VPS (`https://cockpit.ggo-suite.co.uk`); the Mac 3010 service redirects
its login there.

---

## 0. Findings the plan is built on (do not re-derive)

All OBSERVED on 2026-08-23 unless marked.

| # | Finding | Evidence |
|---|---|---|
| F1 | **Production has been at zero since 2026-08-07.** Every `ernesto-headless-produce` slot ends "0 work orders claimed" because the headless `claude -p` session cannot see the Higgsfield, Sanity, Canva and osascript MCP tools (ToolSearch finds nothing). `claude mcp list` shows them "Connected" as claude.ai connectors, which do not load outside an interactive session (INFERRED). | `~/Library/Logs/ernesto-agents-house/ernesto-headless-produce.log`, transcripts `ernesto-produce-2026-08-2*.log`; Desk row `3c1d2f3d-906b-8135-…` open for a month asking exactly this |
| F2 | **The morning brief is never shown in the cockpit.** `operations/morning-brief.js` rewrites the Notion page `NOTION_ERNESTO_BRIEF_PAGE_ID`; no route or page in the Shell reads it. The only "brief" in the Shell is `/api/ernesto/operations/daily-report` (Claude prose over the 7-day Activity Log). | grep of `app/ lib/ components/` — zero hits for `BRIEF_PAGE` |
| F3 | **The Desk queue is shown truncated and unordered.** La Casa di Ernesto already lists open Desk rows (`ErnestoOperationsBoard`, three families) but capped at 6 per family ("e altre N…"), in Notion's arbitrary order, without age, and its "Decidi" link leads to Il Cancello — whose wall keeps only Pending rows with a locally-resolvable video (`wallFromDeskRows`). Desk today: 114 Pending (51 question, 34 recommendation, 15 publish-approval, 12 plan-proposal, 2 clip-script), 36 Approved never claimed (oldest 2026-06-12), 5 In production stuck since June/July. Only the 15 publish-approvals can ever reach the Cancello. *(Corrected 2026-08-23 during Phase 1: the first draft said the Desk was invisible.)* | `components/ErnestoOperationsBoard.tsx`, `lib/cancello/state.ts:241`; Notion SQL on `collection://8f4b3eca-0043-4bf8-9dde-ce18a95b9ad6` |
| F4 | **Performance Snapshot stuck at week 2026-08-10.** The 2026-08-16 23:00 `weekly-performance-snapshot` failed on all 5 sources: `api.notion.com` resolved to `192.168.1.250:443` (LAN IP) → ECONNREFUSED. Network errors 13–18 Aug (61/45/17/25/23 per day), clean since 19 Aug. No retry/catch-up; `snapshot-revision` (Thu) repaired Search Console only. `ingester-health-check` still reports "fresh (13d)". | `weekly-performance-snapshot.log`, `snapshot-revision.log`, Activity Log rows |
| F5 | **Stale signals in the Activity Log.** `publish-reconciliation`: 14 calendar rows "published" with no evidence (ghosts). `social-approved-publish`: 11 approved, 0 published daily (9 alreadyHandled, 3 deferredForScatter). `throughput-ledger`: output 0, streak 3 days. `page-story`: pagesSeen 0. `clip-ingest` writes 48 "nothing to ingest" rows/day (≈2000 rows/30d). | Activity Log rows 2026-08-20…23 |
| F6 | **Mac 3010 redirects login to the VPS.** `lib/auth/config.ts:51-61` forces `AUTH_URL` to `https://cockpit.ggo-suite.co.uk` in production when the env value is missing or localhost. The web LaunchAgent sets only `PATH` and `PORT`. | `curl -I http://localhost:3010/api/health` → 307 to the VPS login |
| F7 | **Auto-update agent not installed** on the Mac (`uk.co.ggomed.content-manager.update` absent). Builds are otherwise current: Mac `.next` 18 Aug, VPS `.next` 16 Aug 06:03 ≥ last main commit 16 Aug 06:02. | `launchctl list`, `BUILD_ID` mtimes |
| F8 | **Uncommitted work on `main`** (7 files: Sibilla read-only config, `app/ambrogio/page.tsx`, `lib/notion/editorial.ts`, `tools/vps/ernesto-jobs.txt`, `__tests__/sibilla-no-write.test.ts`). Not built, not deployed. | `git status` in the main checkout |
| F9 | VPS wave‑1 Ernesto units exist but are **disabled by design** (launchd still runs them on the Mac). Carico worker timer runs every 5 min; one manifest from 15 Aug in `inbox/`, its `ready/<id>/` exists. media-sync ships Mac media to `/srv/ggomed-media` every 10 min (35 files). | `systemctl list-unit-files`, `ls /srv/ggo-media`, `media-sync.log` |

What works: all 31 LaunchAgents load and exit 0; brief/produce/review slots
complete daily (except 13–14 Aug network failures); Notion Activity Log is
current to the minute; Sanity views preflight 61/61/61 active; VPS service up.

---

## Phase 0 — Preparation (½ h, no risk)

Goal: a clean, deployable `main` and an auto-updating Mac service, so every
later phase reaches the resident build without manual steps.

Steps
- [x] In the **main checkout** (`/Users/jj-macstudio/Developer/GitHub/GGO-content-manager`): move the 7 uncommitted Sibilla files to a branch (`git stash` → `git switch -c feat/sibilla-readonly` → `git stash pop` → commit) or commit them directly if JJ confirms they are finished. Do **not** leave them dangling on `main`.
- [x] Install the update agent: follow the template/one-liner in `tools/mac/update-resident.sh`; confirm with `launchctl list | grep content-manager.update`. *(Done 2026-08-23 11:34; first run exit 0, silent no-op because main was already current.)*
- [ ] Decide (JJ): **is the VPS the only operator surface?** *(Assumed "yes" for Phase 1; `.env` files untouched — JJ sets `AUTH_URL` on the VPS if confirming.)*
  - Yes → set `AUTH_URL=https://cockpit.ggo-suite.co.uk` explicitly in the VPS `.env.local`, document in `docs/DEPLOY-REMOTE.md` that the Mac 3010 is a runner/mirror only. Nothing else changes.
  - No → in `lib/auth/config.ts` stop overriding localhost: keep the production fallback only when `AUTH_URL` is *absent*, never when it is an explicit localhost value; then set `AUTH_URL=http://localhost:3010` in the Mac plist `EnvironmentVariables`.
- [x] Sync: `git fetch && git log --oneline HEAD..origin/main` on the working branch before any edit (global rule).

Verify
- `git status` clean on `main`; update agent listed; `curl -I http://localhost:3010/api/health` behaves per the decision above.

Rollback: none needed (config only).

---

## Phase 1 — Visibility: show what the nights produce (1–2 days, read-only, low risk)

Goal: the operator sees the morning brief, the full Desk queue and three
freshness indicators inside the Shell. Nothing here writes to Notion or
Sanity; no gate is touched.

### 1.1 Full Desk wall in La Casa di Ernesto — DONE 2026-08-23 (revised scope)
The wall already existed in `ErnestoOperationsBoard`; it was improved rather than duplicated.
- [x] `DeskRow.createdAt` (page `created_time`) added in `lib/notion/editorial.ts` (additive; callers: editorial page, `/api/ernesto/operations`, citofono).
- [x] Board: open rows sorted by priority band then oldest first; age shown ("da N gg"); per-family "Mostra tutte (N)" toggle instead of a hard cap; "Decidi" → Il Cancello only for `publish-approval` (every other decision is taken on the Notion row via "Apri").
- [x] Stall strip above the families: Pending count + oldest age; Approved unclaimed > 14 d; In production stale > 21 d (oxblood when > 0).

### 1.2 Morning brief in the Shell — DONE 2026-08-23 (env id still to be set by JJ)
- [x] `NOTION_ERNESTO_BRIEF_PAGE_ID` in `.env.example` and `lib/config.ts` (`notionConfig.pages.ernestoBrief()`, optional → room degrades silently).
- [ ] **JJ:** paste the page id into both `.env.local` (Mac + VPS). Until then the card does not render.
- [x] `lib/notion/brief.ts` — blocks → Markdown + `last_edited_time`, 5-minute cache, read-only.
- [x] `app/api/ernesto/brief/route.ts` (GET, auth).
- [x] `components/MorningBrief.tsx` mounted at the top of La Casa di Ernesto; amber line when older than 26 h.

### 1.3 Daily-report signal/noise
- [x] In `app/api/ernesto/operations/daily-report/route.ts`, before `summariseDay`, drop rows whose `job ∈ {clip-ingest, media-gc}` **and** Status = Success **and** summary matches /nothing to ingest|no files/ — keep them in `counts`, exclude from the prose input. Fingerprint must ignore them too so the prose cache stays stable.

### 1.4 Freshness indicators in Portineria — DONE 2026-08-23
- [x] `app/api/ernesto/pulse/route.ts` (GET, auth) — last productive produce slot + zero-output streak, Desk pending/oldest/approved-unclaimed, latest snapshot week; built on the cached editorial services.
- [x] `components/HousePulse.tsx` ("Polso della casa") mounted above the Portineria summary grid; thresholds: produce amber 3 d / oxblood 7 d, snapshot 8 / 15 d, Desk pending 30 / 60.
- [x] `__tests__/ernesto-read-models.test.ts` — brief/pulse routes GET-only and free of Notion write calls.

Verify
- [x] `npm run test` green (17 files, 100 tests incl. `ambrogio-no-write`, `ernesto-read-models`); `tsc --noEmit` clean; `npm run build` OK (2026-08-23).
- [ ] Deploy VPS per `docs/DEPLOY-REMOTE.md` (rsync, build, restart); the Mac updates itself via the new agent once merged to `main`.
- [ ] Logged in on the VPS (JJ): La Casa di Ernesto shows the brief card (after the env id is set) and the stall strip with ≈114 pending rows, oldest first; Portineria shows the three pulse sockets (snapshot oxblood until Phase 3 runs).

Rollback: revert the commit; routes are additive.

---

## Phase 2 — Unblock headless production (1–3 days, medium risk)

Goal: the 13:00 `produce` slot claims work again. Root cause F1.

### 2A (preferred) — CLI-scoped MCP servers
- [x] Servers registered at user scope 2026-08-24 (`claude mcp add --transport http --scope user` for higgsfield/sanity/canva); `claude mcp list` shows all three as "Needs authentication".
- [ ] **JJ, interactive step:** open `claude` in `~/Developer/GitHub/ernesto-agents-house`, run `/mcp`, complete the OAuth for **higgsfield**, **sanity** and **canva** once each. **UNVERIFIED** that user-scope HTTP servers then load in `claude -p`; the probe below settles it.
- [x] Probe passed 2026-08-24 (JJ ran it):
  ```bash
  cd ~/Developer/GitHub/ernesto-agents-house && claude -p 'Use ToolSearch with query "higgsfield" then "sanity" then "canva"; reply only with a JSON object of tool names found per query.' --output-format text --permission-mode bypassPermissions
  ```
  Expected: non-empty arrays for all three. If empty → 2B.
- [x] Probe passed → no cron change needed. Closed the 7 duplicate "MCP absent" Desk rows (2026-08-07 → 08-19, incl. the month-old decision row `3c1d2f3d-906b-81b8…`) as Done with resolution notes; left open the parked-short virality row `3b1d2f3d…` (deliverable, not infrastructure — tonight's review slot can move it).

### 2B (fallback) — NOT NEEDED (2A verified 2026-08-24); kept for reference — deterministic Sanity, interactive Higgsfield/Canva
- [ ] `ernesto-agents-house/operations/sanity-draft-writer.js` using `@sanity/client` + `SANITY_GGOMED_WRITE_TOKEN` (drafts only, `gxyjgvr0` only — never `m05ykm6e`; mirror the existing `notion-to-sanity-sync` guard). Expose it to the produce skill as a documented tool; produce slot then handles page patches, captions, Desk work orders that need no generative media.
- [ ] Generative reels (Ginevra) and Canva statics stay on an interactive slot JJ opens (document in `ernesto-the-pimp` SKILL.md "headless limits").

### 2C (both branches) — fail loudly next time — DONE 2026-08-24
- [x] `cron/ernesto-headless.js`: `preflightTools()` — per-slot expected tools (produce: higgsfield/sanity/canva; review: higgsfield; brief: none; `ERNESTO_EXPECTED_MCP_TOOLS` override), haiku ToolSearch probe, one deduped Urgent Desk row + macOS notification on miss, run recorded **Partial** (`errors = missing.length`), missing tools stitched into the slot prompt, auto-close on the first healthy probe. A failed probe never masks a different fault. Commit `646d6f8` in ernesto-agents-house; 1095 tests green.
- [x] `daily-report`: `Partial` is already in the `ATTENTION` set — confirmed.

Verify
- Next day's produce Activity Log row: Summary with ≥1 claimed work order; `throughput-ledger` output > 0; Portineria socket *Ultimo produce* green.

Rollback: remove the user-scope MCP servers (`claude mcp remove …`); 2B script is additive.

---

## Phase 3 — Resilience to network faults (½ day, low risk)

Goal: a bad night no longer leaves a week-long hole.

- [ ] `cron/weekly-performance-snapshot.js` (agents-house): wrap each ingester in retry with backoff (3 × 30 s → 2 min); on final failure write Activity Log `Failed` **and** drop a marker file `state/snapshot-pending-<week>.json`.
- [ ] New daily cron `snapshot-catchup` (07:30) that re-runs ingesters for any pending marker; reuse `snapshot-revision` logic and extend it to GA4/Meta/Beehiiv (today Search Console only). Install as LaunchAgent like the others; add to `tools/vps/ernesto-jobs.txt` wave‑2 notes.
- [ ] `ingester-health-check`: thresholds amber ≥ 8 d, red ≥ 15 d for weekly sources; current "fresh (13d)" is misleading.
- [ ] Network alarm: in `cron/runCron` wrapper, count `ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT` per run; if ≥ 5, Activity Log `Partial` "network degraded" and the existing macOS notification path from `morning-brief.js`. Note in the log that a resolution of `api.notion.com` to `192.168.1.250` points at the router/DNS filter, not the app.

Verify
- Sunday 23:00 snapshot Success with rowsWritten > 0; Monday Portineria shows the new week; simulate a failure (bad token in a dry run) and confirm the marker + catch-up path.

---

## Phase 4 — Clean the stale signals (1 day, JJ decisions required)

- [ ] **14 publish ghosts** (`publish-reconciliation` noEvidence): list them in the Desk wall (Phase 1.1) with two actions rendered as links to the Notion row — *confirm published* / *back to Scheduled*. No auto-fix; JJ decides row by row.
- [ ] **11 social approved, 0 published**: read `social-approved-publish.log` for the 9 `alreadyHandled`; confirm whether Calendar vs Publish Queue disagree on state; fix the reconciliation rule or the rows, then re-run once manually.
- [ ] **36 Approved unclaimed / 5 In production stale**: one triage session (archive / re-approve / mark Done). Then add to `ernesto-headless-brief` a standing line "Approved > 14 d: N" and to `morning-orphan-check` the In-production > 21 d list (it already has `stuckInProduction` — make sure the brief shows it).
- [ ] **Log noise**: `clip-ingest` and `page-story` write an Activity Log row only when work happened or on error (keep a heartbeat at most once a day).

Verify
- Activity Log volume drops to ≈25 rows/day; Desk Approved unclaimed ≈0; publish-reconciliation staleFound trending to 0.

---

## Phase 5 — Consolidation (after Phases 1–4 hold for a week)

- [ ] Enable VPS wave‑1 timers one at a time (`systemctl enable --now ggo-ernesto-<job>.timer`) and unload the matching Mac LaunchAgent **in the same step** (double-write otherwise). Order: nightly-review-due, morning-sitemap-fetch, morning-orphan-check, video-pressure, ingester-health-check, evolution-review, weekly-natascia-summary, weekly-schema-check. Needs the agents-house env template on the VPS filled (name-only template already shipped).
- [ ] Decide the future of the Mac 3010 service (runner only vs mirror).
- [ ] Update `docs/STATE.md` and `CLAUDE.md` Known Limitations; hand the doc drift to Battista.

---

## Decisions JJ owns (collect answers before starting the phase)

| Phase | Decision |
|---|---|
| 0 | Sibilla files: commit as-is or park on a branch? VPS as sole operator surface? |
| 1.2 | Paste `NOTION_ERNESTO_BRIEF_PAGE_ID` into both `.env.local` |
| 2 | ~~Run the OAuth + probe (2A)~~ done — probe yes×3, 2026-08-24 |
| 4 | Row-by-row verdicts on ghosts, unclaimed approvals, stuck production |
| 5 | Which wave‑1 jobs move, and when |

## Conventions that apply to every phase
- British English in code/commits/docs; Italian only in chat.
- Conventional commits, one concern per commit; `detect_changes()` before committing; `impact` before editing any symbol.
- Never weaken the hard gates: views read-only, drafts only to `gxyjgvr0`, no write path to Ambrogio/Sibilla DBs, publish gates JJ-only.
- Deploy = `npm run build` + `launchctl kickstart -k gui/$UID/uk.co.ggomed.content-manager.web` on the Mac; rsync + build + `systemctl restart ggo-content-manager.service` on the VPS (`docs/DEPLOY-REMOTE.md`).
- Verify on the live surface (VPS login), not only in dev.

## Log
- 2026-08-23 — health check done, plan written. No code changed.
- 2026-08-23 — Phase 0 done (Sibilla parked on `feat/sibilla-readonly`, update agent installed, AUTH_URL decision left to JJ). Phase 1 implemented on `claude/content-manager-stallo-check-3ab67c`; F3 corrected; awaiting merge + VPS deploy + JJ's on-surface check.
- 2026-08-24 — **Phase 2 provisionally closed**: JJ's headless probe → yes×3 (no OAuth re-run; exact cause unverified — see 2A note). Arbiter: the 13:00 produce slot, now instrumented by preflightTools (Partial + Desk row on relapse). Seven "MCP absent" Desk rows closed with resolution notes. Watch: the 13:00 produce slot should claim work again; the 18:00 review slot regains the Higgsfield gate. preflightTools() (646d6f8) guards any relapse.
- 2026-08-24 — Phase 1 merged (#18) and deployed: VPS rebuilt/restarted (build Z2LhQJ56…, smoke checks green), Mac auto-updated; `NOTION_ERNESTO_BRIEF_PAGE_ID` set on both machines. Phase 2: 2C shipped in ernesto-agents-house (`646d6f8`); 2A servers registered at CLI user scope, awaiting JJ's one-off `/mcp` OAuth for higgsfield/sanity/canva, then the probe; 2B only if the probe fails.

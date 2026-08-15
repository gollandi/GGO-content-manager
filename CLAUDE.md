# CLAUDE.md — GGO Med Operator Cockpit

## Project Summary

The GGOMed Operator Cockpit ("the Shell"): one Next.js application from which JJ — the sole operator — observes and dispatches the entire GGOMed content ecosystem. Four cockpit modules (Editorial, PIF Tick, La Casa di Ernesto, Lo Studio di Ambrogio) plus Il Cancello, the single human review gate. Authoritative spec: `docs/GGOMED-COCKPIT-SPEC.md`; current state: `docs/STATE.md`; product truth: `PRODUCT.md`; visual system: `DESIGN.md`.

## Tech Stack

- **Framework:** Next.js 16.x (App Router; mix of server components and `"use client"` pages)
- **Language:** TypeScript 5.4 (strict)
- **Styling:** Tailwind CSS 4.x + a small set of CSS Modules
- **Auth:** next-auth v5 (Google + credentials; middleware-gated, `trustHost` enabled for the resident localhost service)
- **Data:** Sanity (two projects, live GROQ) + Notion (editorial workflow state) — see Data Ownership
- **Tests:** Vitest (`npm run test`)
- **Fonts:** Bodoni Moda, Archivo Narrow, Archivo (see DESIGN.md — Il Registro world)

## Data Ownership (truth-per-data-class)

| Data class | Truth lives in | Read via |
|---|---|---|
| Content / PIF assessment | Sanity `gxyjgvr0` (site) + `m05ykm6e` (Compass PIF slice, READ-ONLY) | live GROQ, named views in `lib/views` |
| Editorial workflow state | Notion (Calendar, Topic Pool, Desk, Needs, Ambrogio DBs…) | `lib/notion/*` |
| External metrics | neither | cache tier (Phase 2, not built) |

Named GROQ views are exposed twice: as a library (`lib/views`) and over HTTP (`/api/views/[view]`, session or `COCKPIT_SERVICE_TOKEN` bearer).

## Hard Gates (enforced in code, never weaken)

- Views are read-only; the cockpit observes and dispatches.
- Generative skills write **drafts only** to `gxyjgvr0`; `m05ykm6e` is never written.
- The three publish gates (site publish, social approval, newsletter send) are JJ-only.
- Ambrogio's Notion DBs have **no write path** in this app (asserted by `__tests__/ambrogio-no-write`).
- Oxblood (`--seal`) in the UI is reserved for the act of sealing and for what awaits JJ.

## Key Directories

| Path | Purpose |
|------|---------|
| `app/` | Pages: 8 cockpit rooms + 11 legacy mirror pages (retiring) + `review` (Il Cancello) |
| `app/api/` | notion/*, views/*, ernesto/* (runner), review-dashboard/* (gate), retro, cache |
| `lib/views/` | Named GROQ view registry (editorial-content, asset-identity, pif-ggomed, pif-compass) |
| `lib/notion/` | Notion integration; `lib/notion/editorial.ts` for workflow DBs |
| `lib/media/` | Il Carico — the server media inbox (chunked resumable upload, manifest handoff to the video worker) |
| `lib/auth/` | next-auth config, roles, API guard |
| `components/` | Shell (AppShell, Sidebar) + `Registro.tsx` (design primitives: Guilloche, Socket, Tally, RoomCrest…) |
| `tools/parity/`, `tools/migration/` | Parity harness and mirror retirement (`npm run parity`, `retire:mirrors`) |

## Deployment

- **Resident service:** LaunchAgent `uk.co.ggomed.content-manager.web` runs `next start -p 3010` (KeepAlive). Canonical URL: `http://localhost:3010`. After code changes: `npm run build` then `launchctl kickstart -k gui/$UID/uk.co.ggomed.content-manager.web` — otherwise the service keeps serving the old build.
- Port 3000 belongs to Edelia; do not take it.
- **VPS (production):** `https://cockpit.ggo-suite.co.uk` — IONOS server `85.215.37.39` (AlmaLinux 9), app in `/srv/ggo-content-manager` (copied files, not a git clone), systemd unit `ggo-content-manager.service` on port 3010 behind nginx + Let's Encrypt. Runbook: `docs/DEPLOY-REMOTE.md`.

## Il Citofono (room intercom)

Per-room chat with the house voices, on the existing auth: Portineria
(atrio), Edmondo (editorial), Ettore (soffitta), Ambrogio (studio).
Voices converse and READ their room live (`lib/citofono/voices.ts`);
Edmondo and Ettore may deposit proposals into Content Needs (marked
`[Proposta di <voce>, via citofono]`, always "To do"). Ambrogio has NO
deposit tool — his independence stays structural. Route:
`app/api/citofono/[voice]` (streaming NDJSON, `claude-sonnet-5` by
default, override with `COCKPIT_CITOFONO_MODEL`). Transcripts live in the
client session only. Voices never publish, never touch Sanity, never
change workflow state.

## Il Carico (media ingest)

`/carico` takes footage straight from JJ's phone onto the VPS, keeping the
Mac's connection out of the ingest path. Chunked and resumable (5 MiB parts,
backoff retries) because phone clips on 4G do not survive a single POST.
Files land in `COCKPIT_MEDIA_ROOT` (`/srv/ggo-media` on the VPS): the media
is assembled into `inbox/<id>.<ext>`, then the manifest `inbox/<id>.json` is
published by rename. **The worker watches the manifests, never the media
glob** — a manifest exists only once its file is whole. Ingest only: no
Sanity or Notion writes, no publish gate touched. nginx needs
`client_max_body_size` and `proxy_request_buffering off` (see
`docs/DEPLOY-REMOTE.md`).

The worker (`tools/worker/carico-worker.mjs`) is the other half: a systemd
timer on the VPS runs one pass every 5 minutes as `jj`, routing by `kind`
(dual-roll → split into two rolls for Titti; talking-head/voce → audio +
Whisper transcript; everything → probe + poster). Outputs land in
`ready/<id>/` with a `job.json`, surfaced read-only at `/api/media/jobs`
and on `/carico`. Provisioning: `tools/vps/worker-setup.sh inspect|apply`.
The worker never publishes — review stays JJ's, through Il Cancello.

## Design System

Il Registro (seed key 9055bf41) — security engraving, seals, the register of signed decisions, with the house layer (per-room crests and inks). Everything is recorded in `DESIGN.md` + `.impeccable/design.json`; the direction contract is an HTML comment in `app/layout.tsx`. Room primitives live in `components/Registro.tsx`. Never reintroduce: rounded corners (except seals/sockets), drop shadows, gradients (except sealed wax), pill badges.

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build (required before the resident service picks up changes)
npm run test         # Vitest
npm run parity       # Mirror-DB parity harness (gates retirement)
npm run retire:mirrors  # Retire mirror DBs (guarded: --apply --views-live + parity RECONCILED)
```

## Known Limitations

- The 11 legacy pages still read the doomed Notion mirror DBs (retirement gated on parity + views-live).
- No proprietary cache tier yet (SEMrush/GA4 metrics still ad hoc).
- Atrium reporting lines exist only for rooms with HTTP endpoints; Ambrogio and Helm report "nessun riporto".
- Family C is built end to end on the server (ingest + worker), but the worker's first pass is deliberately shallow: it splits, probes, posters and transcribes. Titti's transcript-similarity pairing of two separately recorded rolls, and Greta's actual edit, still run on the Mac. The Notion→Sanity native-state migration remains a deliberate Phase-2 leftover.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **GGO-content-manager** (1983 symbols, 4077 relationships, 145 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/GGO-content-manager/context` | Codebase overview, check index freshness |
| `gitnexus://repo/GGO-content-manager/clusters` | All functional areas |
| `gitnexus://repo/GGO-content-manager/processes` | All execution flows |
| `gitnexus://repo/GGO-content-manager/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# Project Spec — GGOMed Operator Cockpit ("the Shell")

> **For Fable 5 execution.** British English. Grounded in the exploration dossier, the locked decisions, and a final re-verification pass of every cited path (§0.1). Sprint 1 is a read-only build; the generative module, the remote+worker split, and the Notion→Sanity migration are explicitly later.

---

## 0.0 Decisions resolved by JJ (2026-07-03) — these OVERRIDE anything below

1. **GGOMed Sanity target confirmed:** project **`gxyjgvr0`**, dataset **`production`**. The Sprint-1 blocker (R14 / OQ1 / OQ2) is **CLEARED**. A **read-only viewer token** is still required for the private `medicalInterventionEntity` docs — generate it in Sanity manage (one config step, not a decision).

2. **Identity-swap mechanism (§5.5 / OQ9): Mechanism A (thin Notion "Asset Stub" DB) is the default.** Revisit at Phase 3 only if wanted. Resolved.

3. **Manual-divergence (§5.3 / OQ3):** JJ made no manual edits to the mirror DBs; agents may have. **No action needed now** — the §5.3 divergence audit runs *before* any DB retirement and surfaces such edits automatically. Handled by process, not by memory.

4. **Family A carve-out is REVERSED (OQ7 / §3-Module 3 / R17).** *La Casa di Ernesto* **DOES write GGOMed website pages directly into Sanity.** The editorial skills ("le ragazze") get a **write token to `gxyjgvr0`** and produce drafts programmatically — **retiring the current generate → plaster-cast → stamp → OCR → Sanity pipeline** (JJ's words: "mi sono rotto il cazzo… scrivere e basta"). Hard boundaries:
   - **Writes target the GGOMed site project `gxyjgvr0` ONLY.** `m05ykm6e` (Patient-Compass) stays **read-only** (PIF slice). Clinical patient-facing content authoring (Polaris/Compass copywriters) **stays in the Helm** under clinician GMC sign-off — it does **not** move into this cockpit.
   - **Drafts only.** Skills write to `drafts.*`; **nothing auto-publishes.** **Publish remains a JJ gate** — his review *is* the publish control (consistent with the 3-publish-gates-JJ-only posture and the Helm's drafts-only write model).
   - **Write token is server-side** — held by the cockpit/worker and injected into the runner, **never** embedded loosely in the skill bundles (the Helm's server-only-write-token pattern).
   - **The runner needs schema-shape grounding for `gxyjgvr0`** (equivalent of the Helm's `shape.ts`) so skills emit valid `dedicatedPage` / `blogPost` / `categoryHubPage` docs, not free text that JJ then hand-fixes (the current pain point).
   - This adds a **Family A adapter (copywriter → `gxyjgvr0` draft)** to the generative module (§6.2). It is still **Phase 2** (generative). **Sprint 1 remains read-only and the view layer stays read-only** — this scoped drafts-write is a separate path, not the views.

---

## 0. What changed since the draft (corrective pass)

The hostile review found real defects. This final spec fixes them; nothing was papered over.

- **Ambrogio enforcement was grounded in a fabricated file.** There is **no `write-audit.js`** anywhere in `ernesto-agents-house` (verified). Ambrogio audits are written by the **`ambrogio-il-maggiordomo` skill**, not a repo JS file. The mechanism is restated correctly in §3-Module 4 and R12 around the *real* boundary: the Shell must simply never expose a write path to `NOTION_AMBROGIO_AUDITS_DB` / `NOTION_AMBROGIO_PROPOSALS_DB`.
- **Berenice hard-fail premise re-verified and now correct.** The id `70a1edd2023e46e199f99165d77faf9b` **does exist** — in `~/.claude/skills/berenice-la-ricercatrice/notion-databases.md` (line 34, `NOTION_CONTENT_ASSET_DB=…`; DB-ID heading line 63). The review's grep missed it. Citation corrected in §5.1/R6.
- **Parity gate restated** as *reconciled-diff-with-accounted-deltas*, not byte-identical (§5.2, R7). "Confirm identical" was unreachable by the spec's own listed causes.
- **Identity-swap migration given a concrete mechanism** (§5.5), not hand-waved — this is where the relational graph would be lost.
- **Sprint 1 downgraded and re-scoped**: the parity harness is split out as a parallel deliverable that may slip past the 3-day window without failing the sprint (§7). The 3-day figure is now stated as a *target*, with the honest reasons it is optimistic.
- **Existing doomed-DB pages** (content-explorer, validation-hub, evidence-repository, schema-validation) — the dual-data-model problem is now named with an explicit disposition (§6.1a).
- **Cache tier / Phase-1 honesty**: S1.7 no longer sells "the third tier" as delivered; it delivers a cache-read *shim* over Notion, with the ownership move and the JSON-LD-per-page performance win correctly located in Phase 2 (§7, R15).
- **Ordering constraint added**: remote plane (Phase 2) must precede skill-repointing (Phase 3), else repointed skills depend on a local server with no uptime guarantee (§7, R9).
- **ETL path drift fixed**: scripts are `notion-integration/src/{3-sync,5-evidence-sync,7-pif-tick,9-validate}.js` (verified), not repo root (§5.2).
- **Family A carve-out named as a deviation** from the locked module-3 definition, not just a footnote (§3-Module 3, OQ7).

### 0.1 Path-verification status (re-checked this pass)

| Claim | Status |
|---|---|
| `write-audit.js` writes Ambrogio DBs | **FALSE — file does not exist.** Skill is the writer. Fixed. |
| Only JS touching Ambrogio DBs = `scanner/ambrogio-cartografina.js` (deterministic map) + `ops/inspect-notion-dbs.js` + read aggregators; **none write audit content** | **VERIFIED** |
| Berenice hardcoded `NOTION_CONTENT_ASSET_DB=70a1edd…` | **VERIFIED** at `~/.claude/skills/berenice-la-ricercatrice/notion-databases.md:34` |
| ETL scripts under `notion-integration/src/` | **VERIFIED** (`0-sitemap.js … 9-validate.js` present) |
| ernesto consumers (`buildAssetPathnameLookup`, `pif-tick-lookup.js`, `content-asset-status-flip.js`, `review-due-scan.js`) | cited in draft as verified; **Fable must re-open each before relying on it** (§5.1 carries a re-verify instruction) |

---

## 1. Overview & success definition

The **GGOMed Operator Cockpit** ("the Shell") is one unified Next.js 16 application — a single UI for JJ to observe and dispatch the entire GGOMed content ecosystem. It **extends the existing `GGO-content-manager` app** on its `main` branch. It is **not** built inside `chrysalis-compass`; that monorepo is reference-only. The only read of the Compass Sanity project (`m05ykm6e`) is the PIF-Tick traceability slice — no other Patient-Compass surface is touched.

Four modules, one shell:

1. **Editorial views** — the GGOMed site (live Sanity content), social, and every currently-used Notion editorial DB, behind aggregated cross-source filters.
2. **PIF Tick** — every PIF criterion tracked systematically and automatically, unified across the two Sanity projects that hold PIF data.
3. **La Casa di Ernesto** — the generative module (pages / social / video) using an in-shell Anthropic skill-runner, bespoke per skill-family. **Later sprint.**
4. **Lo Studio di Ambrogio** — the oversight control tower. Read-only in the Shell; Ambrogio stays independent by construction. **Read side lands in Sprint 1.**

### Success definition

- **Sprint 1 (the Fable build) succeeds when:** the Shell renders live read modules for Editorial, PIF (both projects normalised into one grid), and the Ambrogio read tower; the **named GROQ view layer** exists as both a shared package and an HTTP API; and nothing is written anywhere (observe-only). No monster ETL runs. **The parity harness is a Sprint-1-scoped deliverable but is explicitly allowed to land on a parallel track** (§7 S1.6) — it gates Phase 3, not Sprint 1 sign-off.
- **Overall product succeeds when:** the failing >30-minute weekly reconciliation ETL is retired in favour of GROQ-live + webhook-incremental refresh; skills ("le ragazze") read the same named views the UI does; the three hard publish gates (website publish, social approval, newsletter send) stay JJ-only; and Ambrogio's independence survives the UI unification.

Writes posture across the whole product: **the cockpit observes and dispatches. Views are READ-ONLY. The 3 publish gates are JJ-only.**

---

## 2. Architecture

### 2.1 The optimised-hybrid data model — placement rule (truth-per-data-class)

Every datum belongs to exactly one tier, decided by *who owns the truth*:

| Data class | Truth lives in | Read via | Examples |
|---|---|---|---|
| **Content / PIF assessment** | **Sanity** | **live GROQ** (no Notion mirror) | GGOMed pages (`dedicatedPage`, `categoryHubPage`, `blogPost`, `legalPage`), `pifTickAssessment`/`pifTickGovernance`; m05ykm6e `pifChecks`/`pifGovernance`/`pifCertification` |
| **Editorial workflow state** | **Notion** | **Notion SDK** | Content Calendar, Topic Pool, Ernesto Desk, Publish Events Queue, Newsletter Items, Media Assets, Content Needs, Content Requests, Agents Activity Log, Ambrogio Audits/Proposals, Patient Journeys |
| **External-API metrics** | **neither** | **small CACHE store**, light schedule | SEMrush keywords, GA4/Search Console analytics, scraped JSON-LD schema, sitemap |

**Consequence:** the four Sanity-mirror Notion DBs (Content Assets, PIF Tick Compliance, Evidence Sources, Schema Validation) are **redundant** and retire — but only after the parity proof and manual-divergence check in §5. **Until then the app runs two data models side by side** — see §6.1a for the disposition of the pages that read the doomed DBs.

### 2.2 Shared GROQ view layer (consumed by UI **and** skills)

Named, reusable GROQ views are a **shared service**, not UI-local queries. They are consumed by (a) the cockpit UI and (b) Ernesto + the editorial skills. Exposed **two ways**, deliberately:

- **Shared library** (`packages/views` / an importable module) — zero network hop, used by the cockpit's own server components and by any skill running in-process.
- **Loopback / remote HTTP API** (`/api/views/*`) — used by skills that run out-of-process (the Claude-Code skills on JJ's Mac) and, in Phase 2, by the local video worker hitting the remote control-plane.

**Trade-off, called out honestly:** the HTTP API requires the server to be **up** for any cron or skill read to succeed; the shared lib does not, but only works in-process. We ship both and let the consumer pick. **Ordering consequence (new):** the out-of-process skills are repointed in Phase 3; if they are pointed at the HTTP API while only the Phase-1 *local* loopback exists, they depend on a Mac process with no uptime guarantee — reproducing the exact Berenice-hard-fail class the migration was meant to remove. **Therefore the always-on remote plane (Phase 2) MUST precede skill-repointing (Phase 3).** This is a hard sequencing constraint (§7, R9).

The existing `lib/sanity.queries.ts` in `ggomed.co.uk` (named GROQ with a governance projection) is the **seed** for these views — but it projects **page-render** shape, not the `pifTickAssessment` criterion checks/scores. The PIF view is a **new** query that adds `pifTickAssessment{...}` (§4).

### 2.3 Incremental / webhook refresh (replaces the failing weekly ETL)

The current `notion-integration` `npm run full` sweep (`sitemap → backup → sync → deduplicate → evidence → enhance → pif-tick → keywords → validate`) is **retired**. Replacement:

- **GROQ-live** for all content/PIF reads — no mirror to reconcile. (This is what removes the >30-min sweep; it lands in Sprint 1.)
- **Webhook-driven incremental refresh** for the cache's per-page schema slice: a Sanity publish updates **that single item**, not a full crawl. Reuse the existing signed-webhook contract in `ggomed.co.uk` `app/api/revalidate/route.ts` (`parseBody` + `isValidSignature`, body `{_type, slug}`). **This is Phase 2** — see the honesty note below.
- **Light cron ONLY for the external-API cache** (SEMrush weekly; GA4/Search Console weekly; sitemap daily-ish). No monster sweep.

**Honesty note (was under-stated):** the heaviest old stage — the JSON-LD scrape (one HTTP GET per page, the likely >30min culprit) — becomes **per-page on webhook**, but **that webhook-per-page refresh is Phase 2**, not Sprint 1. In Sprint 1 the scrape simply *is not run* (GROQ-live carries content/PIF; JSON-LD is read from its existing Notion-resident slice via the cache shim). So Sprint 1 gets the sweep-retirement win from GROQ-live, but the specific JSON-LD performance mechanism lands later.

### 2.4 Two-tier deploy (12-factor, deployment-agnostic)

Build **deployment-agnostic**: all config via env, no hardcoded loopback URL.

- **Phase 1 (now):** everything runs **local loopback on the Mac**. Read cockpit + view layer + parity harness.
- **Phase 2 (later):** two tiers —
  - **Remote always-on control-plane:** read UI + LIGHT generative (pages / social text / newsletter) + cron dispatch + the view HTTP API. Gives JJ mobile access. **Must exist before Phase 3 skill-repointing (§2.2).**
  - **Local Mac worker:** HEAVY generative (Greta/Titti video via ffmpeg/whisper), where raw footage and binaries live. Remote **enqueues** video jobs; the local worker **drains** them.

### 2.5 ASCII architecture

```
                        ┌─────────────────────────────────────────────┐
                        │        THE SHELL (Next.js 16 cockpit)         │
                        │   Editorial · PIF · Ernesto* · Ambrogio(ro)   │
                        └───────────────┬───────────────┬──────────────┘
                                        │ imports        │ HTTP
                        ┌───────────────▼──────┐         │
                        │  VIEW LAYER (shared) │◄────────┴──── /api/views/*  ◄── skills (le ragazze)
                        │  named GROQ views    │                              (out-of-process, Phase 3)
                        └───┬────────┬─────────┘
              GROQ (live)   │        │   GROQ (live, PIF slice only)
         ┌──────────────────▼──┐  ┌──▼───────────────────────┐
         │ Sanity: gxyjgvr0    │  │ Sanity: m05ykm6e         │   (two clients — no cross-project join)
         │ GGOMed site + PIF   │  │ Compass PIF slice only   │
         └─────────────────────┘  └──────────────────────────┘

   Notion SDK (workflow state)          CACHE tier (external APIs)
   ┌───────────────────────────┐        ┌───────────────────────────────────────────┐
   │ Content Calendar, Topic   │        │ SEMrush · GA4 · Search Console · JSON-LD   │
   │ Pool, Ernesto Desk, ...   │        │ · sitemap                                  │
   │ Ambrogio Audits/Proposals │        │ Phase 1: cache-read shim over Notion       │
   │ (SKILL writes; Shell ro)  │        │ Phase 2: cache OWNS data; webhook-per-page │
   └───────────────────────────┘        └───────────────────────────────────────────┘

  Phase 2:  [ Remote control-plane: UI + light gen + cron + view API ]  ── must precede Phase-3 repoint
                          │ enqueue video jobs
                          ▼
             [ Local Mac worker: Greta/Titti ffmpeg/whisper — drains queue ]

  * Ernesto (generative) = later sprint.  Sanity publish → webhook → refresh THAT item (Phase 2).
```

---

## 3. The 4 modules

### Module 1 — Editorial views  *(Sprint 1, read-only)*
- **Shows:** the GGOMed site content (from live GROQ) alongside every native-state Notion editorial DB, behind **aggregated cross-source filters** (by cluster, status, platform, review-due, PIF state).
- **Data sources:** GROQ-live (GGOMed `gxyjgvr0` content docs: `_type`, `_id`, `_updatedAt`, `title`, `slug.current`, `showPifTick`, `lastReviewed`, `publishDate`, `category->`, `reviewedBy->`); Notion SDK (Content Calendar, Topic Pool, Ernesto Desk, Publish Events Queue, Newsletter Items, Media Assets, Content Needs, Content Requests, Agents Activity Log, Patient Journeys).
- **Honest limit:** GGOMed content schemas carry **no workflow-status enum**. Pipeline stage (draft/review/published) lives only in Notion. The GROQ side can only surface `_updatedAt` / `lastReviewed` / `publishDate` / `showPifTick`.

### Module 2 — PIF Tick  *(Sprint 1, read-only)*
- **Shows:** every PIF criterion, per content asset, across **both** Sanity projects, in one normalised grid (criterion-grid + review-due + badge-lit). See §4.
- **Data sources:** two GROQ reads (`gxyjgvr0` PIF-view query + `m05ykm6e` PIF slice), normalised app-side into `PifRow[]`.

### Module 3 — La Casa di Ernesto (generative)  *(Phase 2 — LATER, not Sprint 1)*
- **Does:** in-shell Anthropic generation for social / video / pages, **bespoke per skill-family** (not one runner). Samantha→Notion, Greta/Titti→local video worker.
- **Deviation from the locked module definition (named explicitly, per review):** the locked decision defines module 3 as "pages/social/video". This spec **carves Family A (copywriter→Sanity draft) OUT of the cockpit** and leaves Polaris/Compass content authoring in the Helm, because that content is Patient-Compass IP authored under the Helm's clinician-governance gates and does not belong in the GGOMed operator cockpit. This is a deliberate re-scope, **flagged for JJ's ratification in OQ7**, not a silent drop. If JJ wants pages-into-Sanity in the cockpit, it re-enters as a fourth adapter.
- **Data sources:** view layer (read) + family-specific sinks (Notion / job-queue). **Anthropic only** — the Gemini stub is dropped.
- **Gate:** the loop drafts; the 3 publish gates stay JJ-only.

### Module 4 — Lo Studio di Ambrogio (oversight)  *(read side Sprint 1; full tower later)*
- **Shows:** Ambrogio Audits and Ambrogio Proposals (read-only), plus the Agents Activity Log as the observability spine.
- **Data sources:** Notion SDK (read-only).
- **Governance (hard) — corrected mechanism:** Ambrogio's independence-by-construction rests on **who may write its two Notion DBs**. Verified reality: **the `ambrogio-il-maggiordomo` SKILL is the sole writer** of `🎩 Ambrogio Audits` and `🎩 Ambrogio Proposals`. No repo JS writes audit content — the only JS touching those DBs is `scanner/ambrogio-cartografina.js` (a deterministic map into `ecosystem-data.json`), `ops/inspect-notion-dbs.js`, and read-only activity aggregators. JJ flips `Decision`; Battista flips `Applied` on Implemented rows.
  - **The Shell's obligation is therefore purely negative and testable:** the cockpit must expose **zero** create/update/append code path to `NOTION_AMBROGIO_AUDITS_DB` or `NOTION_AMBROGIO_PROPOSALS_DB`, and must never route a skill/dispatch action at them. Enforce with a unit test that asserts no Notion write call in the codebase targets those two env ids, plus a lint trip-wire on those identifiers in any write helper. (There is no `write-audit.js` to assert against — that was a fabrication in the draft.)

---

## 4. PIF module deep-dive

### 4.1 The two-project problem
PIF data lives in **two different Sanity projects with different schemas**, and **GROQ cannot join across projects**. Confirmed by reading both schemas:

- **GGOMed marketing site** — project **`gxyjgvr0`**, dataset **`staging`** in local env (**confirm production project/dataset in Vercel before wiring — OQ1, Sprint-1 BLOCKER §7.0**). PIF = two embedded objects (`pifTickAssessment`, `pifTickGovernance`) + computed `showPifTick` on 4 doc types: `dedicatedPage`, `categoryHubPage`, `blogPost`, `legalPage`. **A read token is required** — `medicalInterventionEntity` docs are private; anonymous GROQ silently omits them.
- **Patient-Compass / Compass** — project **`m05ykm6e`**. PIF = `pifChecks` + `pifGovernance` + immutable `pifCertification` audit doc on `medicalIntervention` (Polaris) and `ggoProcedure` (Compass). This is the **only** m05ykm6e read the cockpit does. Capability-gated to the `ggomed` BrandKit — single-tenant.

→ **Two queries + app-side normalisation into one `PifRow`.** No cross-join.

### 4.2 The criterion-mismatch trap (verified in code)
The two systems do **not** gate on the same four criteria:

- `gxyjgvr0` `pifTickAssessment` manual checks: `readabilityCheck`, `healthInequalitiesCheck`, **`transparencyCheck`**, `evidenceBasedCheck`. There is **no `expertPeerReview` field** — expert peer review is **derived** from `pifTickGovernance.reviewer` being present.
- `m05ykm6e` `pifChecks`: `evidenceBasedReview`, `patientReadability`, `inclusivityAssessment`, **`expertPeerReview`**. There is **no transparency check**.

Map **by criterion, not by key string.**

### 4.3 Normalised criteria union (FIVE rows)

| Normalised criterion | GGOMed (`gxyjgvr0`) | Compass (`m05ykm6e`) |
|---|---|---|
| Evidence-Based Review (4.1) | `evidenceBasedCheck` (+advisory `evidenceBasedScore`) | `evidenceBasedReview` |
| Patient Readability (6.1) | `readabilityCheck` (+`tier1ReadabilityScore`/`targetScore`) | `patientReadability` |
| Inclusivity Assessment (6.3) | `healthInequalitiesCheck` (+advisory `inclusivityScore`) | `inclusivityAssessment` |
| Expert Peer Review (4.2) | **derived:** `governance.reviewer` present ⇒ true | `expertPeerReview` (stored bool) |
| **Transparency** | `transparencyCheck` (+advisory `transparencyScore`) | **N/A — always `null`** |
| **Declaration (computed badge)** | `showPifTick` (stored, computed there) | recompute in app (see 4.4) |

### 4.4 Badge-lit is computed, not queryable (on BOTH sides)
- **GGOMed:** `showPifTick` is a stored boolean, auto-reconciled in `ComplianceChecksInput.tsx` from the four manual checks. Read it directly; **do not** re-derive certification from LLM scores.
- **Compass:** `showPifTick` is computed in `normalisePathway` (`registry.ts`), **not in GROQ**. The cockpit must **replicate the predicate app-side**: `certified (a pifCertification exists) && syncStatus != 'flag-for-review' && nextReviewDate >= today && all four checks ticked`. A `pifReviewLapsed` downgrade exists.
- **Compass Studio-schema gap (ADR-0124 D3):** `pifChecks`/`pifGovernance` are not declared on the `ggoProcedure` Studio schema — the fields exist on docs but Studio shows them as unknown. **Query the raw fields**, do not rely on schema presence.

### 4.5 Governance/lifecycle field mapping (for the row)
`reviewerName` (GGOMed: resolve `governance.reviewer._ref` via `author` doc; Compass: `pifGovernance.reviewerName`); `reviewerRegistration` (Compass only: `reviewerGmcNumber` + `reviewerRegistrationBody`); `publicationDate`, `lastReviewed`, `nextReviewDate`, `reviewCycleYears`; `evidenceRefs` (GGOMed: `references`+`guidelines`; Compass: `pifGovernance.references[]` + `pifCertification.evidenceRefs`); `certificationAudit` (Compass only — `pifCertification` with certifier, `_rev`, `signedAt`; **sparse/absent for GGOMed rows**). "Overdue" = `nextReviewDate < now()`.

**Parity caveat:** the retired `7-pif-tick.js` ETL `applyFallbackTicks()` auto-ticked checks from corroborating Notion content, so old mirror rows may hold ticks never set in Sanity. The parity proof must account for fallback-derived ticks as a **known accounted delta** (§5.2), or the new GROQ view will legitimately differ.

**Reuse pattern:** `getPifValidations()` in `GGO-content-manager` already app-side-joins PIF validations to Content Assets — same shape as this cross-project merge. **Caveat (from review):** that helper reads the *PIF Tick Compliance mirror* (a doomed DB). Reuse it as a **pattern to copy**, then repoint its source to the GROQ PIF slice; do not keep it wired to the mirror past Phase 3.

---

## 5. Migration plan (retire the 4 mirror DBs — carefully, and last)

**Nothing is retired until (a) the parity proof clears AND (b) the manual-divergence check clears AND (c) every consumer is repointed AND (d) the remote plane exists (§2.2 ordering).** Order matters: **repoint skills BEFORE archiving any DB**, or Berenice hard-fails.

**Berenice hard-fail premise (re-verified, citation corrected):** Berenice looks up the Content Asset DB by a **hardcoded id** — `NOTION_CONTENT_ASSET_DB=70a1edd2023e46e199f99165d77faf9b`, at `~/.claude/skills/berenice-la-ricercatrice/notion-databases.md:34` (and the DB-ID heading, line 63). If that DB is archived before she is repointed, she resolves nothing and her routing stops. (The draft's grep-miss is corrected; the id is real.)

### 5.1 Consumers to repoint
**Fable must re-open each file below before relying on it — the draft cited these as verified but the Ambrogio fabrication proves citations can drift.**

**`ernesto-agents-house` — Content Assets reads → GROQ view:** `core/notion-client.js` `buildAssetPathnameLookup()` (the single choke-point — repoint this one helper and both ingesters follow); `ingesters/ga4.js`, `ingesters/search-console.js`; `operations/review-due-scan.js`; `operations/newsletter-scan.js`; `operations/pif-tick-lookup.js`; `scanner/state-drift-detection.js` (`detectContentAssetDrift`).

**`ernesto-agents-house` — Content Assets WRITES / relation targets (the hard part):** `operations/content-asset-status-flip.js` (the sanctioned `Status → ⚠️ Needs Update` write); `operations/content-needs-writer.js` + `review-due-scan.js` (Content Needs `'Content Assets'` **relation** into Content Asset). Content Needs, Performance Snapshot (`.Asset` relation from ga4/search-console), Newsletter Items and PIF Tick Compliance all **relate into** Content Asset. See §5.5 for the identity-swap mechanism this forces.

**`ernesto-agents-house` — PIF Tick Compliance read → GROQ PIF slice:** `operations/pif-tick-lookup.js` (currently joins Content Asset ↔ PIF Compliance via a Notion relation, and reads PIF fields off the Content Asset row — reproduce this join app-side per §4).

**Editorial skills (`~/.claude/skills`):** **Berenice** (heavy: routing/review-due reads, Status-flip write, Content-Needs writes, Evidence read; hardcoded Content Asset id per above) → repoint reads to views, keep writes as dispatch targeting new asset identity; **Ernesto** (published/updated-30d, newsletter-candidate reads); **Emily** (transitive `Related Asset → Content Asset → Topic Pool` chain — the view layer must preserve asset↔topic linkage; see §5.5); **Natascia** (read-only); **Daria** (topic→slug lookup).
**Do NOT chase noise:** `ggomed-page-writer(-v2)` "PIF Tick Compliance Fields" are Sanity content-body fields, not the Notion DB; `compass-copywriter`/`ccgs-document-writer` "evidence sources" is prose; `xlsx/pptx/docx/mcp-builder` "schema validation" is unrelated tooling.

**Zero-consumer DBs (cheap):** Evidence Sources and Schema Validation have **no operational consumers** (confirmed by `.env.example` lines 24–27 + grep — only the Cartografina reachability scan touches them). No repointing needed; retire once parity clears.

### 5.2 Parity proof — a RECONCILED diff, not a byte-identical one
**Restated per review.** "Confirm identical" is the wrong gate: the spec's own facts guarantee the two sides differ (fallback-ticks, backup-vs-live temporal skew, Notion-only manual edits). The correct deliverable is:

> **Run the old mirror-writing ETL output vs the new GROQ view output, diff, and confirm that every difference is explained by a member of a closed set of KNOWN causes.** If any difference falls outside that set, the gate fails.

Closed set of accounted deltas:
1. **Fallback ticks** — `applyFallbackTicks()` in `7-pif-tick.js` auto-set checks from Notion corroboration that were never set in Sanity.
2. **Backup-vs-live temporal skew** — the ETL reads a Sanity **backup** (`backups/latest.json`), not live GROQ; anything published between backup and run legitimately differs.
3. **Migrated manual edits** — Notion-only human edits (§5.3) that will be carried across before drop.

ETL scripts (path corrected): `notion-integration/src/3-sync.js`, `src/5-evidence-sync.js`, `src/7-pif-tick.js`, `src/9-validate.js` (verified present under `src/`). The harness output is a **reconciliation report** (`identical | accounted(cause) | UNEXPLAINED`), and only a zero-`UNEXPLAINED` run unlocks Phase 3.

### 5.3 Manual-divergence check (data that exists ONLY in Notion)
Before Content Assets can die, audit for hand-edited fields not reconstructable from Sanity: `Status`, `Review Due`, `Last Reviewed`, `PIF TICK Reviews` (relation), `Evidence` (relation), `Topic Pool` (relation), and any relations pointing **into** Content Asset from Content Needs / Newsletter Items / Performance Snapshot. On PIF Tick Compliance: `Review Date`, `Compliance Mismatch` checkbox. These read as `JJ / compliance workflow` human writes. **If divergence exists, migrate it before drop (§5.5), or it is lost** (OQ3 decides how much).

### 5.4 What dies, and only after what
Retire **Content Assets, PIF Tick Compliance, Evidence Sources, Schema Validation** — only after 5.1 (all repointed), 5.2 (reconciled, zero unexplained), 5.3 (divergence migrated), 5.5 (identity swap executed). Keywords and Patient Journeys **stay** (Keywords → cache tier; Patient Journeys → native editorial, pending OQ4). **This whole section is Phase 3, not Sprint 1.**

### 5.5 The identity swap (pageId → Sanity `_id`) — the data-integrity landmine, now with a mechanism
**This is where the relational graph is lost if executed by hand-waving.** `buildAssetPathnameLookup()` today keys assets by **Notion pageId**. Repointing it to GROQ makes the natural key a Sanity `_id`. But four surviving Notion DBs (Content Needs, Performance Snapshot, Newsletter Items, PIF Tick Compliance) hold **Notion relation columns** pointing at Content Asset *pages* — and **a Sanity `_id` string cannot populate a Notion relation** (relations point at Notion pages, not arbitrary strings). Emily also traverses `Related Asset → Content Asset → Topic Pool`.

**Decision required from JJ (OQ9), between two mechanisms — do not let Fable pick silently:**

- **Mechanism A — retain a thin Notion "Asset Stub" DB.** Content Assets stops being the *content mirror* (no PIF/body/status columns) but survives as a **minimal stub table**: one row per asset carrying only `{ pageId (stable), sanity_id, pathname, title }`. All surviving relations keep pointing at the stub; the stub's `sanity_id` is the join key into GROQ. Cheapest to migrate (relations untouched); cost is that "Content Assets dies" becomes "Content Assets is gutted to a stub", which contradicts the clean-kill framing but preserves the graph. **Recommended default.**
- **Mechanism B — de-relation to a text key.** Migrate every relation column to a **text/URL key** (the pathname or `sanity_id`), then rewrite every consumer that *traverses* those relations (Emily's chain, `content-needs-writer`, `pif-tick-lookup`) to resolve the key app-side instead of following a Notion relation. Fully removes Content Assets; cost is a rewrite of every relation-traversing consumer and loss of Notion's native relation UI/rollups on those columns.

Whichever is chosen, the **view layer must expose a stable `assetIdentity` view** (`pathname → { sanity_id, title }`) as the single join surface, so consumers depend on the view, not on a raw Sanity shape. The migration executes only after this view is proven against live data in the parity harness.

---

## 6. Foundation & reuse

### 6.1 GGO-content-manager (the base — `main` only)
**Verified `main` state:** no auth, no tests, no chart lib, no hooks, no Sanity/Anthropic. Deps: `@google/generative-ai`, `@notionhq/client` 2.2.3, next 16.1.6, react 18.2, tailwind 4. The `lib/auth/*`, `middleware.ts`, `__tests__/`, content-requests/feedback routes named in scoping exist **only in the `nervous-lovelace` worktree, NOT on `main`.** **Decision for Fable: start from `main`.** (If auth is wanted in Sprint 1, cherry-pick from that worktree as a discrete step — but it is not required for a read-only cockpit — OQ6.)

**KEEP (extend as-is):**
- `lib/notion/` (~700 LOC crown jewel): `client.ts` (fail-fast env) → `services.ts` (`fetchAll<T>`) → `mappers.ts` (null-safe typed extractors) → `schema.ts` (`SCHEMA` constant) → `types.ts`. This **is** the "Notion is truth, read via SDK" tier. `getPifValidations()` app-side join = the PIF-normalisation pattern (repoint per §4.5 caveat).
- `lib/cache.ts` (TTL + stale-while-revalidate) → the external-API cache tier. **In-memory/per-process** — fine for Phase-1 loopback; needs a durable/shared backend before the Phase-2 remote+worker split (R10).
- `components/AppShell.tsx`, `Sidebar.tsx`, `Icons.tsx` — cockpit skeleton to extend with the 4 modules.
- Thin `app/api/notion/*/route.ts` `cached(key, service)` pattern — add view routes alongside.

**REPLACE / DROP:**
- `app/api/ai/validate/route.ts` (Gemini) — **DROP**; remove `@google/generative-ai` from `package.json`; delete `GOOGLE_GEMINI_API_KEY`. Stand up the Anthropic runner in its place.
- Fake UI: `Sidebar.tsx` hardcoded "Last synced: 2 min ago" / "Sarah Mitchell" / decorative Sync+Settings buttons → replace with real state.
- `REQUIRED_ENV` throw-at-import array in `client.ts` → replace with a central 12-factor config module (§8) with slots for Sanity/Anthropic/view-API.

**ADD (net-new, greenfield on main):** `@sanity/client` read clients for **two** projects; the shared named-GROQ-view service (package + HTTP API); `@anthropic-ai/sdk` runner (Phase 2); `SCHEMA`/mapper/service/type blocks for the 7 editorial-workflow Notion DBs (absent from `main`'s `SCHEMA`); the parity harness. Note: `app/layout.tsx` does **not** wrap children in AppShell and every page is a `"use client"` + `useEffect`/`fetch` component — the server-side GROQ reads need a **new server-component rendering path**, not a drop-in.

### 6.1a Existing pages that read the doomed DBs (silent gap in the draft — now dispositioned)
`main`'s `SCHEMA` and its existing pages (**content-explorer, validation-hub, evidence-repository, schema-validation**) are wired to **Content Assets, PIF Tick Compliance, Evidence Sources, Schema Validation** — the four DBs §5 retires. This means from Sprint 1 through Phase 3 the app runs **two contradictory data models at once**: new modules read live GROQ; the old pages read soon-to-be-dead mirrors. Disposition:

- **Sprint 1:** leave the four legacy pages **in place and untouched** (they still work against the live mirrors). Do **not** wire them to GROQ yet. The new Editorial/PIF modules are the GROQ-backed replacements and ship alongside.
- **Sprint 1 exit criterion:** the new modules must reach **functional parity** with what the legacy pages showed (this is *also* what the §5.2 harness measures), so that the legacy pages become redundant *to the user* before they become dead *in data*.
- **Phase 3 (with the DB retirement):** delete the four legacy pages in the **same** change that archives their DBs — never leave a page pointed at an archived DB. Until that change lands, they are the fallback if a GROQ module regresses.

This is deliberate transitional duplication, bounded by an exit criterion — not permanent drift.

### 6.2 Lifted from the Helm skill-runner (reference-only, as a library)
Borrow the **pattern**, do not build in `chrysalis-compass`. The genuinely reusable, family-agnostic core (from `apps/clinician-shell/src/lib/skills/`): the Messages-API tool-use **loop** + **transport** (`transport.ts` — `makeCreateTurn`, `withKeepalive`); run lifecycle (idempotent runId, `abort-registry.ts`, heartbeat/lease/stale-reaping in `runs.ts`, `background.ts` chaining); `RunContext` (`run-context.ts`, `withDraftLock`, fan-out); the `RunEvent` NDJSON taxonomy (`types.ts`); prompt-cache assembly (`buildSystemBlocks`, `cache_control` on last block).
**Do NOT port:** `RUNNER_RULES` (clinician-governance prose), the Sanity-hardwired `persist-draft.ts` sink, tool schemas encoding the Sanity content model, TenantConfig/quota entanglement, `SkillId`/`product` closed unions. Define a **`SkillFamilyAdapter`** interface — `{ systemRules, tools, dispatch, sink, completeness, audit }` — that the loop consumes; concrete adapters for Family B (Samantha→Notion) and Family C (Greta/Titti→job-queue). Family A (copywriter→Sanity) is **out of cockpit scope** (§3-Module 3 / OQ7). **Honest:** this is a genuine refactor, not lift-and-shift — the current `runSkill` is a ~1000-line monolith with dependencies threaded as inline locals (R11). Port the prompt-cache characterization test with the library or caching silently degrades. Port the injection-defence half of the SECURITY block; replace the clinical half. **Family C (video) breaks the "leg = another Messages turn" assumption** — a leg = a worker process; continuation = poll worker job status. **All of this is Phase 2.**

### 6.3 Helper libs from notion-integration (external-enrichment)
Carry only the genuinely non-GROQ-derivable external fetchers into the cache tier: **sitemap** (`lib/sitemap-client.js` — but **unify** with `ernesto-agents-house` `operations/fetch-sitemap.js`; two implementations exist, pick one — R13); **JSON-LD scrape** (`lib/schema-extraction.js` `fetchPageSchema` — per-page on webhook in Phase 2, not full-crawl); **SEMrush** (`lib/semrush-client.js` — paid/rate-limited, retry/backoff built in, keep weekly); GA4/Search Console live in `ernesto-agents-house/ingesters/`. **Do NOT carry:** stages 3/4/5/7 (Sanity→Notion mirror steps — replaced by GROQ); stage 9-validate (integrity check over mirrors, mostly moot post-retirement — keep only PIF-linkage checks against live data); the 3 stub ingesters (Meta/Beehiiv/Vercel — roadmap). The old write-back-to-Notion path (Keywords/Schema Validation DBs) **disappears in Phase 2**; the cache tier owns this data directly from Phase 2 on.

---

## 7. Phased plan

### SPRINT 1 — the READ COCKPIT (read-only modules + view layer; parity harness on a parallel track)

> Ordered backlog. **No writes anywhere.** Modules delivered: Editorial views, PIF read, Ambrogio read side. **Not** delivered: generative, remote+worker, Notion→Sanity migration.
>
> **On the "~3 days" figure (honest restatement per review):** the *target* is a ~3-day Fable build for S1.0–S1.5 + S1.7. This is **aggressive-to-optimistic** — `main` has no Sanity client, no Anthropic, zero tests, no server-render path, and its crown-jewel Notion lib is wired to DBs being retired. Twelve non-trivial items on a codebase with no test scaffolding will not reliably fit 3 days. Therefore **S1.6 (parity harness) is explicitly split onto a parallel track** and is allowed to land after the read cockpit without failing the sprint — it gates Phase 3, not Sprint-1 sign-off. Treat 3 days as the read-cockpit target; treat the harness as its own multi-day task.

**S1.0 — Config & clients (foundation) — contains the Sprint-1 BLOCKER**
1. **BLOCKER (resolve OQ1/OQ2 before wiring):** confirm the **production** GGOMed Sanity project id + dataset in Vercel, and that a read token is held. If production is `gxyjgvr0`/`production` (not `staging`), §8's example values change; if it is a *different* project id, all `gxyjgvr0` references change. **Without this, Modules 1 and 2 can be built against `staging` and silently show the wrong/empty PIF set in production.** Do not treat as a background open question — it blocks real-data wiring.
2. Create `lib/config.ts` — central 12-factor typed config; validate at boot; slots for Notion, both Sanity projects, SEMrush, analytics, Anthropic, `VIEW_API_BASE_URL` (no hardcoded loopback). Replace the `REQUIRED_ENV` throw-array. Preserve **lazy env resolution** for Notion DB ids.
3. Add `@sanity/client`. Create `lib/sanity/clients.ts` — two read-only clients: `ggomedClient` (`gxyjgvr0`, `useCdn:false`, `token: SANITY_VIEWER_TOKEN`) and `compassPifClient` (`m05ykm6e`, `SANITY_M05_VIEWER_TOKEN`).
4. Remove `@google/generative-ai`; delete `app/api/ai/validate/route.ts` and `GOOGLE_GEMINI_API_KEY`.

**S1.1 — View layer (shared lib + HTTP API)**
5. Create `packages/views` (or `lib/views/`): named GROQ views — `editorialContentView`; `assetIdentityView` (`pathname → { sanity_id, title }`, the single join surface for §5.5); `pifGgomedView` (adds `pifTickAssessment{ the four *Check, scores, assessedAt, contentHash, llmModel }` + `pifTickGovernance{...}` on the 4 doc types); `pifCompassView` (`m05ykm6e` raw `pifChecks`/`pifGovernance`/`pifCertification`). Seed from `ggomed.co.uk` `lib/sanity.queries.ts`.
6. Expose HTTP: `app/api/views/[view]/route.ts` — thin `GET`, `Cache-Control`, sanitised error. This is what skills will call in Phase 3.

**S1.2 — Notion editorial-state read layer**
7. Extend `lib/notion/schema.ts` + `mappers.ts` + `services.ts` + `types.ts` with the 7 editorial DBs: Content Calendar, Topic Pool, Ernesto Desk, Publish Events Queue, Newsletter Items, Media Assets, Content Needs (+ Content Requests, Agents Activity Log). **Env-id source = `ernesto-agents-house/.env.example`.** Handle **`status`-type** props (Content Needs `Action Status`, Newsletter Items `Status`) vs `select` — read `.status.name` vs `.select.name`. Reconcile the `NOTION_CONTENT_ASSETS_DB` (plural, this app) vs `NOTION_CONTENT_ASSET_DB` (singular, ernesto) name clash to one (OQ5). Reuse `SCHEMA_EXPECTATIONS` option strings rather than re-declaring (drift risk).

**S1.3 — Module 1: Editorial views UI**
8. Server-component page rendering GROQ-live content + Notion editorial rows behind aggregated filters (cluster / status / platform / review-due / PIF). New server-render path (not the existing `"use client"`+`useEffect` pattern).

**S1.4 — Module 2: PIF read UI + normalisation**
9. `lib/pif/normalise.ts` — two reads → `PifRow[]` (five-criterion union §4.3); recompute Compass badge-lit predicate app-side (§4.4); resolve GGOMed `reviewer._ref` via `author`.
10. PIF grid UI: criterion-grid + review-due + badge-lit, GGOMed and Compass rows side by side.

**S1.5 — Module 4: Ambrogio read tower**
11. Read-only Audits + Proposals + Agents Activity Log. **Assert in code: no create/update/append path targets `NOTION_AMBROGIO_AUDITS_DB` / `NOTION_AMBROGIO_PROPOSALS_DB`** (unit test + lint trip-wire; §3-Module 4). The skill remains the sole writer.

**S1.6 — Parity harness (parallel track; gates Phase 3, not Sprint-1 sign-off)**
12. `tools/parity/` — run `notion-integration/src/{3-sync,5-evidence-sync,7-pif-tick,9-validate}.js` output vs new GROQ views, produce a **reconciliation report** (`identical | accounted(cause) | UNEXPLAINED`) accounting for backup-vs-live and `applyFallbackTicks` (§5.2). Multi-day; may land after the read cockpit.

**S1.7 — Cache tier (Phase-1 shim, honest scope)**
13. Wire `lib/cache.ts` to serve SEMrush/GA4/Search Console/sitemap **as a cache-read shim over their existing Notion-resident data** — this is **not** yet the third tier owning external data (that is Phase 2). Unify the two sitemap fetchers into one. **Do not** claim the JSON-LD-per-page performance win here; it is Phase 2. GA4/Search Console **service-account auth** (ADC / `GOOGLE_APPLICATION_CREDENTIALS`, not a key) is a known multi-hour setup — only wire it in Sprint 1 if live analytics are needed in a module; otherwise defer the credential setup to Phase 2 and note it (R15).

### PHASE 2 — remote + worker, generative module (La Casa di Ernesto)
- Two-tier deploy: always-on remote control-plane (UI + light gen + cron + view API) + local Mac worker (video). Durable/shared cache backend (replace in-memory Map). **Cache tier now OWNS external data**; JSON-LD refresh moves to webhook-per-page (the actual >30-min-scrape fix lands here).
- Extract the Helm runner **library** (§6.2) + `SkillFamilyAdapter`. Build Family B (Samantha→Notion) and Family C (Greta/Titti→job-queue; remote enqueues, local drains). Family A stays in the Helm. Anthropic only. 3 publish gates JJ-only.
- **Hard ordering:** the remote plane must be live **before** Phase 3 repoints out-of-process skills at the view HTTP API (§2.2, R9).

### PHASE 3 — Notion → Sanity migration (retire the 4 mirror DBs)
- **Precondition:** remote plane live (Phase 2).
- Execute §5 in order: repoint all consumers (skills first) → parity reconciled (zero unexplained) → manual-divergence migrated → identity swap executed (§5.5, mechanism per OQ9) → in the **same change**, delete the four legacy pages (§6.1a) and archive Content Assets, PIF Tick Compliance, Evidence Sources, Schema Validation. Keywords + Patient Journeys stay.

---

## 8. Env & secrets (12-factor)

Central typed config module (`lib/config.ts`), validated at boot, **no hardcoded loopback**. Example project ids below are the *local* values and are **provisional pending OQ1/OQ2** (the Sprint-1 blocker).

| Env var | Purpose |
|---|---|
| `NOTION_API_KEY` | Notion SDK (editorial state + Ambrogio read + cache-resident DBs) |
| `NOTION_CONTENT_CALENDAR_DB`, `NOTION_TOPIC_POOL_DB`, `NOTION_ERNESTO_DESK_DB`, `NOTION_PUBLISH_QUEUE_DB`, `NOTION_NEWSLETTER_ITEMS_DB`, `NOTION_MEDIA_ASSETS_DB`, `NOTION_CONTENT_NEEDS_DB`, `NOTION_CONTENT_REQUESTS_DB`, `NOTION_AGENTS_ACTIVITY_LOG_DB` | Editorial-state DB ids (source: `ernesto-agents-house/.env.example`) |
| `NOTION_AMBROGIO_AUDITS_DB`, `NOTION_AMBROGIO_PROPOSALS_DB` | Ambrogio read-only — **Shell must hold no write path to these** (asserted in code, S1.5) |
| `NOTION_KEYWORDS_DB`, `NOTION_PATIENT_JOURNEYS_DB` | Cache-tier (Keywords) / native (Patient Journeys) |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` (**`gxyjgvr0`, confirm in Vercel**), `NEXT_PUBLIC_SANITY_DATASET` (**confirm `staging` vs `production` — BLOCKER**), `NEXT_PUBLIC_SANITY_API_VERSION` (`2025-12-03`) | GGOMed content + PIF read |
| `SANITY_VIEWER_TOKEN` | GGOMed read-only token (private `medicalInterventionEntity` docs need it) |
| `SANITY_M05_PROJECT_ID` (**`m05ykm6e`**), `SANITY_M05_DATASET` (`production`), `SANITY_M05_VIEWER_TOKEN` | Compass PIF slice, read-only |
| `SANITY_WEBHOOK_SECRET` | Verify incoming Sanity publish webhook (reuse `isValidSignature` contract) — **Phase 2** |
| `SEMRUSH_API_KEY`, `SEMRUSH_DOMAIN`, `SEMRUSH_DATABASE` (`uk`) | SEMrush cache (paid, rate-limited) |
| `GA4_PROPERTY_ID`; Google service-account creds (ADC / `GOOGLE_APPLICATION_CREDENTIALS`), `GOOGLE_DWD_SUBJECT` (optional), `SEARCH_CONSOLE_SITE_URL` | GA4 + Search Console cache — **service-account, not a key; setup is a known multi-hour task, deferrable to Phase 2 (R15)** |
| `SITEMAP_URL` | Sitemap cache (unify the two fetchers) |
| `ANTHROPIC_API_KEY` | In-shell skill-runner (Phase 2). **Anthropic only.** |
| `VIEW_API_BASE_URL` | View HTTP API base — loopback in Phase 1, remote in Phase 2. No hardcode. |
| ~~`GOOGLE_GEMINI_API_KEY`~~ | **DELETE** — Gemini dropped |

---

## 9. Risks register

| # | Hard truth / risk | Mitigation |
|---|---|---|
| R1 | External enrichment (scrape/SEMrush/GA4) is **not GROQ-derivable** | Keep the cache tier as a first-class data class; light cron + (Phase 2) webhook-per-page for JSON-LD; never derive these from Sanity. |
| R2 | PIF spans **two Sanity projects, different schemas**; GROQ can't cross-join | Two clients, two queries, app-side normalise into `PifRow[]` (§4); map by criterion not key. |
| R3 | **Criterion mismatch:** GGOMed has `transparencyCheck` (no expert-peer field, derived); Compass has `expertPeerReview` (no transparency) | Five-row union; Transparency `null` for Compass; derive Expert Peer Review from `governance.reviewer` on GGOMed. |
| R4 | `showPifTick` is **computed, not queryable** on both sides; Compass computes it outside GROQ | Read GGOMed's stored `showPifTick`; replicate the Compass `normalisePathway` predicate app-side; never re-derive from LLM scores. |
| R5 | Killing Content Assets **orphans every Notion relation** pointing into it; a Sanity `_id` cannot fill a Notion relation | **Mechanism decided in OQ9** — stub DB (A) or de-relation to text key (B); `assetIdentityView` is the single join surface; execute only after harness proves it (§5.5). |
| R6 | **Berenice hard-fails** if Content Asset DB is archived before she's repointed (hardcoded id `70a1edd…` at `berenice-la-ricercatrice/notion-databases.md:34`, **verified**) | Repoint all skills BEFORE archiving any mirror DB (strict ordering §5); remote plane must exist first (R9). |
| R7 | **Manual-edit divergence** — Status/Review Due/relations hand-written into mirrors, not in Sanity | Mandatory divergence audit (§5.3) and migration before drop; **parity gate is reconciled-with-accounted-deltas, not byte-identical** (§5.2). |
| R8 | Generative module is **bespoke per skill-family**, not one runner; video breaks the model-writes-docs shape | `SkillFamilyAdapter` interface; Family C uses enqueue→drain→poll, not another Messages turn; Family A out of scope; runner is Phase 2. |
| R9 | **Shared-lib vs HTTP-API** — HTTP needs the server up; repointed out-of-process skills would depend on a Mac process with no uptime | Ship both; in-process imports the lib; **Phase 2 remote plane MUST precede Phase 3 skill-repointing** (hard ordering, §2.2/§7). |
| R10 | `lib/cache.ts` is **per-process in-memory** — not shared across Phase-2 remote/worker | Fine for Phase-1 loopback; swap to a durable/shared store before the two-tier split. |
| R11 | Helm runner is a **~1000-line monolith**, not a library; extracting it is a real refactor | Introduce the adapter interface; port the prompt-cache characterization test + injection-defence block; Phase 2 scope. |
| R12 | **Ambrogio independence** must survive UI unification — draft's `write-audit.js` anchor was fabricated | Real mechanism: the **skill is the sole writer**; the Shell exposes **zero** write path to the two Ambrogio env ids — enforced by unit test + lint trip-wire (S1.5). |
| R13 | Two **sitemap fetchers** exist (different caches/parsers) | Unify to one in the cache tier (S1.7). |
| R14 | GGOMed Sanity local env points at **`staging`**, `medicalIntervention` docs **private** | **Sprint-1 BLOCKER (S1.0/OQ1/OQ2):** confirm production project/dataset in Vercel; the cockpit **must** hold a read token or private docs vanish silently, and a staging build ships wrong/empty PIF to production. |
| R15 | **Cache tier is a Phase-1 shim, not the third tier yet**; the JSON-LD-per-page perf win and GA4/SC service-account auth land in Phase 2 | S1.7 delivers a cache-read shim over Notion only; own-the-data + webhook-per-page + service-account setup are Phase 2 (named so nobody expects the perf win in Sprint 1). |
| R16 | App runs **two contradictory data models** (legacy mirror pages + new GROQ modules) through Phase 3 | Legacy pages left untouched in Sprint 1; new modules must hit functional parity (Sprint-1 exit + harness); legacy pages deleted in the **same** change that archives their DBs (§6.1a). |
| R17 | **Family A carve-out** deviates from the locked "pages/social/video" module-3 definition | Named as a deliberate re-scope (§3-Module 3); ratify via OQ7; re-enters as a fourth adapter if JJ wants pages-into-Sanity in the cockpit. |

---

## 10. Open questions for JJ

1. **GGOMed Sanity dataset (Sprint-1 BLOCKER):** is the cockpit's production read `gxyjgvr0`/**`staging`** or a `production` dataset — or a different project id entirely? Local `.env` points at `staging`. Must be answered before Modules 1/2 are wired to real data (§7 S1.0, R14).
2. **Which GGOMed clone is the live PIF source?** Confirm the live clone/project for the marketing-site (`gxyjgvr0`) side, alongside the `m05ykm6e` slice.
3. **Mirror DBs hand-edited?** Confirm which of `Status`, `Review Due`, `Last Reviewed`, `PIF TICK Reviews`, `Evidence`, `Compliance Mismatch`, `Review Date` carry Notion-only human edits — decides how much §5.3 divergence must be migrated before retirement.
4. **Patient Journeys authorship** — native editorial (human-curated) or derived? Determines native-SDK vs cache placement. Dossier leans native; confirm.
5. **Content Asset DB env-name reconciliation** — standardise on `NOTION_CONTENT_ASSETS_DB` (plural) or `_ASSET_DB` (singular)? They point at one physical DB via two names.
6. **Start from `main`, or first merge `nervous-lovelace`?** `main` has no auth/tests/write layer. Recommend starting from `main`, cherry-picking auth later. Confirm.
7. **Family A carve-out (locked-decision deviation).** Confirm the cockpit's only `m05ykm6e` touch is the read-only PIF slice and that copywriter→Sanity authoring **stays in the Helm** — i.e. module 3 in the cockpit is social+video only. If you want pages-into-Sanity in the cockpit, it re-enters as a fourth adapter (§3-Module 3, R17).
8. **Ambrogio full-tower scope** beyond read — any interactive (still JJ-only) surface wanted later, or strictly read-forever in the Shell?
9. **Identity-swap mechanism (§5.5) — decide before Phase 3 build:** Mechanism **A** (retain a thin Notion "Asset Stub" DB keyed `{pageId, sanity_id, pathname, title}`, relations untouched — recommended) or Mechanism **B** (de-relation every relation column to a text key + rewrite every relation-traversing consumer, including Emily's chain). This choice determines whether the relational graph survives the migration.

---

## 11. Unresolved gaps carried openly (not papered over)

These could not be closed at spec time and are deliberately parked rather than assumed:

- **Production Sanity project/dataset (OQ1/OQ2, R14)** — a hard wiring blocker, not a nicety. Every `gxyjgvr0`/`staging` value in §8 is provisional until JJ confirms Vercel.
- **Manual-divergence volume (OQ3)** — the size of the §5.3 migration is unknown until the audit runs; it could be trivial (all fields reconstructable) or a real data-carry job. Phase 3 cannot be scoped precisely until then.
- **Identity-swap mechanism (OQ9, §5.5)** — a genuine design fork with different cost/UI trade-offs; left as an explicit JJ decision, not defaulted silently.
- **Berenice/skill re-verification** — the ernesto consumer files were cited as verified in the draft; given the Ambrogio fabrication, Fable must re-open each (§5.1) before repointing. The Berenice hardcoded id is the only one re-confirmed this pass.

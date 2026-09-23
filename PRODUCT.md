# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single expert operator: JJ (Giangiacomo), the clinician who owns GGOMed's
content ecosystem. He is the only user. The `next-auth` roles in the code
(`admin` / `editor` / `viewer`) are a technical scaffold, not evidence of a
team — nothing should be designed for a reader who lacks full system
knowledge.

Two usage scenes, both real:

- **Desktop (Mac, wide screen)** — orchestration, planning, reading agent
  runs, deep review. The primary scene.
- **Phone** — approvals only. Il Cancello (the review gate) is used from the
  phone between clinics, so that surface is a first-class small-screen
  target. Other modules may degrade gracefully.

## Product Purpose

The **GGOMed Operator Cockpit** ("the Shell") is one Next.js application from
which JJ observes and dispatches the entire GGOMed content ecosystem —
website content, PIF Tick compliance, social, newsletter, video, and the
autonomous agent house that produces them.

It exists to replace a failing weekly reconciliation ETL (>30 minutes) and a
scattered set of Notion mirrors with live reads at source, and to give the
agent skills and the UI a single shared view layer.

Success means: the ETL is retired in favour of live GROQ plus incremental
refresh; the agent skills read the same named views the UI does; the three
hard publish gates stay JJ-only; and Ambrogio's oversight independence
survives the unification.

## Positioning

Not a CMS and not a dashboard over a database. It is an **operator cockpit
over an autonomous agent house** — the human console for a system that
largely runs itself. Its distinguishing mechanism is the *gate*: agents
propose and draft continuously, and the product's entire reason for existing
is to present those proposals to one human for approval, modification, or
rejection. The work is done elsewhere; the decision happens here.

## Operating Context

- Runs locally on JJ's Mac today (`localhost:3500`); migration to a VPS is
  imminent and design should assume a remote, always-on deployment.
- Data has three owners, by class: **Sanity** owns content and PIF assessment
  (read live via GROQ, two projects — `gxyjgvr0` for the GGOMed site,
  `m05ykm6e` read-only for the Patient-Compass PIF slice); **Notion** owns
  editorial workflow state (calendar, topic pool, agent logs, oversight
  DBs); a **small cache store** holds external-API metrics (SEMrush, GA4,
  Search Console, scraped JSON-LD).
- The agent ecosystem lives outside this repo, in `ernesto-agents-house` and
  a set of Claude Code skills ("le ragazze"). The cockpit dispatches them and
  reads their output; it does not contain them.
- Four modules, one shell: Editorial views, PIF Tick, La Casa di Ernesto
  (generative), Lo Studio di Ambrogio (oversight, read-only).
- The app currently carries two generations of surfaces side by side: the
  cockpit modules that read live sources, and legacy pages that read the
  Notion mirror DBs slated for retirement. This duality is transitional and
  deliberate, not an accident.

## Capabilities and Constraints

- **Views are read-only.** The cockpit observes and dispatches; it does not
  edit content in place.
- **Drafts only.** Generative skills write to `drafts.*` in `gxyjgvr0`.
  Nothing auto-publishes. `m05ykm6e` is never written.
- **Three publish gates are JJ-only:** website publish, social approval,
  newsletter send. These are enforced in code, not merely in prompts.
- **Ambrogio's oversight databases are never writable** from the Shell. Its
  independence is structural.
- Clinical patient-facing authoring (Polaris / Compass) stays in the Helm
  under GMC sign-off and does not move into this cockpit.
- Auth is `next-auth`; sessions are real. Tests run on Vitest. A parity
  harness (`npm run parity`) gates mirror-DB retirement.
- Still open / not built: the Family C video worker, the proprietary cache
  tier, and the Notion→Sanity native-state migration.

## Brand Commitments

- **The Italian house names are binding.** *Il Cancello* (the gate), *La Casa
  di Ernesto*, *La Soffitta*, *Lo Studio di Ambrogio*. The house metaphor is
  deliberate and load-bearing, not decoration — future work must keep it.
- Product name: **GGO Med — Content Manager**.
- Everything else visual is explicitly **provisional**. The current
  purple–teal gradient identity, Plus Jakarta Sans, and existing layouts were
  confirmed by JJ as open to replacement. No colour, typeface, or component
  in the current build is a constraint on future work.

## Evidence on Hand

- `docs/GGOMED-COCKPIT-SPEC.md` — the authoritative build spec, including
  decisions JJ resolved on 2026-07-03 that override the rest of the document.
- `docs/STATE.md` — post-sprint snapshot of what exists (in Italian).
- `docs/ROADMAP-EXPANSION.md`, `docs/ROADMAP-FIX.md`,
  `CODE_REVIEW_AND_ROADMAP.md`, `docs/DEPLOY-REMOTE.md`, `docs/retros/`.
- `public/pif-tick-logo.svg` — the only brand asset in the repo.
- Live data from two Sanity projects and the Notion editorial databases.
- **No** logo file for GGO Med itself, no photography, no illustration
  library, no testimonials or usage metrics. Future work must not fabricate
  any of these.

## Product Principles

1. **The gate is the product.** Everything that needs a human decision must
   be impossible to miss and fast to resolve; everything else is context
   around that act.
2. **One expert, no hand-holding.** Design for density and speed, not
   onboarding. JJ knows what every module is.
3. **Show the source of truth.** Each datum has exactly one owner (Sanity,
   Notion, or cache). Surfaces should make provenance legible rather than
   flattening everything into undifferentiated rows.
4. **Read-only until a gate.** Observation is safe and unguarded; the few
   write paths are deliberate, guarded, and visually distinct from everything
   around them.
5. **The house metaphor is a real information architecture**, not a naming
   joke. Rooms have distinct purposes and should feel distinct.

## Accessibility & Inclusion

No product-specific standard was established. Il Cancello must be reliably
operable one-handed on a phone, since approvals happen between clinics.

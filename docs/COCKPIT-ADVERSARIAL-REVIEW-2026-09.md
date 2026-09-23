# Cockpit adversarial review — September 2026

Five reviewers read the cockpit as it stood at `3447a2c`, each with one
lens: a UI/UX engineer, a Next.js developer, GGOMed's Chief Commercial
Officer, Edmondo (site orchestrator) and Ernesto (social orchestrator).
JJ's brief: "the same things are repeated over and over; it must become an
operational interface where I understand what is happening and take
decisions." This is the synthesis and what was done about it.

## What all five found

1. **The decision queue was derived five times, five ways.** The Sidebar,
   the Atrio, HousePulse (Portineria), ErnestoOperationsBoard (Casa di
   Ernesto) and Editorial each filtered Desk, Calendar, wall and website
   rows on their own, with different windows and thresholds. Four surfaces
   could show four different "pending" numbers, so none could be trusted.
2. **"What happened overnight" was rendered three times** from the same
   activity log: the weekly journal on the Atrio (7 days, LLM prose), the
   "Night shift" block in the Casa di Ernesto (18 hours) and the raw table
   in Ambrogio's study (last 50 runs), with three different answers to
   "did anything fail last night".
3. **The Atrio described, it did not rank.** Eight equal stubs, a facade
   SVG that repeated the tallies, every volume printed twice, and the only
   decision act buried among them. The Editorial and PIF stubs read the
   Notion mirror while the rooms themselves read live GROQ: one datum, two
   owners.
4. **Nineteen navigation rows**, ten of them legacy mirror pages at the
   same rank as the rooms. Helm Pathways was PIF Tick filtered to Compass,
   linking back to "open in PIF grid".
5. **Missing for the business** (CCO): no "days since the house produced",
   no week-vs-target cadence, no PIF next-review countdown on the entrance;
   the annual-renewal tracker and the keyword-gap page were filed under the
   retiring archive.
6. **Missing for the orchestrators**: Edmondo has no durable monthly plan
   surface and impact verdicts never reach Il Cancello; Ernesto's
   week-vs-target reasoning lives only inside his skill run.

## What changed

| Finding | Change |
|---|---|
| Five queues | `lib/house/state.ts` — one read model, one formula (Il Cancello's), served by `/api/house/state`; Sidebar, Atrio and HousePulse consume it |
| Three night surfaces | Atrio owns "Stanotte" (24 h failures) and the folded weekly journal; the Casa di Ernesto block is gone |
| Descriptive Atrio | Server component ranked by decision: headline, six-number strip, "Ti aspettano" in priority order, one line per room; mirror reads removed |
| Nineteen nav rows | Eight rooms; the archive folds to one row (YouTube joins it); Helm Pathways redirects into `/pif-tick?source=compass` |
| Editorial as a flat stack | Diagnosis only: live site, topic pool, needs, impact review, newsletter — Calendar and Desk tables removed |
| Portineria's decision card | Removed; the pulse keeps production freshness and snapshot age |

## What was deliberately left

- **Impact verdicts still live on Editorial**, not in Il Cancello. They are
  counted in the house state and surface in the Atrio's "Ti aspettano"
  list, but moving the act into the gate needs the impact writer wired into
  the Cancello decision route. Follow-up.
- **Week-vs-target**: the calendar is grouped by content type for the
  current week; the target is read from `COCKPIT_WEEKLY_TARGET` and shown
  as "obiettivo non impostato" when absent. No number was invented.
- **Ambrogio's registers** (audits, proposals) were not touched: his study
  is independent by construction. Its copy of the activity log went in the
  second pass, replaced by a link to the agents' room.
- **The archive pages** are folded, not deleted: only Content Explorer and
  Validation Hub are gated by the parity harness; the other nine have no
  test. Deleting them needs a smoke test per route first.
- **Annual Review and Keywords** remain in the archive. Promoting a PIF
  renewal countdown and a content-gap list to the entrance is the next
  commercial step, once those pages read live sources.

## Reviewer method

Each reviewer worked read-only on the code, cited `file:line` evidence for
every duplication claim, and wrote a bounded report. The reports agreed
without coordination on findings 1–4; the CCO and the two orchestrators
added 5–6 independently.

## Second pass — three surfaces (2 September 2026)

JJ, after the first pass: "there are still about 170 lines of mostly useless
and duplicated stuff." Measured against the live Desk, the gate held 171
pending rows: 93 recommendations, 43 questions, 14 plan proposals, 18
publish approvals, 3 clip scripts. The editorial acts were 21; the other
150 were organisational.

The cockpit now has three operating surfaces, each owning one class of
fact:

| Surface | Owns | Never shows |
|---|---|---|
| Il Cancello (`/review`) | Editorial proposals: publish approvals, clips, social in Review, website patches and proposals, with corrections side by side and assets | Questions, plans, recommendations |
| Le Questioni (`/questioni`) | Technical signals (broken runs, zero-output slots, PIF overdue, stale snapshot, mute sources) and the organisational desk by kind, answered in place | Anything that can be published |
| Gli agenti (`/casa-di-ernesto`) | Everything the agents did: brief, journal, runs, directives, media | The decision queues |

The split is declared once in `lib/house/families.ts`; an unknown Desk type
is a question, never a publish act.

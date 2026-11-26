# The social media manager works the house — gap analysis and plan

Date: 26 November 2026. Follows `SOCIAL-COLLABORATOR-PLAN-2026-11.md`
(pull requests #41 and #42), which gave Diletta De Donatis, GGO Med's remote
Social Media Manager, the `social` role: the social rows of Il Cancello,
Il Carico and the guide. JJ now wants her to *work the house*, not only
review its social queue.

Evidence labels: **OBSERVED** (read in code or a live response),
**INFERRED** (from what), **UNVERIFIED**.

## 1. What JJ asked for (26 November 2026, translated)

| # | Requirement |
|---|-------------|
| R1 | She directs work and gives briefs to the agents (Ernesto, Samantha, Ginevra, Greta for social) through the cockpit, attributed to her by name |
| R2 | She sees analytics: Natascia's Performance Snapshot, social and site performance |
| R3 | She creates social strategies — plans that Ernesto executes |
| R4 | She sees everything on the website (ggomed.co.uk pages and their state), read-only |
| R5 | She sees comments on the social channels and replies |
| R6 | Publishing stays bound to JJ's yes. Her autonomy must widen later by configuration or role, not a rewrite. A reply to a public comment is a publish act |

## 2. Gap analysis

| # | Today | Gap | Evidence |
|---|-------|-----|----------|
| R1 | The cockpit can file a Desk directive (`/api/ernesto/directives`), writer-only, and its body says "Direttiva di JJ" whoever files it. La Bacheca writes the house board as `jj`, admin-only. The house bridge accepts only events signed `jj` | No channel for a collaborator to brief an agent, and no house identity for her | OBSERVED `app/api/ernesto/directives/route.ts:16` (`requireWriter`), `lib/notion/directive-write.ts:66`, `app/api/board/route.ts:20,32` (`requireAdmin`), `lib/board/store.ts:124` (`from: "jj"`), house `operations/board-cockpit-bridge.js:59` |
| R1 | The Desk is the wrong channel: JJ ruled on 24 October that the Desk carries only decisions that are his (publish approval, budget over cap, question after a compliance FAIL); everything else goes on the house board | Briefs must go on the board | OBSERVED house `cron/ernesto-headless.js:55-60` |
| R1 | Board authors and recipients are the closer roster (`CLOSERS`): agents and `jj` | `diletta` is not on it; adding her to `CLOSERS` would also let her close Content Needs and Content Assets | OBSERVED house `operations/house-board.js:44-50`, `core/closure-marker.js:36-46` |
| R1 | Slots that read their inbox: Ernesto (three a day), Edmondo, Ettore, Ginevra, Natascia. Samantha, Greta and Titti have no slot of their own; Ernesto runs them | A brief addressed to Samantha or Greta alone would never be read | OBSERVED house `grep buildBoardSection cron/` |
| R2 | La Portineria reads the Performance Snapshot (Search Console, GA4, Meta Graph, YouTube, Vercel, Beehiiv). Natascia's weekly reports DB is not read by the cockpit | The role cannot reach either; Natascia's reading is absent | OBSERVED `app/portineria/page.tsx:98`, house `ingesters/`, `lib/config.ts` (no Natascia DB) |
| R3 | Ernesto's weekly plan is a board thread to `house`; "a notification JJ may steer, not a gate" | No place for a strategy, and a board thread drops out of Ernesto's prompt once he has answered it (`threadsAwaiting` shows only threads whose last word is not his) | OBSERVED house `cron/ernesto-headless.js:71-74`, `core/board-slot.js:33-39` |
| R4 | The website registry (Content Asset DB) is listed by `/content-explorer` through `GET /api/notion/content`; the POST on the same route is writer-only | The role cannot reach it | OBSERVED `app/api/notion/content/route.ts:8,27` |
| R5 | YouTube: the ingest files each unanswered comment as a Pending `[yt:…]` Desk row; Samantha drafts, Aspasia checks, the draft is attached to the row; JJ's Approve is the publish act; the dispatcher posts. A new note in the row's `Correction` makes the row due for a new draft | The role cannot see these rows or speak on them | OBSERVED house `operations/youtube-reply-drafts.js:18-35,213-226`, `operations/youtube-reply-dispatch.js:14-30` |
| R5 | Instagram and Facebook: no comment ingest exists anywhere in the house; the Meta Graph ingester reads metrics | Comments on those channels cannot be shown or answered from the cockpit without a new Meta permission (`instagram_manage_comments`, `pages_manage_engagement`) — a credential decision of JJ's | OBSERVED house `grep -ri "instagram.*comment"` (no match); INFERRED the permission names from Meta's Graph API |
| R6 | Acts are already keyed role × target × act in one table (`ACTS`), and approve is admin-only | Publish authority is implicit in that table, not named; the house side also hard-codes `jj` as the only actor of Review → Approved | OBSERVED `lib/auth/permissions.ts:64-77`, house `core/publish-state.js:53` |

Verdict: R2 and R4 are fences to open (read-only). R1 and R3 need a house
identity for a person who is not an agent, and a house rule for what her
word means to the agents. R5 is YouTube-only until JJ grants a Meta
permission. R6 needs publish authority named in one place.

## 3. Plan v1

**Phase 1 — read surfaces (cockpit only).** Open La Portineria (read-only,
no dispatch button) and the website registry to `social`; add Natascia's
weekly report when its DB is configured; three new places in the social
margin.

**Phase 2 — a house identity and briefs (house, then cockpit).**
- House: a separate roster of human collaborators (`diletta`), allowed as
  board author and recipient, *not* as a closer. The bridge accepts events
  signed `jj` or a collaborator. A rule in the board instructions: a brief
  from the Social Media Manager is direction for social work, to be acted on
  within the agent's remit; it never authorises a publish.
- Cockpit: "Briefs" — she writes to an agent; the cockpit adds `ernesto`
  whenever she addresses a specialist with no slot (Samantha, Greta, Titti),
  so the orchestrator routes it. She sees the threads she opened or is
  addressed in, and the agents' answers. JJ sees everything in La Bacheca.

**Phase 3 — strategies (house, then cockpit).** A strategy is a board thread
tagged `strategy` from `jj` or a collaborator, addressed to `ernesto`, with a
fixed outline (objective, audience, channels, period, cadence, themes,
measures). The house injects the newest open strategy into every Ernesto
slot whether or not he has answered it, so it governs until replaced or
closed.

**Phase 4 — comments (cockpit, then house).** "Comments": the `[yt:…]` Desk
rows with the comment, the video, Samantha's latest draft and the status.
Her acts: *Suggest a reply* (her wording or direction, appended to the row's
`Correction`, signed — the row becomes due, Samantha redrafts through
Aspasia) and *Ready for JJ*. No status move. JJ's Approve stays the publish
act. House: the replies skill uses a signed suggestion verbatim unless Aspasia
or the voice rules forbid it, and says so on the row.

**Phase 5 — guide and widening.** The guide covers the new rooms; a
`PUBLISH_AUTHORITY` table names who may release each kind of public act
(today `admin` alone), so widening is one line plus its house counterpart.

## 4. Adversarial review of v1

Findings and the correction carried into v2. (An independent reviewer's
findings follow in §6.)

1. **A suggestion in `Correction` sits next to JJ's.** JJ's Modify overwrites
   `Correction`; her append would be erased by his next Modify, and his
   overwrite semantics are what the drafting ledger hashes. *Correction:*
   her line is appended, signed and dated, and never replaces his; his Modify
   keeps overwriting (unchanged). Her suggestion surviving his rework is not
   required: his note is the newer instruction.
2. **A strategy is not a gate but it is a standing order.** If anyone could
   post a `strategy` thread, an agent could. *Correction:* the house injects a
   strategy only if its opener is `jj` or a collaborator, and the newest wins.
3. **Visibility of the board.** The cockpit holds the whole board (synced as
   `readAll('jj')`). Serving it to her would show JJ's and Ambrogio's
   threads. *Correction:* the server filters to threads she opened or where
   she is a recipient; closed ones included, so she sees outcomes.
4. **Natascia's DB id needs an environment line on the VPS.** Agents do not
   edit env files. *Correction:* a code default for the DB id (ids are not
   secrets; the cockpit already defaults its Sanity project id); if the
   cockpit's integration cannot read it, the room says so and the rest works.
5. **Briefs cost money.** A brief can ask Ginevra for generative video.
   Higgsfield spend is already capped by `core/higgsfield-budget.js` and
   over-cap work becomes a `budget-request` Desk row for JJ. *Kept:* no new
   rail needed; stated in the guide.
6. **Clinical claims in a brief.** A brief can ask for a claim. Every draft
   still passes Aspasia before Review, and a FAIL halts. *Kept.*
7. **Identity mapping.** The cockpit must turn a signed-in collaborator into
   a house handle without putting her email in the repository. *Correction:*
   the handle is the lowercased first name, accepted only if it is on the
   vendored house roster; otherwise the room says briefs are not set up.
8. **Rate of writes.** A loop or a stuck button could flood the board.
   *Correction:* the board writer already refuses an identical message; add a
   cap of 20 messages a day per collaborator.

## 5. Plan v2 (to build)

As v1, with the corrections above. Pull requests:

- **Cockpit PR A** — Phase 1 (read surfaces) and the `PUBLISH_AUTHORITY`
  table.
- **House PR** — collaborator roster, board and bridge, strategy injection,
  board and replies instructions, and the Notes wording in Samantha's and
  Ernesto's references (lines now carry their author).
- **Cockpit PR B** — re-vendor the house writer; Briefs, Strategy and
  Comments; guide.

Each is merged when CI is green and verified on the VPS.

## 6. Independent review of v2

A reviewer who had not written the plan read it against both repositories.
Twelve findings; each with what changes.

| # | Finding (severity) | Disposition |
|---|--------------------|-------------|
| 1 | Writing her suggestion into a Desk row's `Correction` breaks the house: the field is JJ's instruction read whole; any change to it makes the row due again, so her line would reopen a row Aspasia halted (verdict-shopping); she could forge a line reading as JJ's or a `[closed … by jj]` marker that the drift scanner reads as his signature; a read-then-append can erase his Modify (high) | **Changed.** She never writes `Correction`. A suggestion is a marked block appended to the row's body, `[yt-suggestion:<comment>:<k>]`, signed; the house treats a new suggestion as due only when the last attempt was not halted; "Ready for JJ" never makes a row due |
| 2 | With her suggestions a new draft can attach while JJ reads the old one, and his Approve would post a draft he never saw (high) | **Changed.** The cockpit's Approve of a `[yt:…]` row stamps the draft number JJ saw (`[yt-approved-draft:<comment>:<n>]`); the dispatcher posts only that draft and refuses, saying so on the row, if a newer one exists. Rows approved without a stamp keep today's behaviour |
| 3 | The cockpit validates every synced board event with its vendored writer and rejects the whole sync on one failure; landing the house first would freeze La Bacheca as soon as an agent wrote to her (high) | **Changed.** Order: cockpit PR with the re-vendored writer that already accepts collaborators first, house second |
| 4 | Mapping by first name lets a collaborator named after an agent speak as that agent (high) | **Changed.** An explicit house handle, set by JJ in Settings, accepted only if it is on the house's collaborator roster; a test asserts that roster shares no name with the closers |
| 5 | Her board writes would reach any thread and `house` (every agent, oversight included) (medium) | **Changed.** She replies or closes only in threads she opened or is addressed in; her recipients are an allow-list (ernesto, samantha, ginevra, greta, titti, natascia, jj), never `house` |
| 6 | Agents answer as if JJ were the only reader; YouTube comments can carry health details of named people (medium) | **Changed.** When a collaborator is in a thread the slot prompt says so and tells the agent not to quote clinical drafts, Aspasia notes or patient-identifying detail. Comments are public on YouTube; she sees them as GGO Med staff doing the job they are published for, and the cockpit does not store them |
| 7 | Strategy injection as written cannot read the threads (`readInbox` window, `readAll` refuses other readers), would let hers displace JJ's, is ambiguous about replies, and is uncapped (medium) | **Changed.** A dedicated house reader; JJ's open strategy outranks hers; only the opener's messages and JJ's are injected, labelled, capped at 4 KB |
| 8 | Her text enters agent prompts like JJ's; the plan misstated that the house enforces `jj` on Review → Approved (it is documentation, not runtime) (medium) | **Changed.** The prompt builder wraps a collaborator's words as direction from a person who is not JJ, which cannot authorise a publish, a status move, spend over the cap, or a change to rules or skills. §2 corrected below |
| 9 | Opening La Portineria would fetch `/api/house/state` (Desk counts, night failures, PIF) or 403; the snapshot route had no route guard and a public cache header (medium) | **Changed.** A separate English Performance room; exact API paths only; the snapshot route now calls `requireAuth` and sends `private, no-store` |
| 10 | The fence is per path, so allowing `/api/notion/content` exposes its writing POST to `requireWriter` alone; the GET returns reviewers' names (low) | **Changed.** A GET-only `/api/social/pages` returning only title, type, state, address and dates |
| 11 | Collaborator acts land only on Review rows and the role has no Desk acts; `[yt:…]` rows are Pending (low) | **Changed.** A dedicated `comments` target: the server checks Type `publish-approval` and a `[yt:` title before any act; `desk` stays closed to her |
| 12 | "Widening is one line" is overstated: the house names JJ as approver in the reply path, the dispatcher, the orchestrator and the bridge (low) | **Changed.** `PUBLISH_AUTHORITY`'s comment names each house counterpart; widening is a pair of commits |

Correction to §2, R6: the house's lifecycle table names `jj` as the actor of
Review → Approved, but the table is documentation, not consulted at runtime
(OBSERVED house `core/publish-state.js:46-48`). The runtime refusal is the
Desk's: code never moves a Desk row Pending → Approved.

## 7. Plan v3 (to build, in this order)

1. **Cockpit PR A — read rooms.** Performance (Natascia's readings and the
   snapshot), Website (GET-only registry), `PUBLISH_AUTHORITY`.
2. **Cockpit PR B — the house's collaborators, cockpit side.** Re-vendored
   board writer accepting the collaborator roster; house handle in the user
   store; Briefs and Strategy rooms; her board scope; the 20-a-day cap.
3. **House PR — collaborators in the house.** Roster, board validation,
   bridge, prompt wrapping, strategy reader and injection into Ernesto's
   slots, suggestions in the YouTube draft loop, the approved-draft stamp in
   the dispatcher, Notes wording in Samantha's and Ernesto's references.
4. **Cockpit PR C — Comments.** The `comments` target, the room, the
   approved-draft stamp on JJ's Approve.

## 8. As built

Shipped as two cockpit pull requests and one house pull request (JJ prefers
consolidated pull requests; cockpit B and C became one):

| Requirement | Where | How it stays JJ's |
|---|---|---|
| R1 briefs | `/briefs`, `/api/social/briefs`; house `COLLABORATORS`, bridge, `board-slot.js` | Signed with her house name, set by JJ in Settings; she writes only to the social team and JJ, only in her threads; the prompt builder labels her words "not JJ" and states what they cannot authorise |
| R2 analytics | `/performance` | Read-only |
| R3 strategies | `/briefs` (strategy), house `readStrategy`, `buildStrategySection` in every Ernesto slot | Copied to JJ; JJ's open strategy outranks hers; injected as JSON, capped, later words kept |
| R4 website | `/website`, `/api/social/pages` | GET-only, trimmed |
| R5 comments | `/comments`, `/api/social/comments`; house suggestions in the draft loop, stamp in the dispatcher | She suggests or marks ready; Samantha drafts through Aspasia; approving is posting and is `PUBLISH_AUTHORITY["comment-reply"]` (JJ); the stamp makes the house post exactly the draft he approved |
| R6 widening | `PUBLISH_AUTHORITY` (cockpit) + the house's `jj` approver in the reply path and dispatcher | One line here plus its house counterpart |

Deploy order: the cockpit (its vendored writer accepts collaborators) before
the house, or the board sync would refuse her events.

Not done, needs JJ: Instagram and Facebook comments need a Meta permission
(`instagram_manage_comments`, `pages_manage_engagement`) — a credential
decision. Notifications to her are still none (N12 of the first plan).

Residual risks: the drafting step now reads the body of every Pending
YouTube row each run (one paginated Notion read per row) to find
suggestions; the house still counts collaborator notes in the throughput
sensor (first plan, §9).

## 9. Phase 0, added: the agreement in the invitation (JJ, 26 Nov 2026)

JJ: "il contratto deve fare parte del cockpit ovviamente. si apre con il
link e parte un onboarding basic e friendly". She meets it first, so it
gates everything else.

- **Flow.** `/invito`: welcome; how we work, with what she can do and what
  waits for JJ; the agreement as cards (plain-English summary, the exact
  clauses underneath); the whole text, scrolled to the end, downloadable;
  three ticks, typed name, the intent sentence; then her password. A
  collaborator already signed in without a signature (a link redeemed before
  this shipped, or a new version) is taken to `/benvenuto` with the same steps.
- **Gates.** (1) Signing is refused unless the version is `FINAL` and every
  variable is decided by JJ — v1.1 is `PENDING_JJ_FINAL_READ`, so today she
  can read and not sign, and therefore not set a password. (2) `requireAuth`
  refuses every data route to a collaborator without an accepted record of the
  version in force (`403 CONTRACT_REQUIRED`), failing closed when the files
  cannot be read; only `/api/onboarding` and `/api/contract/signed` run
  before. (3) The hash is over the rendered text; a newer FINAL version asks
  again, a newer draft does not take access away.
- **Records.** Append-only `contract-records.jsonl` beside the user store,
  0600, each record hash-chained to the previous; the exact text archived by
  its SHA-256; server time, the client address nginx appends, user agent,
  the ticks, sections read and download times as the browser reported them.
  JJ countersigns in Settings → Agreements; both download the signed copy
  (Markdown: the text, then a signature page).
- **Where the contract lives.** On the server only, beside the user store
  (`contracts/<id>/v<version>.md` and `.copy.json`, `contracts/assignments.json`):
  it names her business, address and tax numbers. The repository holds a
  fictional placeholder for tests and the converter
  (`tools/contracts/copy-to-json.mjs`).

Gaps, said plainly: the cockpit has no email service (the copy's "a signed
copy has been emailed" became "download it in the Guide") and no second
factor (`mfa: false` in every record); the download is Markdown, which prints
to PDF from the browser, not a generated PDF; the countersignature wording
was written here, adapted from the contractor's; none of it has been checked
by a lawyer (the copy's own §5 says so).

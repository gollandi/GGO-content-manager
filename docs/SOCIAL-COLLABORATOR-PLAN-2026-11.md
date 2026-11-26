# The cockpit for a remote social media manager — analysis and plan

Date: 26 November 2026. Trigger: Diletta joins GGO Med as Social Media
Manager (MyBrain `people/diletta.md`, certified 2026-11-26) and works
remotely. This document asks what they need from the cockpit to work, what
the cockpit does today, and what had to change.

Evidence labels follow the house rule: **OBSERVED** (read in code or a live
response), **INFERRED** (from what), **UNVERIFIED**.

## 1. What remote social cooperation requires

A second person working on GGO Med's social channels from elsewhere needs:

| # | Need | Why |
|---|------|-----|
| N1 | Their own login, with a password only they know | Shared credentials make every act anonymous and cannot be revoked for one person |
| N2 | A role that fits the job, and no more | Least privilege: the cockpit also holds clinical, PIF, website and agent-control surfaces |
| N3 | Every act attributed to the person who did it | Dogma *Trasparenza*; the house rule that work is closed by a named actor |
| N4 | The social queue: what is waiting, its visuals, caption, hashtags, channels, date and status | The core of the job |
| N5 | A way to send work back or comment, with the history kept | Asynchronous review is the only kind possible at a distance |
| N6 | A way to tell JJ "I have checked this one, it is ready for you" | JJ's scarce resource is decision time; a pre-checked queue spends less of it |
| N7 | Raw media in (phone footage, photos) and finished media out | Remote production |
| N8 | The publish gate intact: approve is publish, and stays JJ's | Autonomy Level E.1; `AGENTS.md` gate #2 |
| N9 | Usable on a phone | Remote and social work is mobile |
| N10 | An onboarding guide in English | There is no one in the room to ask |
| N11 | JJ can switch the access off on his own, at once | Account lifecycle |
| N12 | Something says when work is waiting | Otherwise they must poll |

## 2. What the cockpit does today

| Need | State | Evidence |
|------|-------|----------|
| N1 | **Missing.** One operator from env (`COCKPIT_USER_EMAIL` + hash); the in-code user map is empty; Google sign-in is wired but not configured in production | OBSERVED `lib/auth/config.ts:15-49`; OBSERVED live `GET /api/auth/providers` returns `credentials` only |
| N2 | **Unsafe.** Three roles exist (`admin`, `editor`, `viewer`), but the role map is empty, any signed-in user can open every page, and an `editor` may approve, send to Buffer and archive Notion pages | OBSERVED `lib/auth/roles.ts`, `middleware.ts`, `app/api/review-dashboard/decision/route.ts:15` (`requireWriter`) |
| N3 | **Missing on the gate.** The Cancello never receives the actor; its texts say "JJ" whoever clicks ("Nota di JJ", "Richiesta di modifica di JJ") | OBSERVED `lib/cancello/decision.ts:101,175,187,256`. Il Carico does record the uploader (`operator: auth.email`, `app/api/media/uploads/route.ts:57`) |
| N4 | **Present.** Il Cancello lists Content Calendar rows with media, caption, hashtags, platforms, date and status | OBSERVED `lib/cancello/state.ts:48-57` |
| N5 | **Lossy.** A note on a calendar row *overwrites* `Notes`; history is lost at every act | OBSERVED `lib/cancello/decision.ts:136-137` |
| N6 | **Missing.** No act between "say nothing" and "approve" | OBSERVED `Decision` type, `decision.ts:26` |
| N7 | **Present.** Il Carico takes uploads (writer role) and records the operator; media are served path-guarded | OBSERVED `app/api/media/uploads/*`, `app/api/review-dashboard/media/route.ts` |
| N8 | **At risk** the moment a second writer exists (see N2) | INFERRED from N2 |
| N9 | **Partial.** Responsive breakpoints exist (640 px, 1024 px); no PWA manifest | OBSERVED `app/globals.css:662`, `components/AppShell.module.css:15` |
| N10 | **Missing.** The interface and its docs are written for JJ, largely in Italian | OBSERVED `app/review/page.tsx` copy |
| N11 | **Coarse.** Removing the env user means a redeploy, and a signed JWT stays valid until it expires | OBSERVED `lib/auth/config.ts`; next-auth default session |
| N12 | **Missing.** No email, push or badge for a second person | OBSERVED: no notifier library or code in `lib/` or `app/` |

Further facts that shape the plan:

- `PRODUCT.md:11-14` states JJ is the only user and the roles are "a
  technical scaffold, not evidence of a team". Diletta changes that premise
  for one narrow surface; the document is amended, not ignored.
- Several API routes rely on the middleware session alone, with no route
  guard: `/api/notion/{evidence,keywords,patient-journeys,performance-snapshot,validation}`
  and `/api/cache/invalidate` (GET and POST). OBSERVED. Any new role must be
  fenced in middleware, not per route.
- Other writes also name JJ whoever acts: `lib/runner/store.ts` (`decidedBy:
  "jj"`), `lib/notion/directive-write.ts` ("Direttiva di JJ"), La Bacheca.
  OBSERVED. They stay unreachable for the new role rather than being
  rewritten here.
- Il Carico accepts video and audio only, no stills (`lib/media/inbox.ts:44-56`).
  OBSERVED. Photos are a real need for a social manager; see the deferred list.
- `/settings` is a static placeholder. OBSERVED. It is the natural home for
  access management.

Verdict: the cockpit already has the social surface Diletta needs (N4, N7).
What it lacks is everything that makes a *second person* safe and visible in
it (N1, N2, N3, N5, N6, N8, N11). Adding a second person today with the existing
roles would either give them nothing to do (`viewer`) or let them publish in
JJ's name (`editor`). Neither is acceptable.

## 3. Plan, first draft (v1)

- **P1 Users and roles.** Multi-user sign-in from a private users file on the
  VPS plus the existing env operator; a new `social` role.
- **P2 Gate by role.** Middleware allow-list for `social`; the decision route
  limits acts by role; approve, send, reject, done and delete are admin-only.
- **P3 Attribution.** Pass the actor into every Cancello act; append notes
  with name and time instead of overwriting.
- **P4 New acts.** `comment` (note only) and `ready` (comment that marks the
  row as checked for JJ); `modify` allowed for `social` with a mandatory note.
- **P5 Social view of the Cancello.** The state route returns only calendar
  rows to `social`; the page hides the acts that role cannot take and shows a
  "checked by" badge to JJ.
- **P6 Invitation.** JJ invites by email from Settings; a one-time link lets
  them set their own password.
- **P7 Guide.** An English onboarding page in the cockpit and a runbook entry.
- **P8 Notifications.** Email when rows enter Review.

## 4. Review of v1

Findings, each with the correction carried into v2:

1. **P1 risks locking JJ out.** The admin is whoever `ADMIN_EMAIL` names; if
   it is unset in production JJ is an `editor` today and an admin-only gate
   would stop his own approvals. INFERRED that it is set (`/api/board` is
   admin-only and JJ uses La Bacheca), but not OBSERVED. *Correction:* the
   env operator (`COCKPIT_USER_EMAIL`) is always admin, so the existing login
   keeps every power it has whatever `ADMIN_EMAIL` says.
2. **P2 changes `editor`.** Making approve admin-only narrows `editor`. No
   editor exists (empty role map, one env user), so nothing breaks; the
   narrowing is the point — approve is JJ's. *Kept, documented.*
3. **P6 is a credential flow.** Credentials are escalated to JJ. An invite
   link redeemed by the invitee keeps the password out of everyone's hands,
   including JJ's and the agents', which is the honest design. The agent
   never sees or sets a password. *Kept;* the invite token is single-use,
   expires in 72 hours, is stored only as a hash, and the users file is
   mode 0600 outside the deploy tree.
4. **P8 is scope creep and money.** Email needs a provider, a sender domain
   and a secret, none of which exists in the cockpit. *Correction:* deferred
   to its own task; v2 shows a count of posts waiting in the queue instead
   (no new service). Listed as an open follow-up.
5. **Revocation (N11) is missing from v1.** A disabled user's JWT would keep
   working. *Correction:* every guarded API re-reads the user record and
   refuses a disabled or deleted user; JJ can disable from Settings without
   a redeploy.
6. **`delete` and `done` for `social`.** Both close work for good. Not the
   collaborator's to take.
   *Kept admin-only.*
7. **The state route is also read by the service token** (media-sync job).
   Filtering by role must not change that response. *Correction:* filter
   only for a session whose role is `social`.
8. **Middleware runs on the edge** and cannot read the users file.
   *Correction:* the role travels in the JWT; the allow-list is enforced in
   middleware from the token, and the Node routes re-check against the file
   (defence in depth, and revocation).

## 5. Plan, corrected (v2)

> Historical: v2 as written before the independent reviews. Where it differs
> from §6 and §6a (note limits, the invitation URL, "send back"), the later
> sections describe what was built.

Phase A — identity and roles (P1, findings 1, 3, 5, 8)
- `lib/auth/users.ts`: a file-backed user store under
  `$COCKPIT_SNAPSHOT_DIR/auth/users.json` (0600): `{email, name, role,
  hash?, disabled, invite?: {tokenHash, expiresAt}, createdAt, createdBy}`.
- Roles: `admin | editor | social | viewer`. Env operator and `ADMIN_EMAIL`
  are admin.
- Sign-in checks the store, then the env operator.
- `requireAuth` re-reads the store: a disabled or unknown store user is 401.

Phase B — the gate (P2, P5, findings 2, 6, 7)
- `lib/auth/permissions.ts`: one table of what each role may do —
  pages, API prefixes and Cancello acts.
- Middleware: `social` reaches only `/review`, `/carico`, `/guida`, and the
  APIs those pages call; anything else is 403 (API) or a redirect.
- Decision route: refuses an act the role may not take, before any write.
- State route: a `social` session receives calendar rows only.

Phase C — attribution and history (P3, P4)
- `applyCancelloDecision(input, actor)`; notes are appended as
  `[YYYY-MM-DD HH:MM · Name] text`, newest last, trimmed from the oldest end
  to Notion's limit; texts that said "JJ" name the actor.
- New acts `comment` and `ready` (no status change), `modify` for `social`.
- The page shows each row's note history and the latest "ready" mark.

Phase D — invitation and access management (P6, finding 5)
- Admin-only API and a Settings panel: invite, list, disable, re-invite.
- `/invito/[token]`: set a password (≥ 12 characters); the token dies on use.

Phase E — guide (P7)
- `/guida`: an English page for the `social` role: what it shows, what each
  button does, what only JJ can do, how to upload media.
- `docs/DEPLOY-REMOTE.md`: how to invite and revoke.

Deferred, with reasons: email notifications (finding 4); a PWA manifest
(nice to have, not blocking); per-channel analytics for the role (Natascia's
domain, read-only access can follow once the role is in use).

## 6. Independent review of v2, and the plan as built (v3)

v2 was handed to a reviewer who had not written it, with the code. Sixteen
findings; each is listed with what was done.

| # | Finding (severity) | Disposition |
|---|--------------------|-------------|
| 1 | Trimming notes "from the oldest end" would delete the house's machine markers (`[page-story:`, `[story-attempt:`), which sit at the oldest end and drive the page-story dedup (blocker) | **Fixed.** Notes are never trimmed; a note that does not fit is refused (the limit was later set to 1,600 characters — §6a). The same finding exposed that today's code already *erases* those markers by overwriting `Notes` on every Cancello comment — fixed by appending |
| 2 | A comment could forge a marker or another person's line (blocker) | **Fixed.** Square brackets in human text become parentheses; the author label loses `·` |
| 3 | The note box was pre-filled with the existing notes, so appending would duplicate history (should-fix) | **Fixed.** The box starts empty; the history is shown read-only above |
| 4 | The route checked the act, not the target or the row: a collaborator could commission website work, undo an approval by sending an Approved row back, move a date, or write to any page the integration reaches (blocker) | **Fixed.** Acts keyed on role × target × act; for a collaborator the page must belong to the Content Calendar and be in Review, no date. (§6b later removed "send back" from collaborators altogether.) |
| 5 | Middleware-exempt routes (`/api/views`, `/api/llm/guard`, …) skip the allow-list (blocker) | **Fixed.** The fence runs before the exemptions; a test walks every route in `app/` against the role |
| 6 | The JWT role came from `getRoleForEmail`, so a store user would land as a viewer of everything; unfenced roles see all; Google would admit any account (blocker) | **Fixed.** `authorize` returns the stored role; only `social` can be assigned; a `signIn` callback admits Google accounts only for the owner or an active collaborator |
| 7 | Revocation and role changes do not reach the middleware (should-fix) | **Mitigated.** Every route the `social` role can reach re-reads the store (disabled ⇒ 401, changed role applies at once); a collaborator's token whose record vanished is refused. Pages still render for a revoked session until the JWT expires, but show no data. Node-runtime middleware was not adopted: untested on this Next version |
| 8 | A bad store would lock JJ out (blocker) | **Fixed.** The owner is checked before the store at sign-in and never consults it afterwards; store errors return "no" for collaborators only |
| 9 | The invitation page was not exempt and would be wrapped in the shell (should-fix) | **Fixed.** `/invito` and its API are exempt and render bare; the token is in the `#fragment` and travels only in a POST body; `Referrer-Policy: no-referrer` |
| 10 | Uploads: the role needs `requireUploader`, and must not abandon JJ's uploads (should-fix) | **Fixed.** `requireUploader`; a collaborator may complete, add to or abandon only their own uploads |
| 11 | No brake on password guessing (should-fix) | **Fixed in-process** for collaborators (8 failures / 15 minutes). The owner is not throttled — anyone knowing his address could lock him out. An nginx `limit_req` is recorded as a server follow-up |
| 12 | The sidebar fetched the house state and showed every room (should-fix) | **Fixed.** A social margin with three places; the house count is not fetched for that role |
| 13 | The in-process write queue assumes one module instance (nit) | **Mitigated.** The queue lives on `globalThis`; writes are tmp-then-rename |
| 14 | The store location in v2 was wrong (nit) | **Fixed.** On the VPS it resolves to `/var/lib/ggo-cockpit/auth/` (OBSERVED: `tools/vps/install-cockpit-warm.py:27` sets `COCKPIT_SNAPSHOT_DIR` for the service); outside the rsync tree |
| 15 | A new link re-enables a disabled collaborator (nit) | **Fixed** (§6a): a switched-off collaborator stays off until the new link is used |
| 16 | `PRODUCT.md` must change; the Notion link is useless to a collaborator (nit) | **Fixed.** `PRODUCT.md` amended; the Notion link is hidden for the role |

What was built (v3) is v2 with the corrections above, plus the English copy
the collaborator sees in Il Cancello and Il Carico (JJ keeps the Italian),
and the Settings placeholder — invented controls claiming "keys are
encrypted at rest" — replaced by the real Collaborators panel.

## 6a. Adversarial review of the code (round 2)

A second reviewer read the committed code against seven requirements. Its
thirteen findings and what was done:

1. **Notes past 2,000 characters would be cut by the house** — five house
   writers rewrite `Notes` through `truncateText(…, 2000)`
   (OBSERVED `core/notion-client.js:268`), keeping the head and dropping the
   tail, their own new marker included. *Fixed:* the field is capped (now
   1,600, §6b); existing rich-text elements, links included, are kept as they
   are.
2. **Read-modify-write on notes** can lose a concurrent write. *Reduced:*
   collaborators no longer change status (§6b); the window is one Notion
   round trip. Accepted residual.
3. **Re-inviting a disabled collaborator revived the old password.**
   *Fixed.*
4. **Stale roles in old tokens.** *Fixed:* anyone who is not a collaborator
   has the role recomputed from the environment on every request, in the
   middleware and the routes.
5. **The brake could be dodged with spaces.** *Fixed:* emails are trimmed;
   the brake's map is bounded.
6. **The social role could fetch other media and JJ's uploads.** *Fixed:*
   media only of the calendar rows it is shown; uploads and worker output
   only its own.
7. **Forcing a full re-crawl.** *Fixed:* `refresh` is the owner's and the
   machine's only.
8. **House prompts read `Notes` as "JJ's notes".** *Open, house side:*
   `skills/samantha-social-groupie/SKILL.md:90`,
   `skills/ernesto-the-pimp/references/notion-databases.md:42`. Lines now
   carry their author; the skill text should say so. A deliberate SKILL.md
   commit in the house — a follow-up, not this pull request. The Desk keeps
   its old overwrite semantics, so `desk-reader` and the YouTube reply drafts
   are unaffected.
9. **A signed-in collaborator could not open a reset link.** *Fixed.*
10. **"Ready" on any status.** *Fixed:* collaborators act on Review only.
11. **A collaborator named "JJ".** *Fixed:* the name is reserved.
12. **JJ's screen flashed for the social role while loading.** *Fixed.*
13. **Test gaps** (sign-in order, Google, middleware order, route walk).
    *Fixed:* the middleware's decision is a pure, tested gate; sign-in moved
    to `lib/auth/credentials.ts` and tested.

## 6b. Pre-PR hardening loop (round 3)

Four independent reviewers — security, domain integrity, regression, tests
and claims — read the whole branch against `main`.

- **Domain integrity, the decisive one:** the house's lifecycle declares
  Review → Draft a `jj` transition (OBSERVED
  `core/publish-state.js:45`). A collaborator's "send back" took it, and
  could race JJ's approval of the same row. *Changed:* collaborators never
  move a status. "Request changes" is a note marked `changes requested`;
  JJ sees it on the row and sends the post back himself. The race is gone
  with the status write. Also: the cap went from 2,000 to 1,600 characters
  so the house keeps room for its markers after any note.
- **Regression:** JJ's approval with a note could fail on a full notes
  field. *Fixed:* for the owner the status flip always happens; a note that
  does not fit is skipped and reported on the page. The Desk box is
  pre-filled with his previous instruction again, as on `main`.
- **Security** (no high or medium): cross-site writes from a sibling
  subdomain — *fixed*, the middleware refuses a state-changing API call
  with a session whose `Origin` is not the cockpit; sign-in timing revealed
  active collaborators — *fixed*, a dummy bcrypt comparison; targeted
  lock-out — *fixed*, the brake keys on address and client (the hop nginx
  appends), with a looser per-address ceiling; multi-line notes could fake a
  line — *fixed*, one act, one line.
- **Tests and claims:** the decision route defaulted its actor to the owner
  — *fixed*, the actor is required; route-level tests added for the
  decision, state, media, collaborator and invitation routes and the
  cross-site check; stale claims in this document and the runbook
  corrected.

## 7. Verification

- `npm test`: the existing suite plus ten new files — user store, sign-in,
  gate, guard and brake, permissions with a walk of every route in `app/`,
  collaborator acts in the Cancello, media scope, the collaborator routes,
  and the social view of the page. Guards were broken on purpose (letting
  `social` approve; removing the bracket defang; rendering the page as
  admin) and the tests failed for the right reason.
- `npx tsc --noEmit` and `next build`: clean. `eslint` reports three errors,
  all pre-existing in files this change does not touch.
- Live, against a local server with generated test credentials and a
  scratch store (before round 3): invite → link → password set → link
  refused on reuse → sign-in as `social`; `/review`, `/carico`, `/guida`
  reachable; `/`, `/questioni`, `/settings`, `/bacheca` redirect to the
  queue; `/api/views/*`, `/api/llm/guard`, `/api/house/state`,
  `/api/collaborators`, `/api/board`, `/api/cache/invalidate`,
  `/api/notion/patient-journeys` answer 403; approve answers 403; switched
  off ⇒ 401 on the next request, switched on ⇒ 200; the owner keeps every
  room; store file 0600. Screenshots: `docs/screenshots/2026-11-collaborators/`
  (they show "Send back", since renamed "Request changes").
- Not verified here: acts against real Notion rows (no Notion credentials in
  a worktree, by rule). Covered by unit tests with the client mocked; the
  first real "Ready for JJ" on the VPS is the live check, for a fresh
  session after the merge.

## 8. What JJ has to do for Diletta to be working

1. Nothing for the merge: the pull request is merged when CI is green and
   the deploy to the VPS follows on `main`.
2. In the cockpit, Settings → Collaborators → Diletta's name and email →
   *Create link*, and send the link (valid 72 hours).
3. Diletta opens it, sets a password, signs in and lands on the guide.

No server edit, no env change, and no password passes through JJ or an agent.

## 9. Residual risks and follow-ups

- **House prompts** (§6a, 8): Samantha's and Ernesto's references describe
  `Notes` as JJ's; lines now carry their author. A house SKILL.md commit.
- **Notifications (N12).** None yet: the collaborator opens the queue to see
  what is waiting. Email needs a provider, a sender and a secret — a
  decision with a cost, so its own task.
- **Photos in Il Carico.** Video and audio only; a social media manager will
  want stills. The worker would need a path for images.
- **nginx `limit_req`** on the credentials callback: a server change outside
  this repository's deploy.
- **Media of every calendar row in the register**, Draft and Scheduled
  included, are fetchable by the social role — all of them social assets.
  Accepted.
- **Revoked sessions keep page shells** until the JWT expires (they get no
  data). Accepted.
- **Concurrent note writes** on the same row can lose one (one Notion round
  trip). Accepted.

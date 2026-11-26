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


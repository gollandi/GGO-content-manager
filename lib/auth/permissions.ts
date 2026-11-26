import type { Role } from "./roles";

/**
 * One table of what each role may reach and do. Edge-safe (no fs): the
 * middleware reads it from the JWT role, the Node routes read it again.
 *
 * Roles not listed in RESTRICTED_SURFACES keep today's behaviour (every page
 * behind a session). The `social` role is fenced by an allow-list: several
 * API routes rely on the middleware session alone (no route guard), so
 * anything not listed here must be unreachable for that role.
 */

export type CancelloAct = "approve" | "modify" | "reject" | "done" | "delete" | "send" | "comment" | "ready" | "request";
export type CancelloTarget = "desk" | "calendar" | "website";

interface Surface {
    /** Where a page request outside the allow-list is sent. */
    home: string;
    /** Exact page paths, or prefixes ending in "/". */
    pages: string[];
    /** Exact API paths, or prefixes ending in "/". */
    apis: string[];
}

export const RESTRICTED_SURFACES: Partial<Record<Role, Surface>> = {
    social: {
        home: "/review",
        pages: ["/review", "/carico", "/guida", "/performance", "/website", "/briefs", "/comments", "/benvenuto"],
        apis: [
            "/api/auth/",
            // Read-only rooms, exact paths (never a /api/notion/ prefix).
            // The website registry is read through a GET-only route: the
            // owner's /api/notion/content also takes a writing POST.
            "/api/notion/performance-snapshot",
            "/api/social/pages",
            // Briefs and strategies: the route checks the role and the
            // collaborator's house handle; the house writer checks the rest.
            "/api/social/briefs",
            // Comments: suggest and mark ready only; approving a reply is
            // PUBLISH_AUTHORITY["comment-reply"], checked in the route.
            "/api/social/comments",
            // The agreement: read and signed before anything else, and
            // downloadable after (routes run with contract "pending-ok").
            "/api/onboarding",
            "/api/contract/signed",
            "/api/natascia/weekly",
            "/api/review-dashboard/state",
            "/api/review-dashboard/decision",
            "/api/review-dashboard/media",
            "/api/review-dashboard/video",
            "/api/media/uploads",
            "/api/media/uploads/",
            "/api/media/jobs",
        ],
    },
};

const matches = (pathname: string, entries: string[]) =>
    entries.some((e) => (e.endsWith("/") ? pathname.startsWith(e) : pathname === e));

export type Reach = { ok: true } | { ok: false; redirect?: string };

/** May this role open this path? Unrestricted roles reach everything a session reaches. */
export function canReach(role: Role | undefined, pathname: string): Reach {
    const surface = role ? RESTRICTED_SURFACES[role] : undefined;
    if (!surface) return { ok: true };
    if (pathname.startsWith("/api/")) return matches(pathname, surface.apis) ? { ok: true } : { ok: false };
    if (matches(pathname, surface.pages)) return { ok: true };
    return { ok: false, redirect: surface.home };
}

/**
 * Who may release something to the public, by kind of public act. Approving
 * a social row is publishing it (Level E.1); approving a reply to a YouTube
 * comment is posting it. Today only the admin — JJ — holds either.
 *
 * Widening is a deliberate edit of this table, not a rewrite. What reads it
 * today: `social-post` governs approve and send on calendar rows
 * (allowedActs below); `comment-reply` governs approving a reply in the
 * Comments room. The two other entries are documentation of gates that
 * live outside the cockpit. The house must
 * agree too — its lifecycle names `jj` as the actor of Review → Approved
 * (core/publish-state.js) and the reply dispatcher posts as JJ's decision
 * (operations/youtube-reply-dispatch.js) — so a widening is a pair of
 * commits, one here and one there, never this table alone.
 *
 * The website (publish in Sanity) and the newsletter (send in Beehiiv) are
 * not released from the cockpit at all; they are listed so the table names
 * every gate, and they stay empty.
 */
export type PublicAct = "social-post" | "comment-reply" | "website-page" | "newsletter";
export const PUBLISH_AUTHORITY: Readonly<Record<PublicAct, readonly Role[]>> = Object.freeze({
    "social-post": Object.freeze(["admin"] as Role[]),
    "comment-reply": Object.freeze(["admin"] as Role[]),
    "website-page": Object.freeze([] as Role[]),
    newsletter: Object.freeze([] as Role[]),
});

export type PublishAuthority = Readonly<Record<PublicAct, readonly Role[]>>;

export function mayPublish(role: Role | undefined, act: PublicAct, authority: PublishAuthority = PUBLISH_AUTHORITY): boolean {
    return !!role && authority[act].includes(role);
}

/** Cancello acts that release a social post: they follow PUBLISH_AUTHORITY. */
const SOCIAL_RELEASE_ACTS: readonly CancelloAct[] = ["approve", "send"];

/**
 * The Cancello acts each role may take. Approve is publish, so approve,
 * send, reject, done and delete — every act that closes or releases work —
 * are JJ's alone — and so is sending a row back to Draft, which the house's
 * lifecycle (core/publish-state.js) declares a `jj` transition. Collaborators
 * speak on rows (a note, "ready for JJ", "changes requested"); they never
 * move a status.
 */
const ACTS: Record<Role, Partial<Record<CancelloTarget, CancelloAct[]>>> = {
    admin: {
        desk: ["approve", "modify", "reject", "done", "delete"],
        calendar: ["approve", "modify", "reject", "done", "delete", "send", "comment"],
        website: ["approve", "modify"],
    },
    editor: {
        calendar: ["comment", "ready", "request"],
    },
    social: {
        calendar: ["comment", "ready", "request"],
    },
    viewer: {},
};

export function allowedActs(role: Role | undefined, target: CancelloTarget, authority: PublishAuthority = PUBLISH_AUTHORITY): CancelloAct[] {
    if (!role) return [];
    const listed = ACTS[role]?.[target] ?? [];
    if (target !== "calendar") return listed;
    // Releasing a social post is governed by PUBLISH_AUTHORITY, whatever ACTS lists.
    const releases = mayPublish(role, "social-post", authority) ? SOCIAL_RELEASE_ACTS : [];
    return [...listed.filter((a) => !SOCIAL_RELEASE_ACTS.includes(a)), ...releases];
}

export function mayAct(role: Role | undefined, target: CancelloTarget, act: CancelloAct): boolean {
    return allowedActs(role, target).includes(act);
}

/** Which Cancello sections a role is shown at all. */
export function visibleCancelloSections(role: Role | undefined): { wall: boolean; desk: boolean; calendar: boolean; website: boolean } {
    if (role === "social") return { wall: false, desk: false, calendar: true, website: false };
    return { wall: true, desk: true, calendar: true, website: true };
}

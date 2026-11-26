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

export type CancelloAct = "approve" | "modify" | "reject" | "done" | "delete" | "send" | "comment" | "ready";
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
        pages: ["/review", "/carico", "/guida"],
        apis: [
            "/api/auth/",
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
 * The Cancello acts each role may take. Approve is publish, so approve,
 * send, reject, done and delete — every act that closes or releases work —
 * are JJ's alone. Collaborators speak on rows; they never decide them.
 */
const ACTS: Record<Role, Partial<Record<CancelloTarget, CancelloAct[]>>> = {
    admin: {
        desk: ["approve", "modify", "reject", "done", "delete"],
        calendar: ["approve", "modify", "reject", "done", "delete", "send", "comment"],
        website: ["approve", "modify"],
    },
    editor: {
        desk: ["comment"],
        calendar: ["modify", "comment", "ready"],
    },
    social: {
        calendar: ["modify", "comment", "ready"],
    },
    viewer: {},
};

export function allowedActs(role: Role | undefined, target: CancelloTarget): CancelloAct[] {
    if (!role) return [];
    return ACTS[role]?.[target] ?? [];
}

export function mayAct(role: Role | undefined, target: CancelloTarget, act: CancelloAct): boolean {
    return allowedActs(role, target).includes(act);
}

/** Which Cancello sections a role is shown at all. */
export function visibleCancelloSections(role: Role | undefined): { wall: boolean; desk: boolean; calendar: boolean; website: boolean } {
    if (role === "social") return { wall: false, desk: false, calendar: true, website: false };
    return { wall: true, desk: true, calendar: true, website: true };
}

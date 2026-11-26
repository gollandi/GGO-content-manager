import { canReach } from "./permissions";
import { getRoleForEmail, type Role } from "./roles";

/**
 * The middleware's decision, as a pure function so its order can be tested.
 * Edge-safe: no fs, no next-auth.
 *
 * Order matters:
 *  1. Framework paths and the invitation (no session needed, and a signed-in
 *     collaborator using a reset link must reach it).
 *  2. The role fence — BEFORE the exemptions, because several exempt routes
 *     accept any session (views, the LLM ledger) and several guarded ones
 *     rely on the middleware alone.
 *  3. Exempt machine routes (their own bearer or session checks).
 *  4. No session → sign-in.
 */
export type GateDecision =
    | { kind: "next" }
    | { kind: "login" }
    | { kind: "forbidden" }
    | { kind: "redirect"; to: string };

export interface GateSession {
    email?: string | null;
    role?: Role;
    collaborator?: boolean;
}

/**
 * The role that counts for a session. A collaborator's role is in the
 * token and re-checked against the store by the Node routes; anyone else's
 * is recomputed from the environment on every request, so a token issued
 * before a change to ADMIN_EMAIL or COCKPIT_USER_EMAIL cannot keep — or
 * lack — power it should not.
 */
export function effectiveRole(session: GateSession | null | undefined): Role | undefined {
    if (!session) return undefined;
    if (session.collaborator) return session.role;
    return session.email ? getRoleForEmail(session.email) : session.role;
}

const OPEN = (p: string) =>
    p.startsWith("/_next") || p.startsWith("/favicon") || p.startsWith("/api/auth/")
    || p === "/login" || p === "/invito" || p === "/api/auth-invite/redeem" || p === "/api/auth-invite/contract";

const EXEMPT = (p: string) =>
    p.startsWith("/api/views")
    || p === "/api/review-dashboard/state"
    || p === "/api/llm/guard"
    || p === "/api/media/uploads"
    || p === "/api/media/jobs"
    || p === "/api/board/sync"
    || p === "/api/review-dashboard/buffer-sweep";

export function gate(pathname: string, session: GateSession | null | undefined): GateDecision {
    if (OPEN(pathname)) return { kind: "next" };
    if (session) {
        const reach = canReach(effectiveRole(session), pathname);
        if (!reach.ok) {
            return pathname.startsWith("/api/") ? { kind: "forbidden" } : { kind: "redirect", to: reach.redirect ?? "/login" };
        }
    }
    if (EXEMPT(pathname)) return { kind: "next" };
    if (!session) return { kind: "login" };
    return { kind: "next" };
}

/**
 * Cross-site request refusal for state-changing API calls made with a
 * session. Session cookies are SameSite=Lax, which stops other sites but not
 * a sibling host on the same registrable domain (*.ggo-suite.co.uk), and the
 * routes accept a text/plain body. A browser always names the page that
 * sent a POST in `Origin`; a request without one is not from a browser page
 * and cannot ride a victim's cookie. NextAuth's own routes carry their own
 * CSRF token and are left to it.
 */
export function crossSiteWrite(input: {
    method: string; pathname: string; origin: string | null; secFetchSite: string | null; allowedOrigins: string[];
}): boolean {
    const { method, pathname, origin, secFetchSite, allowedOrigins } = input;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
    if (!pathname.startsWith("/api/") || pathname.startsWith("/api/auth/")) return false;
    if (secFetchSite === "same-origin") return false;
    if (!origin) return false;
    return !allowedOrigins.includes(origin);
}

/** The cockpit's public origin and the one the request arrived on. */
export function allowedOrigins(requestOrigin: string, env: NodeJS.ProcessEnv = process.env): string[] {
    const out = [requestOrigin];
    for (const url of [env.AUTH_URL, env.NEXTAUTH_URL, "https://cockpit.ggo-suite.co.uk"]) {
        try { if (url) out.push(new URL(url).origin); } catch { /* not a URL */ }
    }
    return out;
}

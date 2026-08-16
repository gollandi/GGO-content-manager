import { auth } from "./lib/auth/edge-config";
import { NextResponse } from "next/server";

/**
 * Protect all routes except login, static files, and auth API.
 * Unauthenticated users are redirected to /login.
 */
export default auth((req) => {
    const { pathname } = req.nextUrl;

    // Allow auth routes and login page through
    if (
        pathname.startsWith("/api/auth") ||
        pathname === "/login" ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        // View API does its own auth (NextAuth session OR service token for
        // headless consumers) — a login redirect would break machine calls.
        pathname.startsWith("/api/views") ||
        // Same contract for the Cancello state read: the route accepts the
        // service token (read-only) and otherwise enforces the session
        // itself — the redirect would break the media-sync job.
        pathname === "/api/review-dashboard/state" ||
        // Il Carico's two listing endpoints do their own auth (session OR
        // service token) so the worker and ernesto can poll the inbox and
        // the worker's output headlessly. The exemption is per path, not
        // per method, so POST /api/media/uploads passes through here too —
        // it is guarded by requireWriter() in the route, which answers 401
        // rather than redirecting. Chunk deposit (…/uploads/<id>) is not
        // exempted at all.
        pathname === "/api/media/uploads" ||
        pathname === "/api/media/jobs"
    ) {
        return NextResponse.next();
    }

    // Redirect unauthenticated users to login
    if (!req.auth) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        /*
         * Match all paths except static files and images.
         * Next.js internals (_next) are handled in the function body.
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};

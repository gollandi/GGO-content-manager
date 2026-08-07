import { auth } from "./lib/auth/config";
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
        pathname === "/api/review-dashboard/state"
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

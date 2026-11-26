import { auth } from "./lib/auth/edge-config";
import { NextResponse } from "next/server";
import { gate } from "./lib/auth/gate";

/**
 * Every request passes the gate in lib/auth/gate.ts: framework paths and the
 * invitation are open; restricted roles (the social media manager) reach an
 * allow-list only; machine routes that check their own bearer are exempt;
 * anyone else without a session is sent to sign in.
 *
 * Exempt routes (their reasons, kept from the old inline list):
 *  - /api/views, /api/review-dashboard/state: session OR service token for
 *    headless consumers (the media-sync job); a redirect breaks machine calls.
 *  - /api/llm/guard: service-token GET; POST is admin-session only in the route.
 *  - /api/media/uploads, /api/media/jobs: session OR service token so the
 *    worker and ernesto poll headlessly. Per path, not per method: POST
 *    /api/media/uploads is guarded by requireUploader() in the route.
 *  - /api/board/sync: the Mac bridge's service token, checked in the route.
 *  - /api/review-dashboard/buffer-sweep: its own bearer, the VPS timer only.
 */
export default auth((req) => {
    const { pathname } = req.nextUrl;
    const decision = gate(pathname, req.auth?.user ?? null);
    switch (decision.kind) {
        case "forbidden":
            return NextResponse.json({ error: "Not available for your role" }, { status: 403 });
        case "redirect":
            return NextResponse.redirect(new URL(decision.to, req.url));
        case "login": {
            const loginUrl = new URL("/login", req.url);
            loginUrl.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(loginUrl);
        }
        default:
            return NextResponse.next();
    }
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

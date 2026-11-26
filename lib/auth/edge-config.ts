import NextAuth from "next-auth";
import { getRoleForEmail, type Role } from "./roles";

/**
 * Edge-safe auth instance for the middleware ONLY.
 *
 * The middleware never signs anyone in — it only decodes the session JWT
 * (same AUTH_SECRET as the full config) to decide redirect-or-pass. Keeping
 * providers out of this instance keeps bcryptjs and the Google provider out
 * of the middleware bundle, which otherwise pays their cold-start on every
 * request. Sign-in flows go through /api/auth/*, which uses ./config.
 */
export const { auth } = NextAuth({
    trustHost: true,
    providers: [],
    callbacks: {
        async jwt({ token, user }) {
            // Sign-in happens in ./config (Node); this branch only runs if a
            // sign-in ever reached the edge instance, and keeps the same shape.
            if (user?.email) {
                token.role = user.role ?? getRoleForEmail(user.email);
                token.collaborator = user.collaborator === true;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as Role;
                session.user.collaborator = token.collaborator === true;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
});

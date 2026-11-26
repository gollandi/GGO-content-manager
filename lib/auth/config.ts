import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getRoleForEmail, type Role } from "./roles";
import { admitGoogle, authorizeCredentials } from "./credentials";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleProvider =
    googleClientId && googleClientSecret
        ? Google({
              clientId: googleClientId,
              clientSecret: googleClientSecret,
          })
        : null;

const publicAuthUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
const productionAuthUrl = "https://cockpit.ggo-suite.co.uk";
const resolvedAuthUrl =
    process.env.NODE_ENV === "production" &&
    (!publicAuthUrl || /^https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(publicAuthUrl))
        ? productionAuthUrl
        : publicAuthUrl;

if (resolvedAuthUrl) {
    process.env.AUTH_URL = resolvedAuthUrl;
    process.env.NEXTAUTH_URL = resolvedAuthUrl;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    // The cockpit is served by the resident LaunchAgent (`next start` on
    // localhost:3010). In production next-auth refuses any host it has not
    // been told to trust — dev trusts localhost implicitly, prod does not —
    // so every API call died with UntrustedHost. Local-only service today;
    // revisit when the VPS deploy fronts this with a real hostname.
    trustHost: true,
    providers: [
        ...(googleProvider ? [googleProvider] : []),
        Credentials({
            name: "Email & Password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: (credentials) => authorizeCredentials(credentials),
        }),
    ],
    callbacks: {
        /**
         * Google, if it is ever configured, admits only people the cockpit
         * already knows: the owner, ADMIN_EMAIL, or an active collaborator
         * (who then holds the stored role). Anyone else is refused instead
         * of becoming a viewer of everything.
         */
        async signIn({ user, account }) {
            return account?.provider !== "google" || admitGoogle(user);
        },
        async jwt({ token, user }) {
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

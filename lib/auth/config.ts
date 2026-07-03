import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getRoleForEmail, type Role } from "./roles";
import bcryptjs from "bcryptjs";

/**
 * Credentials users — stored here for now.
 * For a larger team, move to a database.
 *
 * To generate a hash: node -e "require('bcryptjs').hash('password', 10).then(console.log)"
 */
const CREDENTIALS_USERS: Record<string, { name: string; hash: string }> = {
    // Example:
    // "admin@ggomed.co.uk": { name: "JJ", hash: "$2a$10$..." },
};

/**
 * Env-driven single-operator user (12-factor — no code edit per user):
 *   COCKPIT_USER_EMAIL=you@example.com
 *   COCKPIT_USER_HASH=$2a$10$...   (bcrypt — see hash one-liner above)
 * Merged on top of CREDENTIALS_USERS; hardcoded entries still work.
 */
if (process.env.COCKPIT_USER_EMAIL && process.env.COCKPIT_USER_HASH) {
    CREDENTIALS_USERS[process.env.COCKPIT_USER_EMAIL.toLowerCase()] = {
        name: process.env.COCKPIT_USER_NAME || "Operator",
        hash: process.env.COCKPIT_USER_HASH,
    };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: "Email & Password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = (credentials?.email as string)?.toLowerCase();
                const password = credentials?.password as string;
                if (!email || !password) return null;

                const user = CREDENTIALS_USERS[email];
                if (!user) return null;

                const valid = await bcryptjs.compare(password, user.hash);
                if (!valid) return null;

                return { id: email, email, name: user.name };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user?.email) {
                token.role = getRoleForEmail(user.email);
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as Role;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
});

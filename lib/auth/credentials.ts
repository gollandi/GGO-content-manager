import bcryptjs from "bcryptjs";
import type { User } from "next-auth";
import { getRoleForEmail } from "./roles";
import { storeStanding, verifyStoredCredentials } from "./users";
import { noteSignInFailure, signInThrottled } from "./throttle";

/**
 * Who may sign in, and as whom. Kept out of ./config so the order can be
 * tested without next-auth: owner first, then collaborators.
 */

const MIN_PASSWORD_LENGTH = 12;

export type OwnerEntry = { name: string; hash: string };

/**
 * The env operator, read at call time (12-factor, no code edit per user):
 *   COCKPIT_USER_EMAIL, COCKPIT_USER_NAME, and COCKPIT_USER_HASH_B64 —
 *   base64 of the bcrypt hash, because Next's env loader runs dotenv-expand,
 *   which eats the `$` sequences of a raw hash. COCKPIT_USER_HASH still works.
 */
export function envOwners(env: NodeJS.ProcessEnv = process.env): Record<string, OwnerEntry> {
    const hash = env.COCKPIT_USER_HASH_B64
        ? Buffer.from(env.COCKPIT_USER_HASH_B64, "base64").toString("utf8")
        : env.COCKPIT_USER_HASH;
    if (!env.COCKPIT_USER_EMAIL || !hash) return {};
    return { [env.COCKPIT_USER_EMAIL.trim().toLowerCase()]: { name: env.COCKPIT_USER_NAME || "Operator", hash } };
}

/**
 * The client address as nginx saw it: the LAST hop of X-Forwarded-For, the
 * one nginx appends. Earlier hops are whatever the client claimed, and
 * trusting them would let a guesser pick any address, the victim's included.
 */
export function clientIp(request?: Request): string {
    const fwd = request?.headers?.get("x-forwarded-for");
    const hops = fwd ? fwd.split(",").map((h) => h.trim()).filter(Boolean) : [];
    return hops.at(-1) || request?.headers?.get("x-real-ip")?.trim() || "unknown";
}

export async function authorizeCredentials(
    raw: { email?: unknown; password?: unknown } | undefined,
    owners: Record<string, OwnerEntry> = envOwners(),
    ip = "unknown",
): Promise<User | null> {
    // Trimmed as the store trims, so " d@x" and "d@x" are one address for
    // the sign-in brake as well as for the store.
    const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
    const password = typeof raw?.password === "string" ? raw.password : "";
    if (!email || !password) return null;
    // Password policy: minimum 12 characters.
    if (password.length < MIN_PASSWORD_LENGTH) return null;

    // The owner first, without touching the user store: a broken store must
    // never stand between JJ and his own gate. His address cannot be in the
    // store (inviteUser refuses it).
    const owner = owners[email];
    if (owner) {
        return (await bcryptjs.compare(password, owner.hash)) ? { id: email, email, name: owner.name } : null;
    }

    // The brake applies to collaborators only: throttling the owner's
    // address would let anyone who knows it lock him out.
    if (signInThrottled(email, ip)) return null;
    let collaborator = null;
    try {
        collaborator = await verifyStoredCredentials(email, password);
    } catch (err) {
        console.error("[auth] user store unreadable at sign-in:", (err as Error).message);
        return null;
    }
    if (!collaborator) {
        noteSignInFailure(email, ip);
        return null;
    }
    return { id: email, email, name: collaborator.name, role: collaborator.role, collaborator: true };
}

/**
 * Google, if it is ever configured, admits only people the cockpit already
 * knows: the owner or ADMIN_EMAIL, or an active collaborator (who then holds
 * the stored role). Anyone else is refused instead of becoming a viewer of
 * everything. Mutates `user` so the jwt callback receives the stored role.
 */
export function admitGoogle(user: User): boolean {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return false;
    if (getRoleForEmail(email) === "admin") return true;
    const standing = storeStanding(email);
    if (standing.kind !== "active") return false;
    user.role = standing.role;
    user.name = standing.name;
    user.collaborator = true;
    return true;
}

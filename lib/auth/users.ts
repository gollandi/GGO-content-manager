import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcryptjs from "bcryptjs";
import { isAssignableRole, type AssignableRole } from "./roles";

/**
 * Collaborators — the people other than the env operator who may sign in.
 *
 * A small JSON file, mode 0600, outside the deploy tree (the VPS deploy
 * rsyncs with --delete into /srv/ggo-content-manager, so the store must not
 * live there). One Node process serves the cockpit, so an in-process queue
 * serialises writes; every write is tmp-then-rename, so a crash never leaves
 * half a file.
 *
 * Passwords never pass through JJ or an agent: an admin creates an invite,
 * the collaborator redeems the one-time link and sets their own password. Only
 * a SHA-256 of the invite token and a bcrypt hash of the password are stored.
 */

export const MIN_PASSWORD_LENGTH = 12;
/** bcrypt reads at most 72 bytes; refuse longer rather than silently truncate. */
export const MAX_PASSWORD_BYTES = 72;
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export interface StoredUser {
    email: string;
    name: string;
    role: AssignableRole;
    /** bcrypt hash; null until the first invite is redeemed. */
    hash: string | null;
    disabled: boolean;
    invite: { tokenHash: string; expiresAt: string } | null;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    /**
     * Their name on the house board (house-board.js COLLABORATORS), set by
     * the owner. Absent: they cannot brief the house. Never derived from
     * `name`, so a collaborator called Greta cannot speak as the agent.
     */
    houseHandle?: string | null;
}

/** What the UI may see: never a hash or a token hash. */
export interface PublicUser {
    email: string;
    name: string;
    role: AssignableRole;
    status: "active" | "invited" | "disabled";
    inviteExpiresAt: string | null;
    createdAt: string;
    createdBy: string;
    houseHandle: string | null;
}

interface StoreFile { version: 1; users: StoredUser[] }

export function authDir(): string {
    if (process.env.COCKPIT_AUTH_DIR) return process.env.COCKPIT_AUTH_DIR;
    if (process.env.COCKPIT_SNAPSHOT_DIR) return path.join(process.env.COCKPIT_SNAPSHOT_DIR, "auth");
    return path.join(process.cwd(), ".runs", "auth");
}
const storePath = () => path.join(authDir(), "users.json");

function read(): StoreFile {
    const p = storePath();
    if (!existsSync(p)) return { version: 1, users: [] };
    const parsed = JSON.parse(readFileSync(p, "utf8")) as Partial<StoreFile>;
    // Fail loud: a corrupt store must not silently become "no collaborators"
    // and must never be overwritten by the next write.
    if (parsed?.version !== 1 || !Array.isArray(parsed.users)) {
        throw new Error(`user store ${p} is not a version-1 store`);
    }
    return { version: 1, users: parsed.users };
}

function write(store: StoreFile): void {
    const dir = authDir();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const p = storePath();
    const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
    renameSync(tmp, p);
    chmodSync(p, 0o600);
}

// On globalThis so a module loaded twice by the bundler still shares one queue.
const globals = globalThis as typeof globalThis & { __ggoUserStoreQueue?: Promise<unknown> };
function mutate<T>(fn: (store: StoreFile) => T): Promise<T> {
    const run = (globals.__ggoUserStoreQueue ?? Promise.resolve()).then(() => {
        const store = read();
        const result = fn(store);
        write(store);
        return result;
    });
    globals.__ggoUserStoreQueue = run.catch(() => undefined);
    return run;
}

const now = () => new Date().toISOString();
const normEmail = (email: string) => email.trim().toLowerCase();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toPublic(u: StoredUser, at = Date.now()): PublicUser {
    const inviteLive = u.invite && Date.parse(u.invite.expiresAt) > at;
    return {
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.disabled ? "disabled" : u.hash ? "active" : "invited",
        inviteExpiresAt: inviteLive ? u.invite!.expiresAt : null,
        createdAt: u.createdAt,
        createdBy: u.createdBy,
        houseHandle: u.houseHandle ?? null,
    };
}

export function listUsers(): PublicUser[] {
    return read().users.map((u) => toPublic(u));
}

export function findUser(email: string): StoredUser | null {
    const e = normEmail(email);
    return read().users.find((u) => u.email === e) ?? null;
}

export function validatePassword(password: string): string | null {
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        return `The password must be at most ${MAX_PASSWORD_BYTES} bytes.`;
    }
    return null;
}

/**
 * Create a collaborator, or issue a fresh link to an existing one (a
 * password reset). For an active collaborator the current password keeps
 * working until the link is redeemed, so a lost email locks nobody out; a
 * switched-off one stays off until then.
 */
export async function inviteUser(input: {
    email: string; name: string; role: AssignableRole; by: string;
}): Promise<{ user: PublicUser; token: string; expiresAt: string }> {
    const email = normEmail(input.email);
    const name = input.name.trim();
    if (!EMAIL_RE.test(email)) throw new Error("A valid email is required.");
    if (!name) throw new Error("A name is required.");
    if (name.length > 80) throw new Error("The name is too long.");
    // Notes are signed by name; "JJ" is the owner's signature and only his.
    if (/^jj$/i.test(name.replace(/[\s.]/g, ""))) throw new Error("That name is reserved for the owner.");
    if (!isAssignableRole(input.role)) throw new Error("Unknown role.");
    // The owner's sign-in never enters the store: it would compete with the
    // env operator and could be disabled from the UI.
    const reserved = [process.env.COCKPIT_USER_EMAIL, process.env.ADMIN_EMAIL]
        .filter((e): e is string => Boolean(e)).map(normEmail);
    if (reserved.includes(email)) {
        throw new Error("That address is the owner's sign-in; it cannot be invited.");
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const user = await mutate((store) => {
        let u = store.users.find((x) => x.email === email);
        const at = now();
        if (!u) {
            u = { email, name, role: input.role, hash: null, disabled: false, invite: null,
                createdAt: at, createdBy: input.by, updatedAt: at };
            store.users.push(u);
        }
        u.name = name;
        u.role = input.role;
        // A switched-off collaborator stays off until the new link is used:
        // re-inviting must not bring the old password back to life.
        u.invite = { tokenHash: sha256(token), expiresAt };
        u.updatedAt = at;
        return toPublic(u);
    });
    return { user, token, expiresAt };
}

function matchToken(store: StoreFile, token: string): StoredUser | null {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
    const want = Buffer.from(sha256(token), "hex");
    const at = Date.now();
    let found: StoredUser | null = null;
    for (const u of store.users) {
        if (!u.invite) continue;
        const have = Buffer.from(u.invite.tokenHash, "hex");
        // Compare every candidate in constant time; no early exit on a match.
        if (have.length === want.length && timingSafeEqual(have, want)
            && Date.parse(u.invite.expiresAt) > at) {
            found = u;
        }
    }
    return found;
}

/** What the invite page shows before the password is set. */
export function describeInvite(token: string): { email: string; name: string } | null {
    const u = matchToken(read(), token);
    return u ? { email: u.email, name: u.name } : null;
}

export async function redeemInvite(token: string, password: string): Promise<PublicUser> {
    const problem = validatePassword(password);
    if (problem) throw new Error(problem);
    const hash = await bcryptjs.hash(password, 10);
    return mutate((store) => {
        const u = matchToken(store, token);
        if (!u) throw new Error("This link is not valid any more. Ask for a new one.");
        u.hash = hash;
        u.invite = null;
        u.disabled = false;
        u.updatedAt = now();
        return toPublic(u);
    });
}

export async function setDisabled(email: string, disabled: boolean): Promise<PublicUser> {
    const e = normEmail(email);
    return mutate((store) => {
        const u = store.users.find((x) => x.email === e);
        if (!u) throw new Error("No such collaborator.");
        u.disabled = disabled;
        if (disabled) u.invite = null;
        u.updatedAt = now();
        return toPublic(u);
    });
}

/**
 * Give a collaborator their house handle, or take it away (null). The handle
 * must be on the house's collaborator roster (`allowed`, read from the
 * vendored house writer) and belong to nobody else.
 */
export async function setHouseHandle(email: string, handle: string | null, allowed: readonly string[]): Promise<PublicUser> {
    const e = normEmail(email);
    const h = handle === null ? null : String(handle).trim().toLowerCase();
    if (h !== null && !allowed.includes(h)) throw new Error(`"${handle}" is not on the house's collaborator roster.`);
    return mutate((store) => {
        const u = store.users.find((x) => x.email === e);
        if (!u) throw new Error("No such collaborator.");
        if (h !== null && store.users.some((x) => x.email !== e && x.houseHandle === h)) {
            throw new Error(`"${h}" already belongs to another collaborator.`);
        }
        u.houseHandle = h;
        u.updatedAt = now();
        return toPublic(u);
    });
}

/** Sign-in check for collaborators. Null for unknown, disabled or not yet activated. */
/** A bcrypt hash of nothing anyone knows: compared against when there is no real one. */
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Zt8m0rN8k5YbQ6Z1W4o0uW5z4b2W";

export async function verifyStoredCredentials(email: string, password: string): Promise<StoredUser | null> {
    const u = findUser(email);
    const usable = Boolean(u && !u.disabled && u.hash) && Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;
    // Always pay one bcrypt comparison, so the time taken does not tell an
    // outsider which addresses belong to active collaborators.
    const ok = await bcryptjs.compare(password, usable ? u!.hash! : DUMMY_HASH);
    return usable && ok ? u : null;
}

/**
 * Per-request re-check for a signed-in session. A JWT outlives a change in
 * the store, so the Node routes ask the store again: "absent" means the
 * person is not a collaborator (the env operator, or a Google viewer) and the
 * token's role stands; anything else overrides the token.
 */
export function storeStanding(email: string):
    | { kind: "absent" }
    | { kind: "active"; role: AssignableRole; name: string; houseHandle: string | null }
    | { kind: "revoked" } {
    let u: StoredUser | null;
    try {
        u = findUser(email);
    } catch (err) {
        // A broken store must refuse collaborators, not wave them through.
        console.error("[auth] user store unreadable:", (err as Error).message);
        return { kind: "revoked" };
    }
    if (!u) return { kind: "absent" };
    if (u.disabled || !u.hash) return { kind: "revoked" };
    return { kind: "active", role: u.role, name: u.name, houseHandle: u.houseHandle ?? null };
}

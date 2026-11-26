/**
 * Roles, from most to least power.
 *
 * - admin:  JJ. Everything, and the only role that may approve (approve is
 *           publish — gate #2), send to Buffer, close or delete work.
 * - editor: read everything, write reviews and notes; never approves.
 * - social: the social media manager. Reaches the Cancello's social rows,
 *           Il Carico and the guide only; may comment, mark a row ready for
 *           JJ, request changes and upload media. Never moves a status.
 * - viewer: read-only (e.g. a PIF Tick assessor).
 *
 * Collaborators live in the user store (./users.ts) with their role; the map
 * below is the fallback for the env operator and Google sign-ins.
 */
export type Role = "admin" | "editor" | "social" | "viewer";

export const ROLES: readonly Role[] = ["admin", "editor", "social", "viewer"];

/** Roles an admin may hand to a collaborator. Admin is never granted from the UI. */
export type AssignableRole = Exclude<Role, "admin">;
/**
 * Only `social` is offered today. `editor` and `viewer` are not fenced by
 * the middleware allow-list (they see every page), and the cockpit holds
 * clinical and governance surfaces; widening this list needs its own fence.
 */
export const ASSIGNABLE_ROLES: readonly AssignableRole[] = ["social"];

export function isRole(value: unknown): value is Role {
    return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isAssignableRole(value: unknown): value is AssignableRole {
    return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

const EMAIL_ROLES: Record<string, Role> = {
    // Add authorised emails here, e.g.:
    // "assessor@piftick.org": "viewer",
};

/**
 * The env operator (COCKPIT_USER_EMAIL) is the cockpit's owner and always
 * admin, as is ADMIN_EMAIL. Approve is admin-only now; tying the owner's
 * power to one optional variable would risk locking him out of his own gate.
 */
export function getRoleForEmail(email: string): Role {
    const e = email.toLowerCase();
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const operatorEmail = process.env.COCKPIT_USER_EMAIL?.toLowerCase();
    if ((adminEmail && e === adminEmail) || (operatorEmail && e === operatorEmail)) return "admin";
    return EMAIL_ROLES[e] ?? "viewer";
}

export function canWrite(role: Role): boolean {
    return role === "admin" || role === "editor";
}

/** Il Carico: the social media manager brings media in too. */
export function canUpload(role: Role): boolean {
    return canWrite(role) || role === "social";
}

export function canAdmin(role: Role): boolean {
    return role === "admin";
}

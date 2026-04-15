export type Role = "admin" | "editor" | "viewer";

/**
 * Map email addresses to roles.
 *
 * - admin:  full access (read + write + settings)
 * - editor: read + validate + write reviews
 * - viewer: read-only (e.g. PIF Tick assessor)
 *
 * Users not in this map who sign in via Google OAuth get "viewer" by default.
 * Credentials users must be listed here — unrecognised credentials are rejected.
 */
const EMAIL_ROLES: Record<string, Role> = {
    // Add authorised emails here, e.g.:
    // "jj@ggomed.co.uk": "admin",
    // "assessor@piftick.org": "viewer",
};

// Fallback: if ADMIN_EMAIL env var is set, that email is always admin.
// This avoids hardcoding your email in source code.
export function getRoleForEmail(email: string): Role {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (adminEmail && email.toLowerCase() === adminEmail) return "admin";
    return EMAIL_ROLES[email.toLowerCase()] ?? "viewer";
}

export function canWrite(role: Role): boolean {
    return role === "admin" || role === "editor";
}

export function canAdmin(role: Role): boolean {
    return role === "admin";
}

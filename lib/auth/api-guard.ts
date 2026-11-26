import { NextResponse } from "next/server";
import { auth } from "./config";
import { canAdmin, canUpload, canWrite, type Role } from "./roles";
import { storeStanding } from "./users";
import { effectiveRole } from "./gate";
import { contractStanding } from "../contracts/store";

interface AuthResult {
    authenticated: true;
    email: string;
    /** Display name for attribution ("JJ", "Diletta"). */
    name: string;
    role: Role;
    /** A collaborator's name on the house board; null for the owner and anyone without one. */
    houseHandle: string | null;
}

interface AuthError {
    authenticated: false;
    response: NextResponse;
}

const deny = (error: string, status: number): AuthError => ({
    authenticated: false,
    response: NextResponse.json({ error }, { status }),
});

/**
 * Check authentication for API routes. Returns who is acting and in which
 * role, or a 401.
 *
 * The JWT is signed at sign-in and outlives later changes, so for anyone
 * who is not the admin the user store is asked again on every call: a
 * collaborator JJ disabled is refused at once, and a changed role takes
 * effect at once. The admin is never in the store (the owner's address
 * cannot be invited), so a broken store can never lock him out.
 */
/**
 * `contract: "pending-ok"` is for the onboarding routes only: a collaborator
 * whose agreement is not yet accepted may read and sign it, and nothing else.
 */
export interface AuthOptions { contract?: "required" | "pending-ok" }

export async function requireAuth(options: AuthOptions = {}): Promise<AuthResult | AuthError> {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return deny("Authentication required", 401);

    let role: Role = effectiveRole(session.user) ?? "viewer";
    let name = session.user.name || email;
    let houseHandle: string | null = null;
    if (role !== "admin") {
        const standing = storeStanding(email);
        if (standing.kind === "revoked") return deny("Access revoked", 401);
        // A collaborator's token whose record has gone (store reset) is not
        // a viewer by default: the person is no longer known, so refuse.
        if (standing.kind === "absent" && session.user.collaborator) return deny("Access revoked", 401);
        if (standing.kind === "active") {
            role = standing.role;
            name = standing.name;
            houseHandle = standing.houseHandle;
            // No data before the agreement is accepted (the contract's own
            // gate 2). A store or contract that cannot be read refuses.
            if (options.contract !== "pending-ok") {
                let accepted = false;
                try {
                    accepted = contractStanding(email).kind === "accepted";
                } catch (err) {
                    console.error("[auth] contract standing unreadable:", (err as Error).message);
                }
                if (!accepted) {
                    return {
                        authenticated: false,
                        response: NextResponse.json({ error: "Your agreement with GGO Med comes first: open the welcome page to read and sign it.", code: "CONTRACT_REQUIRED" }, { status: 403 }),
                    };
                }
            }
        }
    }
    return { authenticated: true, email, name, role, houseHandle };
}

/** Admin or editor. 403 otherwise. */
export async function requireWriter(): Promise<AuthResult | AuthError> {
    const result = await requireAuth();
    if (!result.authenticated) return result;
    if (!canWrite(result.role)) return deny("Write access required", 403);
    return result;
}

/** Il Carico: writers and the social media manager. 403 otherwise. */
export async function requireUploader(): Promise<AuthResult | AuthError> {
    const result = await requireAuth();
    if (!result.authenticated) return result;
    if (!canUpload(result.role)) return deny("Upload access required", 403);
    return result;
}

/** Admin only. 403 otherwise. */
export async function requireAdmin(): Promise<AuthResult | AuthError> {
    const result = await requireAuth();
    if (!result.authenticated) return result;
    if (!canAdmin(result.role)) return deny("Admin access required", 403);
    return result;
}

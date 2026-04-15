import { NextResponse } from "next/server";
import { auth } from "./config";
import { canWrite, canAdmin, type Role } from "./roles";

interface AuthResult {
    authenticated: true;
    email: string;
    role: Role;
}

interface AuthError {
    authenticated: false;
    response: NextResponse;
}

/**
 * Check authentication for API routes.
 * Returns the user's email and role, or a 401 response.
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
    const session = await auth();

    if (!session?.user?.email) {
        return {
            authenticated: false,
            response: NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            ),
        };
    }

    return {
        authenticated: true,
        email: session.user.email,
        role: session.user.role ?? "viewer",
    };
}

/**
 * Check that the current user can write (admin or editor).
 * Returns 403 if viewer.
 */
export async function requireWriter(): Promise<AuthResult | AuthError> {
    const result = await requireAuth();
    if (!result.authenticated) return result;

    if (!canWrite(result.role)) {
        return {
            authenticated: false,
            response: NextResponse.json(
                { error: "Write access required" },
                { status: 403 }
            ),
        };
    }

    return result;
}

/**
 * Check that the current user is an admin.
 * Returns 403 if not.
 */
export async function requireAdmin(): Promise<AuthResult | AuthError> {
    const result = await requireAuth();
    if (!result.authenticated) return result;

    if (!canAdmin(result.role)) {
        return {
            authenticated: false,
            response: NextResponse.json(
                { error: "Admin access required" },
                { status: 403 }
            ),
        };
    }

    return result;
}

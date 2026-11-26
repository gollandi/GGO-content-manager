import type { Role } from "./roles";

declare module "next-auth" {
    interface User {
        role?: Role;
        /** Signed in from the user store (a collaborator), not the env operator. */
        collaborator?: boolean;
    }
    interface Session {
        user: {
            id?: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role: Role;
            collaborator?: boolean;
        };
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        role?: Role;
        collaborator?: boolean;
    }
}

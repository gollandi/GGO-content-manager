import type { Role } from "./roles";

declare module "next-auth" {
    interface User {
        role?: Role;
    }
    interface Session {
        user: {
            id?: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role: Role;
        };
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        role?: Role;
    }
}

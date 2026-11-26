// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { canReach, mayAct, allowedActs, type CancelloAct } from "../lib/auth/permissions";
import { getRoleForEmail } from "../lib/auth/roles";

/** Every page and API path the app serves, read from the app/ tree. */
function appRoutes(): string[] {
    const root = path.resolve(__dirname, "../app");
    const out: string[] = [];
    const walk = (dir: string, prefix: string) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) {
                const seg = name.startsWith("[") ? "x" : name;
                walk(full, `${prefix}/${seg}`);
            } else if (name === "page.tsx" || name === "route.ts") {
                out.push(prefix || "/");
            }
        }
    };
    walk(root, "");
    return out;
}

describe("the social role's fence", () => {
    const routes = appRoutes();

    it("reaches exactly the social queue, the upload room, the guide and the APIs they call", () => {
        const reached = routes.filter((r) => canReach("social", r).ok).sort();
        expect(reached).toEqual([
            "/api/auth/x",
            "/api/media/jobs",
            "/api/media/uploads",
            "/api/media/uploads/x",
            "/api/review-dashboard/decision",
            "/api/review-dashboard/media",
            "/api/review-dashboard/state",
            "/api/review-dashboard/video",
            "/carico",
            "/guida",
            "/review",
        ]);
    });

    it("is refused the routes the middleware otherwise exempts or leaves to the session", () => {
        for (const p of ["/api/views/editorial-content", "/api/llm/guard", "/api/board", "/api/board/sync",
            "/api/cache/invalidate", "/api/notion/patient-journeys", "/api/house/state", "/api/collaborators",
            "/api/review-dashboard/buffer-sweep", "/api/ernesto/directives"]) {
            expect(canReach("social", p)).toEqual({ ok: false });
        }
    });

    it("sends a page request outside the fence to the social queue", () => {
        expect(canReach("social", "/questioni")).toEqual({ ok: false, redirect: "/review" });
        expect(canReach("social", "/")).toEqual({ ok: false, redirect: "/review" });
    });

    it("leaves the admin unfenced", () => {
        for (const r of routes) expect(canReach("admin", r).ok).toBe(true);
    });
});

describe("who may act in the Cancello", () => {
    const closing: CancelloAct[] = ["approve", "send", "reject", "done", "delete"];

    it("keeps every act that closes or releases work for the admin alone", () => {
        for (const act of closing) {
            for (const role of ["editor", "social", "viewer"] as const) {
                for (const target of ["desk", "calendar", "website"] as const) {
                    expect(mayAct(role, target, act)).toBe(false);
                }
            }
        }
        expect(mayAct("admin", "calendar", "approve")).toBe(true);
        expect(mayAct("admin", "calendar", "send")).toBe(true);
    });

    it("lets the social role speak on calendar rows only", () => {
        expect(allowedActs("social", "calendar").sort()).toEqual(["comment", "modify", "ready"]);
        expect(allowedActs("social", "desk")).toEqual([]);
        expect(allowedActs("social", "website")).toEqual([]);
        expect(allowedActs(undefined, "calendar")).toEqual([]);
    });
});

describe("the owner is admin whatever ADMIN_EMAIL says", () => {
    it("treats the env operator as admin", () => {
        const before = { ...process.env };
        process.env.COCKPIT_USER_EMAIL = "Owner@Example.com";
        delete process.env.ADMIN_EMAIL;
        try {
            expect(getRoleForEmail("owner@example.com")).toBe("admin");
            expect(getRoleForEmail("someone@example.com")).toBe("viewer");
        } finally {
            process.env = before;
        }
    });
});

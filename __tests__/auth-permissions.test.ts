// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { canReach, mayAct, allowedActs, mayPublish, PUBLISH_AUTHORITY, type CancelloAct } from "../lib/auth/permissions";
import { getRoleForEmail } from "../lib/auth/roles";

/** Every page and API path the app serves, read from the app/ tree. */
function appRoutes(): string[] {
    const root = path.resolve(__dirname, "../app");
    const out: string[] = [];
    const walk = (dir: string, prefix: string) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) {
                if (name.startsWith("_")) continue; // private folders are not routes
                // Route groups do not appear in the URL; dynamic segments do.
                const seg = name.startsWith("(") ? null : name.startsWith("[") ? "x" : name;
                walk(full, seg === null ? prefix : `${prefix}/${seg}`);
            } else if (/^(page|route)\.(js|jsx|ts|tsx)$/.test(name)) {
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
            "/api/natascia/weekly",
            "/api/notion/performance-snapshot",
            "/api/review-dashboard/decision",
            "/api/review-dashboard/media",
            "/api/review-dashboard/state",
            "/api/review-dashboard/video",
            "/api/social/pages",
            "/carico",
            "/guida",
            "/performance",
            "/review",
            "/website",
        ]);
        // (/invito is opened by the gate before the fence: auth-gate.test.ts.)
        // Sanity: the walk found the whole app, not an empty tree.
        expect(routes.length).toBeGreaterThan(60);
    });

    it("is refused the routes the middleware otherwise exempts or leaves to the session", () => {
        for (const p of ["/api/views/editorial-content", "/api/llm/guard", "/api/board", "/api/board/sync",
            "/api/cache/invalidate", "/api/notion/patient-journeys", "/api/house/state", "/api/collaborators",
            "/api/review-dashboard/buffer-sweep", "/api/ernesto/directives", "/api/notion/content", "/api/notion/content-needs", "/api/house/state"]) {
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

    it("keeps the Desk and every status move for the admin alone", () => {
        for (const role of ["editor", "social", "viewer"] as const) {
            expect(allowedActs(role, "desk")).toEqual([]);
            expect(allowedActs(role, "website")).toEqual([]);
            expect(mayAct(role, "calendar", "modify")).toBe(false);
        }
    });

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
        expect(allowedActs("social", "calendar").sort()).toEqual(["comment", "ready", "request"]);
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

describe("publish authority", () => {
    it("is JJ's alone today, and nobody's for the gates outside the cockpit", () => {
        expect(PUBLISH_AUTHORITY["social-post"]).toEqual(["admin"]);
        expect(PUBLISH_AUTHORITY["comment-reply"]).toEqual(["admin"]);
        expect(PUBLISH_AUTHORITY["website-page"]).toEqual([]);
        expect(PUBLISH_AUTHORITY.newsletter).toEqual([]);
        expect(mayPublish("social", "social-post")).toBe(false);
        expect(mayPublish(undefined, "social-post")).toBe(false);
    });

    it("drives who may release a social post in the Cancello", () => {
        const widened = { ...PUBLISH_AUTHORITY, "social-post": ["admin", "social"] as const };
        expect(allowedActs("social", "calendar", widened)).toEqual(expect.arrayContaining(["approve", "send", "comment"]));
        expect(allowedActs("viewer", "calendar", widened)).not.toContain("approve");
        const closed = { ...PUBLISH_AUTHORITY, "social-post": [] as const };
        expect(allowedActs("admin", "calendar", closed)).not.toContain("approve");
        expect(allowedActs("admin", "calendar", closed)).not.toContain("send");
        expect(allowedActs("admin", "calendar")).toEqual(expect.arrayContaining(["approve", "send"]));
    });

    it("is frozen against accidental runtime widening", () => {
        expect(Object.isFrozen(PUBLISH_AUTHORITY)).toBe(true);
        for (const roles of Object.values(PUBLISH_AUTHORITY)) expect(Object.isFrozen(roles)).toBe(true);
    });
});

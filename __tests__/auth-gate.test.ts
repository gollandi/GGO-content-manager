// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedOrigins, effectiveRole, gate } from "../lib/auth/gate";

afterEach(() => vi.unstubAllEnvs());
const social = { email: "d@example.com", role: "social" as const, collaborator: true };

describe("the middleware gate, in order", () => {
    it("fences the social role before the machine exemptions", () => {
        expect(gate("/api/views/editorial-content", social)).toEqual({ kind: "forbidden" });
        expect(gate("/api/llm/guard", social)).toEqual({ kind: "forbidden" });
        expect(gate("/api/review-dashboard/buffer-sweep", social)).toEqual({ kind: "forbidden" });
        expect(gate("/api/review-dashboard/state", social)).toEqual({ kind: "next" });
        expect(gate("/questioni", social)).toEqual({ kind: "redirect", to: "/review" });
    });

    it("keeps the exemptions for machine callers without a session", () => {
        expect(gate("/api/views/editorial-content", null)).toEqual({ kind: "next" });
        expect(gate("/api/review-dashboard/buffer-sweep", null)).toEqual({ kind: "next" });
        expect(gate("/review", null)).toEqual({ kind: "login" });
        expect(gate("/api/notion/patient-journeys", null)).toEqual({ kind: "login" });
    });

    it("lets a signed-in collaborator open a reset link", () => {
        expect(gate("/invito", social)).toEqual({ kind: "next" });
        expect(gate("/api/auth-invite/redeem", social)).toEqual({ kind: "next" });
    });

    it("does not let path tricks through the fence", () => {
        for (const p of ["/api/views/", "/review/../questioni", "//api/views", "/api/review-dashboard/state/", "/API/views"]) {
            expect(gate(p, social).kind).not.toBe("next");
        }
    });
});

describe("the role that counts", () => {
    it("recomputes a non-collaborator's role from the environment on every request", () => {
        vi.stubEnv("COCKPIT_USER_EMAIL", "owner@example.com");
        vi.stubEnv("ADMIN_EMAIL", "");
        // A token minted before the deploy, when the owner was a mere viewer.
        expect(effectiveRole({ email: "owner@example.com", role: "viewer" })).toBe("admin");
        // An address no longer named admin loses it at once.
        expect(effectiveRole({ email: "former@example.com", role: "admin" })).toBe("viewer");
    });
    it("takes a collaborator's role from the token (the routes re-check the store)", () => {
        expect(effectiveRole(social)).toBe("social");
    });
});

describe("origins the cockpit accepts writes from", () => {
    it("are the request's own, AUTH_URL's, and the production host whatever the env says", () => {
        expect(allowedOrigins("http://127.0.0.1:3010", { AUTH_URL: "https://cockpit.test/" } as never))
            .toEqual(expect.arrayContaining(["http://127.0.0.1:3010", "https://cockpit.test", "https://cockpit.ggo-suite.co.uk"]));
        expect(allowedOrigins("http://127.0.0.1:3010", {} as never)).toContain("https://cockpit.ggo-suite.co.uk");
    });
});

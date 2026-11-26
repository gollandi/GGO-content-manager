// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import bcryptjs from "bcryptjs";

let dir: string;
let creds: typeof import("../lib/auth/credentials");
let users: typeof import("../lib/auth/users");
let throttle: typeof import("../lib/auth/throttle");
const OWNER_PW = "the owner's long password";
let owners: Record<string, { name: string; hash: string }>;

beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-signin-"));
    vi.stubEnv("COCKPIT_AUTH_DIR", dir);
    vi.stubEnv("COCKPIT_USER_EMAIL", "owner@example.com");
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).__ggoUserStoreQueue;
    delete (globalThis as Record<string, unknown>).__ggoSignInFailures;
    creds = await import("../lib/auth/credentials");
    users = await import("../lib/auth/users");
    throttle = await import("../lib/auth/throttle");
    owners = { "owner@example.com": { name: "JJ", hash: await bcryptjs.hash(OWNER_PW, 4) } };
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

async function collaborator(email = "d@example.com", pw = "a long enough pass") {
    const { token } = await users.inviteUser({ email, name: "Diletta", role: "social", by: "owner@example.com" });
    await users.redeemInvite(token, pw);
}

describe("sign-in", () => {
    it("lets the owner in even when the user store is corrupt", async () => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "users.json"), "{ corrupt");
        const u = await creds.authorizeCredentials({ email: " Owner@Example.com ", password: OWNER_PW }, owners);
        expect(u).toEqual(expect.objectContaining({ email: "owner@example.com", name: "JJ" }));
        expect(u?.collaborator).toBeUndefined();
    });

    it("never throttles the owner, whatever has been tried against the address", async () => {
        for (let i = 0; i < 20; i++) await creds.authorizeCredentials({ email: "owner@example.com", password: "wrong but long enough" }, owners);
        expect(await creds.authorizeCredentials({ email: "owner@example.com", password: OWNER_PW }, owners)).not.toBeNull();
    });

    it("signs a collaborator in with the stored role and the collaborator flag", async () => {
        await collaborator();
        const u = await creds.authorizeCredentials({ email: "d@example.com", password: "a long enough pass" }, owners);
        expect(u).toEqual(expect.objectContaining({ role: "social", collaborator: true, name: "Diletta" }));
    });

    it("throttles a collaborator address, spaces and case included", async () => {
        await collaborator();
        const variants = [" d@example.com", "d@example.com ", "D@EXAMPLE.COM", "d@example.com"];
        for (let i = 0; i < 8; i++) {
            await creds.authorizeCredentials({ email: variants[i % variants.length], password: "wrong but long enough" }, owners);
        }
        expect(await creds.authorizeCredentials({ email: "d@example.com", password: "a long enough pass" }, owners)).toBeNull();
        throttle.resetSignInThrottle();
        expect(await creds.authorizeCredentials({ email: "d@example.com", password: "a long enough pass" }, owners)).not.toBeNull();
    });

    it("refuses non-string input", async () => {
        expect(await creds.authorizeCredentials({ email: ["x"], password: { a: 1 } }, owners)).toBeNull();
    });
});

describe("sign-in timing", () => {
    it("pays one bcrypt comparison for an unknown or switched-off address too", async () => {
        const spy = vi.spyOn(bcryptjs, "compare");
        await users.verifyStoredCredentials("nobody@example.com", "whatever long pass");
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});

describe("Google sign-in admits only known people", () => {
    it("refuses a stranger and admits an active collaborator with the stored role", async () => {
        expect(creds.admitGoogle({ email: "stranger@gmail.com" })).toBe(false);
        await collaborator("d@gmail.com");
        const user: Record<string, unknown> = { email: "D@gmail.com" };
        expect(creds.admitGoogle(user as never)).toBe(true);
        expect(user).toEqual(expect.objectContaining({ role: "social", collaborator: true }));
        expect(creds.admitGoogle({ email: "owner@example.com" })).toBe(true);
    });
    it("refuses a switched-off collaborator", async () => {
        await collaborator("d@gmail.com");
        await users.setDisabled("d@gmail.com", true);
        expect(creds.admitGoogle({ email: "d@gmail.com" })).toBe(false);
    });
});

describe("the sign-in brake stays bounded", () => {
    it("does not evict an address under attack when the map is full", () => {
        for (let i = 0; i < 8; i++) throttle.noteSignInFailure("d@example.com", "192.0.2.9", 1_000_000 + i);
        for (let i = 0; i < 1500; i++) throttle.noteSignInFailure(`x${i}@example.com`, "192.0.2.1", 1_000_100);
        expect(throttle.signInThrottled("d@example.com", "192.0.2.9", 1_000_200)).toBe(true);
    });

    it("tracks at most a thousand addresses", () => {
        for (let i = 0; i < 1500; i++) throttle.noteSignInFailure(`x${i}@example.com`, "192.0.2.1", 1_000_000);
        const map = (globalThis as Record<string, unknown>).__ggoSignInFailures as Map<string, number[]>;
        expect(map.size).toBeLessThanOrEqual(1000);
    });
});

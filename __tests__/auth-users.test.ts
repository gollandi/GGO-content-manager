// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

let dir: string;
let users: typeof import("../lib/auth/users");

beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-auth-"));
    vi.stubEnv("COCKPIT_AUTH_DIR", dir);
    vi.stubEnv("COCKPIT_USER_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).__ggoUserStoreQueue;
    users = await import("../lib/auth/users");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); rmSync(dir, { recursive: true, force: true }); });

const PASSWORD = "a long enough pass";

describe("collaborators — the user store", () => {
    it("invites, lets the invitee set their own password once, then signs them in", async () => {
        const { token, user } = await users.inviteUser({ email: " Diletta@Example.com ", name: "Diletta", role: "social", by: "owner@example.com" });
        expect(user).toEqual(expect.objectContaining({ email: "diletta@example.com", status: "invited", role: "social" }));
        expect(users.describeInvite(token)).toEqual({ email: "diletta@example.com", name: "Diletta" });
        expect(await users.verifyStoredCredentials("diletta@example.com", PASSWORD)).toBeNull();

        await users.redeemInvite(token, PASSWORD);
        expect((await users.verifyStoredCredentials("DILETTA@example.com", PASSWORD))?.role).toBe("social");
        expect(await users.verifyStoredCredentials("diletta@example.com", "a wrong password!")).toBeNull();
        // The link is spent.
        expect(users.describeInvite(token)).toBeNull();
        await expect(users.redeemInvite(token, "another long password")).rejects.toThrow(/not valid/);
    });

    it("stores no token and no password, only their hashes, in a 0600 file", async () => {
        const { token } = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        await users.redeemInvite(token, PASSWORD);
        const file = path.join(dir, "users.json");
        const raw = readFileSync(file, "utf8");
        expect(raw).not.toContain(token);
        expect(raw).not.toContain(PASSWORD);
        expect(statSync(file).mode & 0o777).toBe(0o600);
        expect(JSON.stringify(users.listUsers())).not.toMatch(/hash/i);
    });

    it("refuses an expired link", async () => {
        const { token } = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + users.INVITE_TTL_MS + 1000);
        expect(users.describeInvite(token)).toBeNull();
        await expect(users.redeemInvite(token, PASSWORD)).rejects.toThrow(/not valid/);
    });

    it("never takes the owner's or the admin's address", async () => {
        await expect(users.inviteUser({ email: "OWNER@example.com", name: "x", role: "social", by: "o" })).rejects.toThrow(/owner/);
        await expect(users.inviteUser({ email: "admin@example.com", name: "x", role: "social", by: "o" })).rejects.toThrow(/owner/);
    });

    it("offers only the social role", async () => {
        await expect(users.inviteUser({ email: "e@example.com", name: "E", role: "editor", by: "o" })).rejects.toThrow(/role/i);
    });

    it("enforces the password rules", async () => {
        const { token } = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        await expect(users.redeemInvite(token, "short")).rejects.toThrow(/at least 12/);
        await expect(users.redeemInvite(token, "x".repeat(73))).rejects.toThrow(/at most 72/);
    });

    it("a switched-off collaborator cannot sign in and their standing is revoked", async () => {
        const { token } = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        await users.redeemInvite(token, PASSWORD);
        expect(users.storeStanding("d@example.com")).toEqual({ kind: "active", role: "social", name: "D", houseHandle: null });
        await users.setDisabled("d@example.com", true);
        expect(await users.verifyStoredCredentials("d@example.com", PASSWORD)).toBeNull();
        expect(users.storeStanding("d@example.com")).toEqual({ kind: "revoked" });
        expect(users.storeStanding("nobody@example.com")).toEqual({ kind: "absent" });
    });

    it("a switched-off collaborator stays out after a new link until they use it", async () => {
        const first = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        await users.redeemInvite(first.token, PASSWORD);
        await users.setDisabled("d@example.com", true);
        const second = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        expect(users.storeStanding("d@example.com")).toEqual({ kind: "revoked" });
        expect(await users.verifyStoredCredentials("d@example.com", PASSWORD)).toBeNull();
        await users.redeemInvite(second.token, "the brand new password");
        expect(users.storeStanding("d@example.com").kind).toBe("active");
    });

    it("reserves the owner's signature", async () => {
        for (const name of ["JJ", "jj", " J.J. "]) {
            await expect(users.inviteUser({ email: "x@example.com", name, role: "social", by: "o" })).rejects.toThrow(/reserved/);
        }
    });

    it("a new link resets the password without locking the current one out", async () => {
        const first = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        await users.redeemInvite(first.token, PASSWORD);
        const second = await users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" });
        expect(await users.verifyStoredCredentials("d@example.com", PASSWORD)).not.toBeNull();
        await users.redeemInvite(second.token, "the brand new password");
        expect(await users.verifyStoredCredentials("d@example.com", PASSWORD)).toBeNull();
        expect(await users.verifyStoredCredentials("d@example.com", "the brand new password")).not.toBeNull();
    });

    it("fails loud on a corrupt store, and treats everyone in it as revoked rather than unknown", async () => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "users.json"), "{ not json");
        expect(() => users.listUsers()).toThrow();
        expect(users.storeStanding("d@example.com")).toEqual({ kind: "revoked" });
        await expect(users.inviteUser({ email: "d@example.com", name: "D", role: "social", by: "o" })).rejects.toThrow();
        // The corrupt file is left as it was for a human to inspect.
        expect(readFileSync(path.join(dir, "users.json"), "utf8")).toBe("{ not json");
    });

    it("serialises concurrent writes without losing one", async () => {
        await Promise.all(["a", "b", "c", "d", "e"].map((n) =>
            users.inviteUser({ email: `${n}@example.com`, name: n, role: "social", by: "o" })));
        expect(users.listUsers().map((u) => u.email).sort()).toEqual(
            ["a", "b", "c", "d", "e"].map((n) => `${n}@example.com`));
    });
});

describe("a collaborator's name on the house board", () => {
    it("is set by the owner from the house roster, unique, and can be taken away", async () => {
        await users.inviteUser({ email: "d@example.com", name: "Greta", role: "social", by: "o" });
        await users.inviteUser({ email: "e@example.com", name: "E", role: "social", by: "o" });
        expect(users.listUsers()[0].houseHandle).toBeNull();
        await expect(users.setHouseHandle("d@example.com", "greta", ["diletta"])).rejects.toThrow(/not on the house/);
        const set = await users.setHouseHandle("d@example.com", " Diletta ", ["diletta"]);
        expect(set.houseHandle).toBe("diletta");
        await expect(users.setHouseHandle("e@example.com", "diletta", ["diletta"])).rejects.toThrow(/another collaborator/);
        expect((await users.setHouseHandle("d@example.com", null, ["diletta"])).houseHandle).toBeNull();
        await expect(users.setHouseHandle("nobody@example.com", "diletta", ["diletta"])).rejects.toThrow(/No such/);
    });
});

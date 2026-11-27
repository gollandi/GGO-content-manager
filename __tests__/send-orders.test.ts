// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;
let orders: typeof import("../lib/cancello/send-orders");

beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ggo-orders-"));
    vi.stubEnv("COCKPIT_AUTH_DIR", dir);
    vi.resetModules();
    orders = await import("../lib/cancello/send-orders");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe("JJ's send orders", () => {
    it("records, finds (with or without dashes) and withdraws an order, in a 0600 file", () => {
        orders.recordSendOrder("abc-123", "owner@example.com", new Date("2026-11-27T10:00:00Z"));
        expect(orders.hasSendOrder("abc123")).toBe(true);
        expect(statSync(path.join(dir, "send-orders.json")).mode & 0o777).toBe(0o600);
        orders.recordSendOrder("abc123", "owner@example.com");
        expect(orders.sendOrderIds().size).toBe(1);
        orders.withdrawSendOrder("ABC-123");
        expect(orders.hasSendOrder("abc-123")).toBe(false);
    });

    it("starts empty: approvals from before the store existed authorise nothing", () => {
        expect(orders.sendOrderIds().size).toBe(0);
    });

    it("fails loud on a corrupt store instead of treating it as empty", () => {
        writeFileSync(path.join(dir, "send-orders.json"), "{\"version\":2}");
        expect(() => orders.sendOrderIds()).toThrow(/not a version-1 store/);
    });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Drafts-only trip-wire (spec §0.0 decision 4): La Casa di Ernesto writes
 * drafts.* to gxyjgvr0 and NOTHING else. Publishing is JJ's gate.
 * If this fails, remove the offending write path — do not weaken the test.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("drafts-only write boundary", () => {
    it("write client refuses ids outside drafts.*", async () => {
        process.env.SANITY_GGOMED_WRITE_TOKEN ||= "test-token";
        const { createDraft, patchDraft, NonDraftWriteError } = await import(
            "../lib/sanity/write-client"
        );
        await expect(
            createDraft({ _id: "dedicatedPage-live", _type: "dedicatedPage" })
        ).rejects.toBeInstanceOf(NonDraftWriteError);
        await expect(patchDraft("someDoc", {})).rejects.toBeInstanceOf(NonDraftWriteError);
    });

    it("runner generates only drafts.* ids", () => {
        const tools = read("lib/runner/tools.ts");
        expect(tools).toContain("`drafts.cockpit-${randomUUID()}`");
    });

    it("no publish/delete API anywhere in the runner or write client", () => {
        for (const file of [
            "lib/sanity/write-client.ts",
            "lib/runner/tools.ts",
            "lib/runner/run.ts",
        ]) {
            const text = read(file);
            for (const forbidden of [".delete(", ".createOrReplace({_id: doc._id.replace", "publishAction", '"publish"', ".action("]) {
                expect(text.includes(forbidden), `${file} must not contain ${forbidden}`).toBe(false);
            }
        }
    });

    it("m05ykm6e (Patient-Compass) has no write path", () => {
        // The write client must be wired to the GGOMed write config only.
        const writeClient = read("lib/sanity/write-client.ts");
        expect(writeClient).toContain("sanityGgomedWriteConfig");
        expect(writeClient.includes("sanityCompassConfig")).toBe(false);
        expect(writeClient.includes("SANITY_M05")).toBe(false);
        // The only m05 client in the app is the read-only PIF slice client.
        const clients = read("lib/sanity/clients.ts");
        expect(clients).toContain("compassPifClient");
        expect(clients.includes("SANITY_M05_WRITE")).toBe(false);
    });
});

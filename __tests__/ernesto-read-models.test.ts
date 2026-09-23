import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The read models added for the stall recovery (plan Phase 1) — the morning
 * brief and the house pulse — distribute state that the house's jobs own.
 * They must stay GET-only and must never reach for a Notion write call:
 * a brief the cockpit could edit would no longer be the night's account.
 */

const ROOT = join(__dirname, "..");
const READ_MODELS = [
    "app/api/ernesto/brief/route.ts",
    "app/api/house/state/route.ts",
    "lib/house/state.ts",
    "lib/notion/brief.ts",
];
const WRITE_TOKENS = [
    ".pages.create(",
    ".pages.update(",
    ".blocks.children.append(",
    ".databases.update(",
    ".databases.create(",
];

describe("Ernesto read models stay read-only", () => {
    for (const rel of READ_MODELS) {
        const src = readFileSync(join(ROOT, rel), "utf8");
        it(`${rel} holds no Notion write call`, () => {
            for (const token of WRITE_TOKENS) expect(src.includes(token), token).toBe(false);
        });
        if (rel.startsWith("app/api/")) {
            it(`${rel} exports GET only`, () => {
                const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
                expect(handlers).toEqual(["GET"]);
            });
        }
    }
});

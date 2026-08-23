import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Sibilla independence-by-construction trip-wire — the same guarantee the
 * ambrogio-no-write test makes, for the other oversight register.
 *
 * The sibilla-la-veggente SKILL (via ernesto-agents-house's
 * content-quality-audit-writer) is the sole writer of 🩺 Content Quality
 * Audits. The Shell reads her verdicts on published pages and must never
 * gain a path to write, amend or retract one: a post-publication judgement
 * the audited house can edit is worth nothing.
 *
 * If this test fails, someone has added a write path — do not "fix" the
 * test; remove the write path.
 */

const ROOT = join(__dirname, "..");
const SOURCE_DIRS = ["app", "lib", "components"];
const WRITE_TOKENS = [
    ".pages.create(",
    ".pages.update(",
    ".blocks.children.append(",
    ".databases.update(",
    ".databases.create(",
];
const SIBILLA_ENV_ID = "NOTION_CONTENT_QUALITY_AUDITS_DB";

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
        else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
}

const allSources = SOURCE_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)));

describe("Sibilla's register is read-only in the Shell", () => {
    it("no source file that touches the Content Quality Audits DB contains a Notion write call", () => {
        const offenders: string[] = [];
        for (const file of allSources) {
            const text = readFileSync(file, "utf8");
            // Real DB-access tokens only — a prose mention of "Sibilla" in a
            // comment is not a DB touch (the guarantee is about code paths).
            const touchesSibilla =
                text.includes(SIBILLA_ENV_ID) ||
                text.includes("contentQualityAudits") ||
                text.includes("getContentQualityAudits");
            if (!touchesSibilla) continue;
            for (const token of WRITE_TOKENS) {
                if (text.includes(token)) {
                    offenders.push(`${relative(ROOT, file)} → ${token}`);
                }
            }
        }
        expect(offenders, `Write path targeting Sibilla's register:\n${offenders.join("\n")}`).toEqual([]);
    });

    it("the Sibilla env id is wired only in config, never in write helpers", () => {
        const offenders: string[] = [];
        for (const file of allSources) {
            const rel = relative(ROOT, file);
            if (rel === "lib/config.ts") continue; // read wiring lives here
            const text = readFileSync(file, "utf8");
            if (text.includes(`process.env.${SIBILLA_ENV_ID}`)) offenders.push(rel);
        }
        expect(offenders, `Direct Sibilla env access outside lib/config.ts: ${offenders.join(", ")}`).toEqual([]);
    });
});

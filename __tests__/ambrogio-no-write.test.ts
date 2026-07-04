import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Ambrogio independence-by-construction trip-wire (spec §3 Module 4, R12).
 *
 * The ambrogio-il-maggiordomo SKILL is the sole writer of the two Ambrogio
 * Notion DBs. The Shell must expose ZERO create/update/append path to them,
 * and the editorial read layer must hold no Notion write call at all.
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
const AMBROGIO_ENV_IDS = [
    "NOTION_AMBROGIO_AUDITS_DB",
    "NOTION_AMBROGIO_PROPOSALS_DB",
];

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

describe("Ambrogio DBs are read-only in the Shell", () => {
    it("no source file that touches an Ambrogio DB id contains a Notion write call", () => {
        const offenders: string[] = [];
        for (const file of allSources) {
            const text = readFileSync(file, "utf8");
            // Real DB-access tokens only — a prose mention of "Ambrogio" in a
            // comment is not a DB touch (the guarantee is about code paths).
            const touchesAmbrogio =
                AMBROGIO_ENV_IDS.some((id) => text.includes(id)) ||
                text.includes("ambrogioAudits") ||
                text.includes("ambrogioProposals") ||
                text.includes("getAmbrogio");
            if (!touchesAmbrogio) continue;
            for (const token of WRITE_TOKENS) {
                if (text.includes(token)) {
                    offenders.push(`${relative(ROOT, file)} → ${token}`);
                }
            }
        }
        expect(offenders, `Write path targeting Ambrogio surface:\n${offenders.join("\n")}`).toEqual([]);
    });

    it("the editorial read layer holds no Notion write call at all", () => {
        const text = readFileSync(join(ROOT, "lib/notion/editorial.ts"), "utf8");
        for (const token of WRITE_TOKENS) {
            expect(text.includes(token), `editorial.ts must stay read-only (found ${token})`).toBe(false);
        }
    });

    it("Ambrogio env ids are wired only in config, never in write helpers", () => {
        const offenders: string[] = [];
        for (const file of allSources) {
            const rel = relative(ROOT, file);
            if (rel === "lib/config.ts") continue; // read wiring lives here
            const text = readFileSync(file, "utf8");
            if (AMBROGIO_ENV_IDS.some((id) => text.includes(`process.env.${id}`))) {
                offenders.push(rel);
            }
        }
        expect(offenders, `Direct Ambrogio env access outside lib/config.ts: ${offenders.join(", ")}`).toEqual([]);
    });
});

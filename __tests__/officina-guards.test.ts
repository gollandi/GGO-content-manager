// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathAllowed } from "../lib/retro/edit-policy";

/**
 * L'Officina è autonoma fino alla PR — ma i suoi rail sono costituzionali:
 * allowlist della conoscenza editoriale, worktree isolato, MAI merge.
 * Se questo test fallisce, rimuovi la capacità, non il test.
 */

const SRC = readFileSync(join(__dirname, "../lib/retro/officina.ts"), "utf8");

describe("Officina constitutional rails", () => {
    it("edits are allowlisted to editorial knowledge only", () => {
        expect(pathAllowed("skills/ggomed-page-writer-v2/SKILL.md")).toBe(true);
        expect(pathAllowed("skills/ggomed-page-writer-v2/references/parser-patterns.md")).toBe(true);
        expect(pathAllowed("lib/runner/shape.ts")).toBe(true);
        expect(pathAllowed("lib/runner/run.ts")).toBe(false);
        expect(pathAllowed("lib/sanity/write-client.ts")).toBe(false);
        expect(SRC).toContain("pathAllowed(");
    });

    it("never merges and never pushes to main", () => {
        for (const forbidden of ['"merge"', '"push", "-u", "origin", "main"', "pr merge", "--admin"]) {
            expect(SRC.includes(forbidden), `officina must not contain ${forbidden}`).toBe(false);
        }
        // push only of the soffitta branch, from the worktree
        expect(SRC).toContain('["push", "-u", "origin", branch]');
    });

    it("works only in an isolated worktree, never the live tree", () => {
        expect(SRC).toContain('"worktree", "add"');
        // every file write goes through the worktree path
        const writes = SRC.match(/writeFileSync\(([^,]+),/g) ?? [];
        const badWrites = writes.filter((w) => !w.includes("full") && !w.includes("reportPath"));
        expect(badWrites, `unexpected write targets: ${badWrites.join(", ")}`).toEqual([]);
        expect(SRC).toContain("join(wt, e.file)");
    });

    it("constitutional files are NOT in the allowlist", () => {
        const forbidden = [
            "lib/sanity/write-client.ts",
            "lib/notion/social-write.ts",
            "lib/notion/desk-write.ts",
            "lib/notion/impact-write.ts",
            "lib/runner/tools.ts",
            "lib/runner/run.ts",
            "lib/auth/config.ts",
            "middleware.ts",
            "lib/config.ts",
        ];
        for (const f of forbidden) {
            expect(pathAllowed(f), `${f} must NOT be editable`).toBe(false);
        }
        expect(pathAllowed("skills/ggomed-page-writer-v2/SKILL.md")).toBe(true);
        expect(pathAllowed("lib/runner/shape.ts")).toBe(true);
    });
});

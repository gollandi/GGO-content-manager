// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * The Cockpit checks JJ's board writes with a verbatim copy of the house's
 * own writer. These tests stop the two copies drifting silently: a local
 * edit fails the hash pin, and a change upstream fails the comparison with
 * the house checkout whenever one is present (JJ's Mac; CI has none).
 */

const vendorDir = path.join(__dirname, "../lib/board/vendor");
const source = JSON.parse(readFileSync(path.join(vendorDir, "SOURCE.json"), "utf8")) as {
    commit: string;
    files: Record<string, string>;
};
const sha256 = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");

const house = path.resolve(process.env.HOUSE_REPO ?? path.join(homedir(), "Developer/GitHub/ernesto-agents-house"));
const houseRef = process.env.HOUSE_REF ?? "origin/main";
const housePresent = existsSync(path.join(house, ".git"));

function upstream(file: string): string | null {
    try {
        return execFileSync("git", ["-C", house, "show", `${houseRef}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
        return null;
    }
}

describe("vendored house writer", () => {
    it.each(Object.entries(source.files))("%s matches its pinned hash", (file, hash) => {
        expect(sha256(readFileSync(path.join(vendorDir, file))), "never edit the vendored copy — run tools/board/sync-vendor.mjs").toBe(hash);
    });

    it.skipIf(!housePresent).each(Object.keys(source.files))(`%s matches ernesto-agents-house ${houseRef}`, (file) => {
        const content = upstream(file);
        expect(content, `${file} is missing at ${houseRef} in ${house}`).not.toBeNull();
        expect(sha256(content as string), "the house writer changed upstream — run node tools/board/sync-vendor.mjs and review").toBe(source.files[file]);
    });
});

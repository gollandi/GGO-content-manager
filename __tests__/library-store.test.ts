// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LIBRARY, libraryDir, mayReadLibrary, readDocument } from "../lib/library/store";

describe("the library", () => {
    let dir: string;
    const saved = { lib: process.env.COCKPIT_LIBRARY_DIR, snap: process.env.COCKPIT_SNAPSHOT_DIR };

    beforeEach(() => {
        dir = mkdtempSync(path.join(os.tmpdir(), "library-"));
        process.env.COCKPIT_LIBRARY_DIR = dir;
    });
    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
        if (saved.lib === undefined) delete process.env.COCKPIT_LIBRARY_DIR; else process.env.COCKPIT_LIBRARY_DIR = saved.lib;
        if (saved.snap === undefined) delete process.env.COCKPIT_SNAPSHOT_DIR; else process.env.COCKPIT_SNAPSHOT_DIR = saved.snap;
    });

    it("sits beside the auth store, outside the deploy tree", () => {
        delete process.env.COCKPIT_LIBRARY_DIR;
        process.env.COCKPIT_SNAPSHOT_DIR = "/var/lib/ggo-cockpit";
        expect(libraryDir()).toBe("/var/lib/ggo-cockpit/library");
    });

    it("returns a listed document that is on the server", () => {
        writeFileSync(path.join(dir, LIBRARY["social-media-guide"].file), "<!doctype html><title>guide</title>");
        const read = readDocument("social-media-guide");
        expect(read.kind).toBe("ok");
        if (read.kind === "ok") {
            expect(read.body.toString()).toContain("guide");
            expect(read.document.contentType).toMatch(/^text\/html/);
        }
    });

    it("says a listed document is missing rather than failing", () => {
        expect(readDocument("social-media-guide.pdf").kind).toBe("missing");
    });

    it("knows only the ids in its table, whatever file is in the folder", () => {
        writeFileSync(path.join(dir, "secret.txt"), "x");
        for (const id of ["secret.txt", "../auth/users.json", "..", "", "constructor", "toString", "__proto__"]) {
            expect(readDocument(id).kind).toBe("unknown");
        }
    });

    it("is for the people who work on the content, not for a viewer", () => {
        expect(["admin", "editor", "social"].map((r) => mayReadLibrary(r as never))).toEqual([true, true, true]);
        expect(mayReadLibrary("viewer")).toBe(false);
        expect(mayReadLibrary(undefined)).toBe(false);
    });

    it("lists file names with no path in them", () => {
        for (const d of Object.values(LIBRARY)) expect(d.file).toBe(path.basename(d.file));
    });
});

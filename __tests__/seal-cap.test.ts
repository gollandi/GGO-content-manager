// @vitest-environment node
import { describe, it, expect } from "vitest";
import { capForSeal, needsNewDate, SEAL_CAP } from "../lib/house/families";

describe("capForSeal", () => {
    it("shows five, urgent desk and patches first, stale posts last", () => {
        const entries = [
            // dueDays is days since the slot: positive once it has passed.
            { id: "stale", family: "Social", dueDays: 30 },
            { id: "soon", family: "Social", dueDays: -1 },
            { id: "later", family: "Social", dueDays: -9 },
            { id: "desk", family: "Desk", dueDays: null, priority: "Normal" },
            { id: "urgent", family: "Desk", dueDays: null, priority: "Urgent" },
            { id: "patch", family: "Website", dueDays: null },
            { id: "stale2", family: "Social", dueDays: 2 },
        ];
        const { shown, held } = capForSeal(entries);
        expect(SEAL_CAP).toBe(5);
        expect(shown.map((e) => e.id)).toEqual(["urgent", "patch", "soon", "later", "desk"]);
        expect(held.map((e) => e.id)).toEqual(["stale", "stale2"]);
    });

    it("holds nothing when the register is already short", () => {
        const { shown, held } = capForSeal([{ family: "Social", dueDays: 0 }]);
        expect(shown).toHaveLength(1);
        expect(held).toHaveLength(0);
    });
});

describe("needsNewDate", () => {
    const now = new Date(2026, 10, 27, 15, 0); // 27 Nov 2026, 15:00 local
    it("asks for a new date when the day has passed, unless JJ typed one from today on", () => {
        expect(needsNewDate({ proposed: "2026-11-20", planned: "", now })).toBe(true);
        expect(needsNewDate({ proposed: "2026-11-20", planned: "2026-11-20", now })).toBe(true);
        expect(needsNewDate({ proposed: "2026-11-20", planned: "2026-11-28", now })).toBe(false);
    });
    it("catches a date JJ moves into the past on an upcoming post", () => {
        expect(needsNewDate({ proposed: "2026-12-01", planned: "2026-11-01", now })).toBe(true);
    });
    it("catches a slot earlier today, and lets a later one or a date-only today through", () => {
        expect(needsNewDate({ proposed: new Date(2026, 10, 27, 9, 0).toISOString(), planned: "", now })).toBe(true);
        expect(needsNewDate({ proposed: new Date(2026, 10, 27, 18, 0).toISOString(), planned: "", now })).toBe(false);
        expect(needsNewDate({ proposed: "2026-11-27", planned: "", now })).toBe(false);
        expect(needsNewDate({ proposed: null, planned: "", now })).toBe(false);
    });
});

import { staleOperations } from "../lib/cancello/patches";
describe("staleOperations", () => {
    const doc = { content: [{ _type: "block", _key: "k1", children: [{ text: "Current paragraph JJ revised." }] }] };
    const base = { id: "p", sanityDocId: "d", batch: "b", file: "f" };
    it("counts an anchor the page no longer has", () => {
        expect(staleOperations(doc, { ...base, operations: [{ type: "replace-text", anchorText: "Old paragraph.", newText: "New." }] })).toBe(1);
    });
    it("does not count an anchor still present, or an operation already applied", () => {
        expect(staleOperations(doc, { ...base, operations: [
            { type: "replace-text", anchorText: "Current paragraph JJ revised.", newText: "Fix." },
            { type: "replace-text", anchorText: "Gone.", newText: "Current paragraph JJ revised." },
        ] })).toBe(0);
    });
});

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPatches } from "../lib/cancello/patches";
describe("loadPatches", () => {
    it("skips a settled patch", () => {
        const root = mkdtempSync(join(tmpdir(), "patches-"));
        mkdirSync(join(root, "b1"));
        const op = [{ type: "replace-text", anchorText: "a", newText: "b" }];
        writeFileSync(join(root, "b1", "01.json"), JSON.stringify({ id: "open", sanityDocId: "x", operations: op }));
        writeFileSync(join(root, "b1", "02.json"), JSON.stringify({ id: "done", sanityDocId: "y", operations: op, settled: { on: "2026-11-27" } }));
        expect(loadPatches(root).map((p) => p.id)).toEqual(["open"]);
    });
});

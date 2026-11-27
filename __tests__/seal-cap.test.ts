// @vitest-environment node
import { describe, it, expect } from "vitest";
import { capForSeal, SEAL_CAP } from "../lib/house/families";

describe("capForSeal", () => {
    it("shows five, urgent desk and patches first, stale posts last", () => {
        const entries = [
            { id: "stale", family: "Social", dueDays: -30 },
            { id: "soon", family: "Social", dueDays: 1 },
            { id: "later", family: "Social", dueDays: 9 },
            { id: "desk", family: "Desk", dueDays: null, priority: "Normal" },
            { id: "urgent", family: "Desk", dueDays: null, priority: "Urgent" },
            { id: "patch", family: "Website", dueDays: null },
            { id: "stale2", family: "Social", dueDays: -2 },
        ];
        const { shown, held } = capForSeal(entries);
        expect(SEAL_CAP).toBe(5);
        expect(shown.map((e) => e.id)).toEqual(["urgent", "patch", "soon", "later", "desk"]);
        expect(held.map((e) => e.id)).toEqual(["stale2", "stale"]);
    });

    it("holds nothing when the register is already short", () => {
        const { shown, held } = capForSeal([{ family: "Social", dueDays: 0 }]);
        expect(shown).toHaveLength(1);
        expect(held).toHaveLength(0);
    });
});

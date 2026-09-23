// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieve, update } = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));

vi.mock("../lib/notion/client", () => ({
    notion: { pages: { retrieve, update, create: vi.fn() } },
}));
vi.mock("../lib/config", () => ({
    notionConfig: {
        dbs: {
            ernestoDesk: () => "desk-db",
            contentCalendar: () => "calendar-db",
        },
    },
}));
vi.mock("../lib/cancello/patches", () => ({ findPatchForAsset: vi.fn(() => null) }));
vi.mock("../lib/cancello/house", () => ({ kickstartJob: vi.fn(), runHouseScript: vi.fn() }));
vi.mock("../lib/cancello/state", () => ({ invalidateCancelloCache: vi.fn() }));

import { applyCancelloDecision } from "../lib/cancello/decision";

describe("Cancello decisions", () => {
    beforeEach(() => {
        retrieve.mockReset();
        update.mockReset();
        update.mockResolvedValue({});
    });

    it("deletes a Desk proposal by archiving its Notion page and keeps an optional reason", async () => {
        retrieve.mockResolvedValue({ parent: { type: "database_id", database_id: "desk-db" } });

        const result = await applyCancelloDecision({
            rowId: "desk-row",
            target: "desk",
            decision: "delete",
            comment: "Duplicato",
        });

        expect(result).toEqual(expect.objectContaining({ status: "Deleted", archived: true }));
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            page_id: "desk-row",
            archived: true,
            properties: {
                Correction: { rich_text: [{ text: { content: "Duplicato" } }] },
            },
        }));
    });

    it("allows deletion without a reason", async () => {
        retrieve.mockResolvedValue({ parent: { type: "database_id", database_id: "calendar-db" } });

        await applyCancelloDecision({ rowId: "calendar-row", target: "calendar", decision: "delete" });

        expect(update).toHaveBeenCalledWith({ page_id: "calendar-row", archived: true });
    });

    it("refuses to archive a row outside the declared target database", async () => {
        retrieve.mockResolvedValue({ parent: { type: "database_id", database_id: "different-db" } });

        await expect(applyCancelloDecision({
            rowId: "wrong-row",
            target: "desk",
            decision: "delete",
        })).rejects.toThrow(/not a desk proposal/);

        expect(update).not.toHaveBeenCalled();
    });

    it("marks calendar work completed elsewhere as Archived", async () => {
        const result = await applyCancelloDecision({
            rowId: "calendar-row",
            target: "calendar",
            decision: "done",
            comment: "Already posted manually",
        });

        expect(result.status).toBe("Archived");
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            page_id: "calendar-row",
            properties: expect.objectContaining({ Status: { select: { name: "Archived" } } }),
        }));
    });
});

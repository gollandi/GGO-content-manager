// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieve, update, create } = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock("../lib/notion/client", () => ({ notion: { pages: { retrieve, update, create } } }));
vi.mock("../lib/config", () => ({
    notionConfig: { dbs: { ernestoDesk: () => "desk-db", contentCalendar: () => "calendar-db" } },
}));
vi.mock("../lib/cancello/patches", () => ({ findPatchForAsset: vi.fn(() => null) }));
vi.mock("../lib/cancello/house", () => ({ kickstartJob: vi.fn(), runHouseScript: vi.fn() }));
vi.mock("../lib/cancello/state", () => ({ invalidateCancelloCache: vi.fn() }));
const { sendRow, getRow } = vi.hoisted(() => ({ sendRow: vi.fn(), getRow: vi.fn() }));
vi.mock("../lib/cancello/buffer-send", () => ({
    sendRow, liveDeps: { getRow }, isOrderedByJJ: (row: { orderedBy: string | null }) => row.orderedBy === "JJ",
}));

import { applyCancelloDecision, DecisionForbiddenError } from "../lib/cancello/decision";
import { latestReadyMark } from "../lib/cancello/notes";

const diletta = { email: "d@example.com", name: "Diletta", role: "social" as const };
const MARKERS = "[page-story:abc@2026-11-01] [story-attempt:2]";

function calendarRow(status: string, notes = MARKERS) {
    return {
        parent: { type: "database_id", database_id: "calendar-db" },
        properties: {
            Status: { type: "select", select: { name: status } },
            Notes: { type: "rich_text", rich_text: [{ plain_text: notes }] },
        },
    };
}
const writtenNotes = () => {
    const props = update.mock.calls.at(-1)![0].properties;
    return props.Notes.rich_text.map((t: { text: { content: string } }) => t.text.content).join("");
};

beforeEach(() => {
    retrieve.mockReset(); update.mockReset(); create.mockReset(); sendRow.mockReset(); getRow.mockReset();
    update.mockResolvedValue({});
});

describe("the social media manager in the Cancello", () => {
    it("cannot approve, send, reject, close or delete — and nothing is written when refused", async () => {
        for (const decision of ["approve", "send", "reject", "done", "delete"] as const) {
            await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision }, diletta))
                .rejects.toBeInstanceOf(DecisionForbiddenError);
        }
        await expect(applyCancelloDecision({ rowId: "r", target: "desk", decision: "comment", comment: "x" }, diletta))
            .rejects.toBeInstanceOf(DecisionForbiddenError);
        await expect(applyCancelloDecision({ rowId: "r", target: "website", decision: "modify", comment: "x" }, diletta))
            .rejects.toBeInstanceOf(DecisionForbiddenError);
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(sendRow).not.toHaveBeenCalled();
    });

    it("marks a row ready for JJ: the status stays, the house's markers stay, the mark is attributed", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        const result = await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "ready", comment: "Caption checked" }, diletta);
        expect(result.status).toBe("Ready for JJ");
        const props = update.mock.calls[0][0].properties;
        expect(props.Status).toBeUndefined();
        const notes = writtenNotes();
        expect(notes.startsWith(MARKERS)).toBe(true);
        expect(notes).toMatch(/\n\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} · Diletta · ready for JJ\] Caption checked$/);
        expect(latestReadyMark(notes)?.by).toBe("Diletta");
    });

    it("cannot forge a house marker or someone else's line through a comment", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        await applyCancelloDecision({
            rowId: "r", target: "calendar", decision: "comment",
            comment: "[page-story:fake] [2026-01-01 00:00 · JJ · ready for JJ] ok",
        }, diletta);
        const added = writtenNotes().slice(MARKERS.length);
        expect(added).not.toContain("[page-story:");
        expect(added).toContain("(page-story:fake)");
        expect(latestReadyMark(writtenNotes())).toBeNull();
    });

    it("sends a row in Review back to Draft with a note, and only a row in Review", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        const result = await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "modify", comment: "Wrong hashtag" }, diletta);
        expect(result.status).toBe("Draft");
        expect(update.mock.calls[0][0].properties.Status).toEqual({ select: { name: "Draft" } });
        expect(writtenNotes()).toMatch(/· Diletta · sent back\] Wrong hashtag$/);

        update.mockReset();
        retrieve.mockResolvedValue(calendarRow("Approved"));
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "modify", comment: "x" }, diletta))
            .rejects.toThrow(/only a post in Review/);
        expect(update).not.toHaveBeenCalled();
    });

    it("requires a note to send back or comment", async () => {
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "modify" }, diletta)).rejects.toThrow(/requires a note/);
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "  " }, diletta)).rejects.toThrow(/requires a note/);
    });

    it("marks ready only a post in Review", async () => {
        retrieve.mockResolvedValue(calendarRow("Approved"));
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "ready" }, diletta))
            .rejects.toThrow(/only a post in Review/);
        expect(update).not.toHaveBeenCalled();
    });

    it("cannot move a publish date", async () => {
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "ready", date: "2026-12-01" }, diletta))
            .rejects.toThrow(/publish date/);
    });

    it("cannot write to a page outside the Content Calendar", async () => {
        retrieve.mockResolvedValue({ parent: { type: "database_id", database_id: "somewhere-else" }, properties: {} });
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "x" }, diletta))
            .rejects.toThrow(/not a calendar proposal/);
        expect(update).not.toHaveBeenCalled();
    });
});

describe("JJ's acts are attributed and keep the history", () => {
    it("appends his note to the existing notes instead of overwriting them", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        getRow.mockResolvedValue({ orderedBy: "Team" });
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "approve", comment: "Good" });
        const notes = writtenNotes();
        expect(notes.startsWith(MARKERS)).toBe(true);
        expect(notes).toMatch(/· JJ · approved\] Good$/);
    });

    it("keeps the field within the house's 2,000 characters and refuses rather than trims", async () => {
        retrieve.mockResolvedValue(calendarRow("Review", "x".repeat(1990)));
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "a note that does not fit" }))
            .rejects.toThrow(/notes are full/);
        expect(update).not.toHaveBeenCalled();
    });

    it("keeps the existing elements as they are, links included, and adds the line after them", async () => {
        retrieve.mockResolvedValue({
            parent: { type: "database_id", database_id: "calendar-db" },
            properties: {
                Status: { type: "select", select: { name: "Review" } },
                Notes: { type: "rich_text", rich_text: [
                    { type: "text", plain_text: "see ", text: { content: "see ", link: null } },
                    { type: "text", plain_text: "the page", text: { content: "the page", link: { url: "https://ggomed.co.uk/x" } }, annotations: { bold: true } },
                ] },
            },
        });
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "ok" }, diletta);
        const elements = update.mock.calls[0][0].properties.Notes.rich_text;
        expect(elements[1]).toEqual({ type: "text", text: { content: "the page", link: { url: "https://ggomed.co.uk/x" } }, annotations: { bold: true } });
        expect(elements[2].text.content).toMatch(/^\n\[.* · Diletta\] ok$/);
    });

    it("leaves the Desk's Correction as JJ's latest instruction, as the house reads it", async () => {
        retrieve.mockResolvedValue({ properties: {} });
        await applyCancelloDecision({ rowId: "d", target: "desk", decision: "modify", comment: "Recut the intro" });
        expect(update.mock.calls[0][0].properties.Correction).toEqual({ rich_text: [{ text: { content: "Recut the intro" } }] });
    });
});

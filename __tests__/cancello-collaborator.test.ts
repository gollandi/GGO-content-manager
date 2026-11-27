// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieve, update, create } = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn(), create: vi.fn() }));
const { recordSendOrder, withdrawSendOrder } = vi.hoisted(() => ({ recordSendOrder: vi.fn(), withdrawSendOrder: vi.fn() }));
vi.mock("../lib/cancello/send-orders", () => ({
    recordSendOrder, withdrawSendOrder, sendOrderIds: () => new Set<string>(), sendOrderKey: (id: string) => id.replace(/-/g, "").toLowerCase(),
}));
vi.mock("../lib/notion/client", () => ({ notion: { pages: { retrieve, update, create } } }));
vi.mock("../lib/config", () => ({
    notionConfig: { dbs: { ernestoDesk: () => "desk-db", contentCalendar: () => "calendar-db" } },
}));
vi.mock("../lib/cancello/patches", () => ({ findPatchForAsset: vi.fn(() => null) }));
vi.mock("../lib/cancello/house", () => ({ kickstartJob: vi.fn(), runHouseScript: vi.fn() }));
vi.mock("../lib/cancello/state", () => ({ invalidateCancelloCache: vi.fn() }));
const { sendRow, getRow, fetchDocs } = vi.hoisted(() => ({ sendRow: vi.fn(), getRow: vi.fn(), fetchDocs: vi.fn() }));
vi.mock("../lib/cancello/buffer-send", () => ({
    sendRow, liveDeps: { getRow, fetchDocs }, isOrderedByJJ: (row: { orderedBy: string | null }) => row.orderedBy === "JJ",
    alreadySent: (d: { status?: string; buffer?: { postId?: string; status?: string } } | undefined) =>
        Boolean(d) && (d!.status === "published" || (Boolean(d!.buffer?.postId) && d!.buffer?.status !== "failed")),
}));

import { applyCancelloDecision, DecisionForbiddenError, OWNER } from "../lib/cancello/decision";
import { latestMark, latestReadyMark } from "../lib/cancello/notes";

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
    sendRow.mockResolvedValue({ outcome: "awaiting-staging", posts: [] });
    recordSendOrder.mockReset(); withdrawSendOrder.mockReset();
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

    it("requests changes with a note and never moves the status — Review to Draft stays JJ's", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        const result = await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "request", comment: "Wrong hashtag" }, diletta);
        expect(result.status).toBe("Changes requested");
        expect(update.mock.calls[0][0].properties.Status).toBeUndefined();
        expect(writtenNotes()).toMatch(/· Diletta · changes requested\] Wrong hashtag$/);
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "modify", comment: "x" }, diletta))
            .rejects.toBeInstanceOf(DecisionForbiddenError);
    });

    it("acts only on a post in Review", async () => {
        for (const decision of ["comment", "ready", "request"] as const) {
            update.mockReset();
            retrieve.mockResolvedValue(calendarRow("Approved"));
            await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision, comment: "x" }, diletta))
                .rejects.toThrow(/only a post in Review/);
            expect(update).not.toHaveBeenCalled();
        }
    });

    it("requires a note to request changes or comment", async () => {
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "request" }, diletta)).rejects.toThrow(/requires a note/);
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "  " }, diletta)).rejects.toThrow(/requires a note/);
    });

    it("keeps each act on one line", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "ok\n(2026-11-26 16:40 · JJ · approved) go" }, diletta);
        expect(writtenNotes().slice(MARKERS.length + 1)).not.toContain("\n");
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
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "approve", comment: "Good" }, OWNER);
        const notes = writtenNotes();
        expect(notes.startsWith(MARKERS)).toBe(true);
        expect(notes).toMatch(/· JJ · approved\] Good$/);
    });

    it("leaves the house room: a collaborator's note that would pass 1,600 characters is refused", async () => {
        retrieve.mockResolvedValue(calendarRow("Review", "x".repeat(1590)));
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "comment", comment: "a note that does not fit" }, diletta))
            .rejects.toThrow(/notes are full/);
        expect(update).not.toHaveBeenCalled();
    });

    it("never lets a full notes field stop JJ's decision: the status flips and the skipped note is reported", async () => {
        retrieve.mockResolvedValue(calendarRow("Review", "x".repeat(1590)));
        getRow.mockResolvedValue({ orderedBy: "Team" });
        const result = await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "approve", comment: "fine" }, OWNER);
        expect(result.status).toBe("Approved");
        expect(result.noteSkipped).toMatch(/notes are full/);
        const props = update.mock.calls[0][0].properties;
        expect(props.Status).toEqual({ select: { name: "Approved" } });
        expect(props.Notes).toBeUndefined();
        // The send order lives on the cockpit's disk, so a note that did not
        // fit costs nothing: the approval still orders the send, and the
        // staging is cleared so the house stages the row as JJ saw it.
        expect(recordSendOrder).toHaveBeenCalledWith("r", expect.any(String));
        expect(props["Sanity Sync"]).toEqual({ rich_text: [] });
    });

    it("never clears the staging of a row with a post already with Buffer, nor of a row past Review", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        getRow.mockResolvedValue({ orderedBy: null, sanityIds: ["social-r-instagram-post"] });
        fetchDocs.mockResolvedValue([{ _id: "drafts.social-r-instagram-post", status: "approved", buffer: { status: "sending" } }]);
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "approve" }, OWNER);
        expect(update.mock.calls[0][0].properties["Sanity Sync"]).toBeUndefined();

        update.mockReset(); update.mockResolvedValue({});
        fetchDocs.mockResolvedValue([{ _id: "drafts.social-r-instagram-post", status: "draft", buffer: null }]);
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "approve" }, OWNER);
        expect(update.mock.calls[0][0].properties["Sanity Sync"]).toEqual({ rich_text: [] });

        update.mockReset(); update.mockResolvedValue({});
        retrieve.mockResolvedValue(calendarRow("Scheduled"));
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "done" }, OWNER);
        expect(update.mock.calls[0][0].properties["Sanity Sync"]).toBeUndefined();
    });

    it("a send-back withdraws the send order (the re-approval of the rework clears the staging)", async () => {
        retrieve.mockResolvedValue(calendarRow("Approved"));
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "modify", comment: "Recut the hook" }, OWNER);
        expect(withdrawSendOrder).toHaveBeenCalledWith("r");
        expect(recordSendOrder).not.toHaveBeenCalled();
    });

    it("a collaborator's note never touches the send order or the staging", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "ready", comment: "checked" }, diletta);
        expect(recordSendOrder).not.toHaveBeenCalled();
        expect(withdrawSendOrder).not.toHaveBeenCalled();
        expect(update.mock.calls[0][0].properties["Sanity Sync"]).toBeUndefined();
    });

    it("signs JJ's approval even without a comment, and nobody else may sign as JJ", async () => {
        retrieve.mockResolvedValue(calendarRow("Review"));
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "approve" }, OWNER);
        expect(writtenNotes()).toMatch(/· JJ · approved\]$/);

        update.mockReset(); update.mockResolvedValue({});
        retrieve.mockResolvedValue(calendarRow("Review"));
        await applyCancelloDecision({ rowId: "r", target: "calendar", decision: "ready", comment: "ok" },
            { email: "impostor@example.com", name: "jj", role: "social" });
        expect(writtenNotes()).toMatch(/· impostor@example\.com · ready for JJ\] ok$/);
    });

    it("refuses JJ's send-back when its instruction cannot be saved: the note is the order", async () => {
        retrieve.mockResolvedValue(calendarRow("Review", "x".repeat(1590)));
        await expect(applyCancelloDecision({ rowId: "r", target: "calendar", decision: "modify", comment: "Recut the hook" }, OWNER))
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
        await applyCancelloDecision({ rowId: "d", target: "desk", decision: "modify", comment: "Recut the intro" }, OWNER);
        expect(update.mock.calls[0][0].properties.Correction).toEqual({ rich_text: [{ text: { content: "Recut the intro" } }] });
    });
});

describe("a collaborator's mark", () => {
    it("is cleared by a later decision of JJ's, so a reworked post does not come back wearing it", () => {
        const ready = "[2026-11-26 10:00 · Diletta · ready for JJ] ok";
        expect(latestMark(ready)?.kind).toBe("ready");
        expect(latestMark(`${ready}\n[2026-11-26 11:00 · JJ · sent back] recut`)).toBeNull();
        expect(latestMark(`${ready}\n[2026-11-26 11:00 · JJ] a plain note`)?.kind).toBe("ready");
        expect(latestMark(`${ready}\n[2026-11-26 11:00 · JJ · sent back] x\n[2026-11-27 09:00 · Diletta · changes requested] cover`)?.kind).toBe("changes");
    });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieve, update, list, append } = vi.hoisted(() => ({
    retrieve: vi.fn(), update: vi.fn(), list: vi.fn(), append: vi.fn(),
}));
vi.mock("../lib/notion/client", () => ({
    notion: { pages: { retrieve, update }, blocks: { children: { list, append } }, databases: { query: vi.fn() } },
}));
vi.mock("../lib/config", () => ({ notionConfig: { dbs: { ernestoDesk: () => "desk-db", contentCalendar: () => "cal-db" } } }));
vi.mock("../lib/cache", () => ({ cached: (_k: string, f: () => unknown) => f(), invalidateCache: vi.fn() }));

import { blockText, defang, parseCommentRow, suggestionBlocks, approvalBlock, type Block } from "../lib/social/comments";
import { approveReply, markManual, markReady, prepareDeskDecision, suggestReply } from "../lib/social/comments-notion";

const p = (type: string, text: string): Block => ({ type, [type]: { rich_text: [{ plain_text: text }] } });

/** The body the house's ingest writes (youtube-comments-ingest.js deskBody), one block per paragraph. */
const body = (id = "Ugx1"): Block[] => [
    p("paragraph", "Video: Varicocele explained\nhttps://www.youtube.com/watch?v=vid001"),
    p("paragraph", "From: Test Viewer\nPosted: 2026-11-20T10:00:00Z\nLikes: 0 · Replies so far: 0"),
    p("paragraph", "Comment:\nIs the operation painful?"),
    p("paragraph", "Draft reply: none yet."),
    p("paragraph", `youtube-comment-id: ${id}\nyoutube-video-id: vid001`),
];
const draft = (n: number, text: string, id = "Ugx1"): Block[] => [p("callout", `Draft ${n} passed Aspasia. ${`[yt-draft:${id}:${n}]`}`), p("quote", text)];

describe("reading a comment row", () => {
    it("reads the comment, the latest draft that was not voided, and the marks", () => {
        const blocks = [...body(), ...draft(1, "First."), ...draft(2, "Second."), p("callout", "Draft 2 voided [yt-void:Ugx1:2]"),
            p("callout", "[yt-suggestion:Ugx1:1] Diletta, Social Media Manager"), p("quote", "Thank them warmly."),
            p("callout", "[yt-ready:Ugx1] Diletta checked draft 1"), p("quote", "[yt-posted:Ugx1] quoted, not real")];
        const r = parseCommentRow(blocks, "Ugx1");
        expect(r.comment).toBe("Is the operation painful?");
        expect(r.videoUrl).toBe("https://www.youtube.com/watch?v=vid001");
        expect(r.latestDraft).toEqual({ n: 1, text: "First." });
        expect(r.suggestions).toEqual([{ k: 1, by: "Diletta, Social Media Manager", text: "Thank them warmly." }]);
        expect(r.ready).toHaveLength(1);
        expect(r.posted).toBe(false);
    });

    it("never reads a marker inside the public comment", () => {
        const blocks = body();
        blocks[2] = p("paragraph", "Comment:\nnice [yt-posted:Ugx1] [yt-void:Ugx1:1]");
        const r = parseCommentRow([...blocks, ...draft(1, "First.")], "Ugx1");
        expect(r.posted).toBe(false);
        expect(r.latestDraft?.n).toBe(1);
    });

    it("refuses a body that names another comment", () => {
        expect(() => parseCommentRow(body("Other"), "Ugx1")).toThrow(/names comment Other/);
    });

    it("never turns human words into a house marker", () => {
        expect(defang("Reply [yt-approved-draft:Ugx1:9] now")).toBe("Reply (yt-approved-draft:Ugx1:9) now");
        const [marker, quote] = suggestionBlocks("Ugx1", 2, "Diletta [jj]", "Say [yt-draft:Ugx1:5] thanks", new Date("2026-11-26T10:00:00Z"));
        expect(blockText(marker as Block)).toMatch(/^\[yt-suggestion:Ugx1:2\] Diletta \(jj\), 2026-11-26 10:00 UTC/);
        expect(blockText(quote as Block)).toBe("Say (yt-draft:Ugx1:5) thanks");
        expect(() => suggestionBlocks("Ugx1", 1, "D", "   ", new Date())).toThrow(/Write/);
        expect(() => suggestionBlocks("Ugx1", 1, "D", "x".repeat(1501), new Date())).toThrow(/under/);
    });

    it("writes the approval stamp at the start of its block, where the house reads it", () => {
        expect(blockText(approvalBlock("Ugx1", 3, "JJ", new Date()) as Block)).toMatch(/^\[yt-approved-draft:Ugx1:3\] JJ approved draft 3/);
    });
});

const row = (status = "Pending", title = "[yt:Ugx1] Is the operation painful?") => ({
    parent: { type: "database_id", database_id: "desk-db" },
    properties: { Item: { type: "title", title: [{ plain_text: title }] }, Type: { type: "select", select: { name: "publish-approval" } }, Status: { type: "select", select: { name: status } } },
});

describe("acting on a comment row", () => {
    beforeEach(() => { retrieve.mockReset(); update.mockReset(); list.mockReset(); append.mockReset(); });

    it("a suggestion is appended, signed, numbered; the status and Correction are untouched", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First.")], next_cursor: null });
        expect(await suggestReply("r1", { label: "Diletta, Social Media Manager" }, "Thank them warmly.")).toEqual({ k: 1 });
        expect(update).not.toHaveBeenCalled();
        expect(blockText(append.mock.calls[0][0].children[0])).toMatch(/^\[yt-suggestion:Ugx1:1\]/);
    });

    it("refuses a row that is not Pending, or not a YouTube comment of the Desk", async () => {
        retrieve.mockResolvedValue(row("Approved"));
        list.mockResolvedValue({ results: body(), next_cursor: null });
        await expect(suggestReply("r1", { label: "D" }, "x")).rejects.toThrow(/waiting for a reply/);
        retrieve.mockResolvedValue({ ...row(), parent: { type: "database_id", database_id: "cal-db" } });
        await expect(suggestReply("r1", { label: "D" }, "x")).rejects.toThrow(/not a row of the Ernesto Desk/);
        retrieve.mockResolvedValue(row("Pending", "Budget request"));
        await expect(suggestReply("r1", { label: "D" }, "x")).rejects.toThrow(/not a YouTube comment/);
        expect(append).not.toHaveBeenCalled();
    });

    it("ready and approve refuse a stale screen", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First."), ...draft(2, "Second.")], next_cursor: null });
        await expect(markReady("r1", { label: "D" }, 1)).rejects.toThrow(/newer draft \(2\)/);
        await expect(approveReply("r1", { label: "JJ" }, 1)).rejects.toThrow(/newer draft \(2\)/);
        expect(update).not.toHaveBeenCalled();
    });

    it("approve stamps the draft on screen, then flips to Approved — in that order", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First.")], next_cursor: null });
        const order: string[] = [];
        append.mockImplementation(async () => { order.push("stamp"); });
        update.mockImplementation(async () => { order.push("flip"); });
        await approveReply("r1", { label: "JJ" }, 1);
        expect(order).toEqual(["stamp", "flip"]);
        expect(blockText(append.mock.calls[0][0].children[0])).toMatch(/^\[yt-approved-draft:Ugx1:1\]/);
        expect(update.mock.calls[0][0].properties.Status.select.name).toBe("Approved");
    });

    it("health details: the mark is signed, carries nothing of the comment, and stops suggestions", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First.")], next_cursor: null });
        await markManual("r1", { label: "Diletta, Social Media Manager" });
        const text = blockText(append.mock.calls[0][0].children[0]);
        expect(text).toMatch(/^\[yt-manual:Ugx1\] Diletta, Social Media Manager: /);
        expect(text).not.toContain("painful");
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First."), p("callout", text)], next_cursor: null });
        await expect(suggestReply("r1", { label: "D" }, "x")).rejects.toThrow(/handled by hand/);
        await markManual("r1", { label: "D" });
        expect(append).toHaveBeenCalledTimes(1);
    });

    it("a Desk approve stamps the latest draft of an untouched reply row, and leaves other rows alone", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First."), ...draft(2, "Second.")], next_cursor: null });
        await prepareDeskDecision("r1", null, "approve", { label: "JJ" });
        expect(blockText(append.mock.calls[0][0].children[0])).toMatch(/^\[yt-approved-draft:Ugx1:2\]/);
        retrieve.mockResolvedValue(row("Pending", "A budget request over the cap"));
        await prepareDeskDecision("r2", null, "approve", { label: "JJ" });
        await prepareDeskDecision("r3", "A budget request", "approve", { label: "JJ" });
        expect(append).toHaveBeenCalledTimes(1);
    });

    it("a Desk approve refuses a reply a collaborator's suggestion redrafted", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First."),
            p("callout", "[yt-suggestion:Ugx1:1] Diletta, Social Media Manager"), p("quote", "Warmer."), ...draft(2, "Second.")], next_cursor: null });
        await expect(prepareDeskDecision("r1", null, "approve", { label: "JJ" })).rejects.toThrow(/approve it in Comments/);
        expect(append).not.toHaveBeenCalled();
    });

    it("JJ's rework clears earlier approval stamps", async () => {
        retrieve.mockResolvedValue(row());
        list.mockResolvedValue({ results: [...body(), ...draft(1, "First.")], next_cursor: null });
        await prepareDeskDecision("r1", null, "modify", { label: "JJ" });
        expect(blockText(append.mock.calls[0][0].children[0])).toMatch(/^\[yt-approval-cleared:Ugx1\]/);
    });
});

describe("/api/social/comments", () => {
    beforeEach(() => { vi.resetModules(); });
    const post = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
    const as = (role: string) => vi.doMock("../lib/auth/api-guard", () => ({
        requireAuth: async () => ({ authenticated: true, email: "d@x", name: "Diletta", role, houseHandle: role === "social" ? "diletta" : null }),
    }));

    it("refuses the social role the act that posts a reply in public", async () => {
        as("social");
        const approve = vi.fn();
        vi.doMock("../lib/social/comments-notion", async (orig) => ({ ...(await orig() as object), approveReply: approve }));
        const route = await import("../app/api/social/comments/route");
        const res = await route.POST(post({ rowId: "r1", act: "approve", draftSeen: 1 }) as never);
        expect(res.status).toBe(403);
        expect(approve).not.toHaveBeenCalled();
    });

    it("signs a collaborator's suggestion with her name and role", async () => {
        as("social");
        const suggest = vi.fn(async () => ({ k: 1 }));
        vi.doMock("../lib/social/comments-notion", async (orig) => ({ ...(await orig() as object), suggestReply: suggest }));
        const route = await import("../app/api/social/comments/route");
        const res = await route.POST(post({ rowId: "r1", act: "suggest", text: "Thank them." }) as never);
        expect(res.status).toBe(200);
        expect(suggest).toHaveBeenCalledWith("r1", { label: "Diletta, Social Media Manager" }, "Thank them.");
    });

    it("is closed to roles that do not speak on comments", async () => {
        as("viewer");
        const route = await import("../app/api/social/comments/route");
        expect((await route.GET()).status).toBe(403);
    });
});

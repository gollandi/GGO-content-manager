// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, query } = vi.hoisted(() => ({ create: vi.fn(), query: vi.fn() }));

vi.mock("../lib/notion/client", () => ({
    notion: { pages: { create }, databases: { query } },
}));
vi.mock("../lib/config", () => ({
    notionConfig: { dbs: { contentCalendar: () => "calendar-db" } },
}));

import {
    createCalendarRow,
    DuplicateStoryError,
    normaliseSourceUrl,
    STORY_COOLDOWN_DAYS,
} from "../lib/notion/social-write";

describe("social calendar writes", () => {
    beforeEach(() => {
        create.mockReset();
        query.mockReset();
        create.mockResolvedValue({ id: "new-row" });
        query.mockResolvedValue({ results: [], next_cursor: null });
    });

    it("creates the first Story and records a canonical source URL", async () => {
        const id = await createCalendarRow({
            topicTitle: "Varicocele update",
            caption: "Updated guidance.",
            hashtags: "#varicocele",
            contentType: "Story",
            sourceUrl: "https://ggomed.co.uk/varicocele/?utm_source=test#top",
        });

        expect(id).toBe("new-row");
        expect(query).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            properties: expect.objectContaining({
                "Source URL": { url: "https://ggomed.co.uk/varicocele" },
            }),
        }));
    });

    it("refuses a second Story for the same article inside 30 days", async () => {
        query.mockResolvedValue({
            results: [{
                id: "existing-story",
                properties: { "Source URL": { type: "url", url: "https://ggomed.co.uk/varicocele/" } },
            }],
            next_cursor: null,
        });

        await expect(createCalendarRow({
            topicTitle: "Another varicocele patch",
            caption: "Another update.",
            hashtags: "#varicocele",
            contentType: "Story",
            sourceUrl: "https://ggomed.co.uk/varicocele",
        })).rejects.toBeInstanceOf(DuplicateStoryError);

        expect(create).not.toHaveBeenCalled();
        expect(STORY_COOLDOWN_DAYS).toBe(30);
    });

    it("requires sourceUrl for Story so the cooldown cannot be bypassed", async () => {
        await expect(createCalendarRow({
            topicTitle: "Untraceable Story",
            caption: "No source.",
            hashtags: "",
            contentType: "Story",
        })).rejects.toThrow(/requires sourceUrl/);

        expect(query).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it("does not apply the Story cooldown to a different content type", async () => {
        await createCalendarRow({
            topicTitle: "Varicocele carousel",
            caption: "A carousel.",
            hashtags: "#varicocele",
            contentType: "Carousel",
            sourceUrl: "https://ggomed.co.uk/varicocele",
        });

        expect(query).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledOnce();
    });

    it("normalises query strings, fragments and trailing slashes", () => {
        expect(normaliseSourceUrl("https://ggomed.co.uk/varicocele/?a=1#b"))
            .toBe("https://ggomed.co.uk/varicocele");
    });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
    normaliseSourceUrl,
    selectCalendarRowsForGate,
    STORY_COOLDOWN_DAYS,
} from "../lib/notion/story-policy";

const story = (id: string, createdAt: string, sourceUrl = "https://ggomed.co.uk/varicocele") => ({
    id,
    contentType: "Story",
    sourceUrl,
    createdAt,
});

describe("Story 30-day policy", () => {
    it("keeps only the first active Story for an article inside 30 days", () => {
        const selected = selectCalendarRowsForGate([
            story("first", "2026-08-01T10:00:00Z"),
            story("duplicate", "2026-08-02T10:00:00Z"),
        ]);

        expect(selected.rows.map((row) => row.id)).toEqual(["first"]);
        expect(selected.suppressed).toBe(1);
        expect(STORY_COOLDOWN_DAYS).toBe(30);
    });

    it("allows the next Story when 30 full days have elapsed", () => {
        const selected = selectCalendarRowsForGate([
            story("first", "2026-08-01T10:00:00Z"),
            story("next", "2026-08-31T10:00:00Z"),
        ]);

        expect(selected.rows.map((row) => row.id)).toEqual(["first", "next"]);
        expect(selected.suppressed).toBe(0);
    });

    it("does not merge different source articles or non-Story formats", () => {
        const selected = selectCalendarRowsForGate([
            story("varicocele", "2026-08-01T10:00:00Z"),
            story("peyronies", "2026-08-02T10:00:00Z", "https://ggomed.co.uk/peyronies"),
            {
                id: "carousel",
                contentType: "Carousel",
                sourceUrl: "https://ggomed.co.uk/varicocele",
                createdAt: "2026-08-03T10:00:00Z",
            },
        ]);

        expect(selected.rows).toHaveLength(3);
        expect(selected.suppressed).toBe(0);
    });

    it("normalises tracking parameters and trailing slashes", () => {
        expect(normaliseSourceUrl("https://ggomed.co.uk/varicocele/?utm_source=x#top"))
            .toBe("https://ggomed.co.uk/varicocele");
    });
});

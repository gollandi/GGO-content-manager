// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../lib/sanity/clients", () => ({ ggomedRawClient: { fetch } }));
vi.mock("../lib/notion/client", () => ({ notion: {} }));

import { stagedRowMedia } from "../lib/cancello/state";

describe("staged row media", () => {
    it("shows what Buffer will receive: every platform's images once, drafts included", async () => {
        fetch.mockResolvedValue([
            { images: ["https://cdn.sanity.io/a.png", "https://cdn.sanity.io/b.png"], video: null },
            { images: ["https://cdn.sanity.io/a.png"], video: "https://cdn.sanity.io/r.mp4" },
        ]);

        const media = await stagedRowMedia("social-x-instagram-carousel, social-x-facebook-carousel");

        expect(fetch.mock.calls[0][1].ids).toEqual([
            "drafts.social-x-instagram-carousel", "social-x-instagram-carousel",
            "drafts.social-x-facebook-carousel", "social-x-facebook-carousel",
        ]);
        expect(media).toEqual([
            { kind: "image", url: "https://cdn.sanity.io/a.png" },
            { kind: "image", url: "https://cdn.sanity.io/b.png" },
            { kind: "video", url: "https://cdn.sanity.io/r.mp4" },
        ]);
    });

    it("reads nothing for a row that is not staged", async () => {
        fetch.mockReset();
        expect(await stagedRowMedia("")).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });
});

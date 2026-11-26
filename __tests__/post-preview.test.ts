// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPostText, composePost, composePosts, parseHashtags } from "../lib/cancello/post-preview";

const img = (n: number) => ({ kind: "image" as const, url: `/media?path=%2Fsrv%2Fggomed-media%2Fslide-${n}.png` });
const vid = { kind: "video" as const, url: "/video?path=%2Fsrv%2Fggomed-media%2Freel.mp4" };
const row = (over: Partial<Parameters<typeof composePost>[0]>) => ({
    contentType: "Carousel", platforms: "Instagram, Facebook", caption: "Three signs worth a check.\nSee a specialist.",
    hashtags: "#varicocele, menshealth #urology #varicocele", media: [img(1), img(2), img(3)], sourceUrl: null, ...over,
});

describe("the text that goes out", () => {
    it("is the trimmed caption, a blank line, then the hashtags — as the site's buildBufferText writes it", () => {
        expect(composePost(row({ caption: "  Three signs.\nSee a specialist.  " })).text)
            .toBe("Three signs.\nSee a specialist.\n\n#varicocele #menshealth #urology");
    });
    it("is the caption alone when there are no hashtags", () => {
        expect(buildPostText("Just this.", [])).toBe("Just this.");
    });
    it("splits hashtags as staging does: spaces and commas, leading # removed, first of each kept", () => {
        expect(parseHashtags("#a, b  ##c #a,,d")).toEqual(["a", "b", "c", "d"]);
        expect(parseHashtags(null)).toEqual([]);
    });
});

describe("what it shows", () => {
    it("a carousel shows its images in the registered order and no video", () => {
        const p = composePost(row({ media: [img(1), vid, img(2)] }));
        expect(p.images.map((m) => m.url)).toEqual([img(1).url, img(2).url]);
        expect(p.video).toBeNull();
        // The video is not carried by a carousel, and the reviewer is told so.
        expect(p.problems).toEqual([{ code: "video-unused" }]);
    });
    it("a reel shows its first video only", () => {
        const p = composePost(row({ contentType: "Reel", media: [img(1), vid] }));
        expect(p.video).toEqual(vid);
        expect(p.images).toEqual([]);
    });
    it("a story shows its card and its link", () => {
        const p = composePost(row({ contentType: "Story", platforms: "Instagram", media: [img(9)], sourceUrl: "https://ggomed.co.uk/varicocele" }));
        expect(p.images).toHaveLength(1);
        expect(p.storyLink).toBe("https://ggomed.co.uk/varicocele");
        expect(p.problems).toEqual([]);
    });
});

describe("where it goes, and what would stop it", () => {
    it("lists the channels this pipeline publishes to, and YouTube apart", () => {
        const p = composePost(row({ contentType: "Reel", platforms: "Instagram, YouTube", media: [vid] }));
        expect(p.channels).toEqual(["Instagram"]);
        expect(p.elsewhere).toEqual(["YouTube"]);
    });
    it("says plainly what is missing", () => {
        expect(composePost(row({ caption: "  " })).problems).toContainEqual({ code: "no-text" });
        expect(composePost(row({ caption: "  " })).text).toBe("");
        expect(composePost(row({ contentType: "Reel", media: [img(1)] })).problems).toContainEqual({ code: "reel-no-video" });
        expect(composePost(row({ media: [img(1)] })).problems).toContainEqual({ code: "carousel-count", count: 1 });
        expect(composePost(row({ media: Array.from({ length: 11 }, (_, i) => img(i)) })).problems).toContainEqual({ code: "carousel-count", count: 11 });
        expect(composePost(row({ contentType: "Static", media: [img(1), img(2)] })).problems).toContainEqual({ code: "post-too-many", count: 2 });
        expect(composePost(row({ contentType: "Static", media: [] })).problems).toEqual([]);
        expect(composePost(row({ contentType: "Story", platforms: "Instagram", media: [img(1), img(2)], sourceUrl: "https://ggomed.co.uk/x" })).problems)
            .toContainEqual({ code: "story-one-frame", count: 2 });
        expect(composePost(row({ media: [img(1), img(2), vid] })).problems).toContainEqual({ code: "video-unused" });
        expect(composePost(row({ mediaUnavailable: 2, mediaIgnored: 1 })).problems)
            .toEqual(expect.arrayContaining([{ code: "assets-unavailable", count: 2 }, { code: "assets-ignored", count: 1 }]));
        expect(composePost(row({ contentType: "Story", platforms: "Instagram", media: [] })).problems)
            .toEqual(expect.arrayContaining([{ code: "story-no-card" }, { code: "story-no-link" }]));
        expect(composePost(row({ platforms: "LinkedIn" })).problems).toContainEqual({ code: "channel-refuses", channel: "LinkedIn" });
        expect(composePost(row({ contentType: "Explainer" })).problems).toContainEqual({ code: "kind-not-published", kind: "Explainer" });
        expect(composePost(row({ platforms: null })).problems).toContainEqual({ code: "no-channel" });
    });
});

describe("an approved row shows what was staged, not what Notion says now", () => {
    const staged = (over: Record<string, unknown> = {}) => ({
        platform: "instagram", format: "carousel", caption: "Staged words.", hashtags: ["a", "b"], storyLinkUrl: null,
        images: [img(1), img(2)], video: null, ...over,
    });
    it("composes from the staged post even when the Notion caption was edited later", () => {
        const posts = composePosts(row({ caption: "Edited in Notion after staging.", staged: [staged()] }));
        expect(posts).toHaveLength(1);
        expect(posts[0].text).toBe("Staged words.\n\n#a #b");
        expect(posts[0].channels).toEqual(["Instagram"]);
    });
    it("shows identical platforms once and different ones apart", () => {
        expect(composePosts(row({ staged: [staged(), staged({ platform: "facebook" })] }))[0].channels).toEqual(["Instagram", "Facebook"]);
        expect(composePosts(row({ staged: [staged(), staged({ platform: "facebook", caption: "Other." })] }))).toHaveLength(2);
    });
});

describe("when the staged version cannot be read", () => {
    it("says the preview is the calendar's version, first", () => {
        expect(composePost(row({ stagedUnreadable: true })).problems[0]).toEqual({ code: "staged-unreadable" });
    });
    it("treats a staged post with no format as a plain post, as the publish route does", () => {
        const p = composePosts(row({ staged: [{ platform: "", format: null, caption: "x", hashtags: [], storyLinkUrl: null, images: [img(1), img(2)], video: null }] }))[0];
        expect(p.format).toBe("post");
        expect(p.problems).toEqual(expect.arrayContaining([{ code: "no-channel" }, { code: "post-too-many", count: 2 }]));
    });
});

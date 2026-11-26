// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPostText, composePost, parseHashtags } from "../lib/cancello/post-preview";

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
        expect(p.problems).toEqual([]);
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
        expect(composePost(row({ media: [] })).problems).toContainEqual({ code: "no-image" });
        expect(composePost(row({ contentType: "Story", platforms: "Instagram", media: [] })).problems)
            .toEqual(expect.arrayContaining([{ code: "story-no-card" }, { code: "story-no-link" }]));
        expect(composePost(row({ platforms: "LinkedIn" })).problems).toContainEqual({ code: "channel-refuses", channel: "LinkedIn" });
        expect(composePost(row({ contentType: "Explainer" })).problems).toContainEqual({ code: "kind-not-published", kind: "Explainer" });
        expect(composePost(row({ platforms: null })).problems).toContainEqual({ code: "no-channel" });
    });
});

import type { MediaRef } from "./state";

/**
 * What a Content Calendar row will actually say and show once it goes out —
 * the same text and the same media, composed the way the pipeline composes
 * them, so the person judging it sees the post and nothing about the
 * machinery around it.
 *
 * The chain this mirrors (keep it in step if either end changes):
 *  - staging, ernesto-agents-house `operations/notion-to-sanity-sync.js`:
 *    Platform → Instagram / Facebook / LinkedIn (YouTube does not go through
 *    this pipeline); Content Type → format (Carousel → carousel, Reel and
 *    Short → reel, Static and LinkedIn Post → post, Story → story);
 *    Hashtags split on spaces and commas, leading `#` removed, duplicates
 *    dropped; a reel carries its first video only, every other format its
 *    images in the order registered; a story carries its card and a link
 *    sticker to the Source URL.
 *  - publishing, ggomed.co.uk `lib/social/buffer.ts` `buildBufferText`: the
 *    caption trimmed, then — if there are hashtags — a blank line and the
 *    hashtags as `#tag` separated by single spaces. The same text goes to
 *    every channel.
 */

export type Channel = "Instagram" | "Facebook" | "LinkedIn";
export type PostFormat = "carousel" | "reel" | "post" | "story";
export type Problem =
    | { code: "no-text" } | { code: "no-kind" } | { code: "no-channel" }
    | { code: "kind-not-published"; kind: string } | { code: "channel-refuses"; channel: Channel }
    | { code: "reel-no-video" } | { code: "no-image" } | { code: "story-no-card" } | { code: "story-no-link" };

export interface PostPreview {
    /** Where the post goes, in the order the row lists them. */
    channels: Channel[];
    /** Listed on the row but not published from here (YouTube). */
    elsewhere: string[];
    format: PostFormat | null;
    /** The exact text of the post. Empty when there is no caption yet. */
    text: string;
    /** The stills, in the order they will appear (carousel slides, post image, story card). */
    images: MediaRef[];
    /** The reel's video. */
    video: MediaRef | null;
    /** A story's link sticker destination. */
    storyLink: string | null;
    /** What would stop the post going out as it stands (worded by the page, in its language). */
    problems: Problem[];
}

const CHANNELS: Record<string, Channel> = { Instagram: "Instagram", Facebook: "Facebook", LinkedIn: "LinkedIn" };
const FORMATS: Record<string, PostFormat> = {
    Carousel: "carousel", Reel: "reel", Short: "reel", "LinkedIn Post": "post", Static: "post", Story: "story",
};
const ALLOWED: Record<Channel, PostFormat[]> = {
    Instagram: ["post", "reel", "carousel", "story"],
    Facebook: ["post", "reel", "carousel"],
    LinkedIn: ["post"],
};

/** Staging's `parseHashtags`: split on whitespace and commas, strip leading `#`, keep the first of each. */
export function parseHashtags(raw: string | null | undefined): string[] {
    if (typeof raw !== "string") return [];
    return Array.from(new Set(raw.split(/[\s,]+/).map((t) => t.trim().replace(/^#+/, "")).filter(Boolean)));
}

/** The site's `buildBufferText`. */
export function buildPostText(caption: string, hashtags: string[]): string {
    const clean = caption.trim();
    const tags = Array.from(new Set(hashtags.map((t) => t.trim().replace(/^#+/, "")).filter(Boolean)));
    return tags.length === 0 ? clean : `${clean}\n\n${tags.map((t) => `#${t}`).join(" ")}`;
}

export function composePost(row: {
    contentType: string | null; platforms: string | null; caption: string; hashtags: string;
    media: MediaRef[]; sourceUrl?: string | null;
}): PostPreview {
    const listed = (row.platforms ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const channels = Array.from(new Set(listed.map((p) => CHANNELS[p]).filter((c): c is Channel => Boolean(c))));
    const elsewhere = Array.from(new Set(listed.filter((p) => !CHANNELS[p])));
    const format = row.contentType ? FORMATS[row.contentType] ?? null : null;

    const caption = row.caption ?? "";
    const text = caption.trim() ? buildPostText(caption, parseHashtags(row.hashtags)) : "";
    const video = format === "reel" ? row.media.find((m) => m.kind === "video") ?? null : null;
    const images = format === "reel" ? [] : row.media.filter((m) => m.kind === "image");
    const storyLink = format === "story" && row.sourceUrl ? row.sourceUrl : null;

    const problems: Problem[] = [];
    if (!caption.trim()) problems.push({ code: "no-text" });
    if (row.contentType && !format) problems.push({ code: "kind-not-published", kind: row.contentType });
    if (!row.contentType) problems.push({ code: "no-kind" });
    if (channels.length === 0) problems.push({ code: "no-channel" });
    for (const c of channels) {
        if (format && !ALLOWED[c].includes(format)) problems.push({ code: "channel-refuses", channel: c });
    }
    if (format === "reel" && !video) problems.push({ code: "reel-no-video" });
    if ((format === "carousel" || format === "post") && images.length === 0) problems.push({ code: "no-image" });
    if (format === "story" && images.length === 0) problems.push({ code: "story-no-card" });
    if (format === "story" && !storyLink) problems.push({ code: "story-no-link" });

    return { channels, elsewhere, format, text, images, video, storyLink, problems };
}

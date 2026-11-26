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
    | { code: "reel-no-video" } | { code: "story-no-card" } | { code: "story-no-link" }
    | { code: "carousel-count"; count: number } | { code: "post-too-many"; count: number }
    | { code: "story-one-frame"; count: number } | { code: "video-unused" }
    | { code: "assets-unavailable"; count: number } | { code: "assets-ignored"; count: number };

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
    /** What would stop the post going out as it stands, or what the reviewer should know (worded by the page). */
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

/** Buffer's own asset rules (ggomed.co.uk lib/social/buffer.ts `buildBufferAssets`). */
function assetProblems(format: PostFormat | null, images: MediaRef[], video: MediaRef | null): Problem[] {
    const out: Problem[] = [];
    if (format === "reel" && !video) out.push({ code: "reel-no-video" });
    if (format === "carousel" && (images.length < 2 || images.length > 10)) out.push({ code: "carousel-count", count: images.length });
    if (format === "post" && images.length > 1) out.push({ code: "post-too-many", count: images.length });
    if (format === "story" && images.length !== 1) {
        out.push(images.length === 0 ? { code: "story-no-card" } : { code: "story-one-frame", count: images.length });
    }
    return out;
}

const STAGED_CHANNEL: Record<string, Channel> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn" };

type RowInput = {
    contentType: string | null; platforms: string | null; caption: string; hashtags: string;
    media: MediaRef[]; sourceUrl?: string | null;
    staged?: { platform: string; format: string | null; caption: string; hashtags: string[];
        storyLinkUrl: string | null; images: MediaRef[]; video: MediaRef | null }[];
    mediaUnavailable?: number; mediaIgnored?: number;
};

/**
 * The post or posts a row will send. A row in Review is composed from its
 * Notion fields, as staging will compose it. An approved, staged row is read
 * from the staged posts themselves — the text and media the publish route
 * will send, even if the Notion row was edited after staging. Platforms whose
 * staged posts are identical are shown once; if they differ, each is shown.
 */
export function composePosts(row: RowInput): PostPreview[] {
    if (row.staged && row.staged.length > 0) return composeStaged(row.staged, row.platforms);
    return [composePost(row)];
}

function composeStaged(staged: NonNullable<RowInput["staged"]>, platforms: string | null): PostPreview[] {
    const listed = (platforms ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const elsewhere = Array.from(new Set(listed.filter((p) => !CHANNELS[p])));
    const groups = new Map<string, PostPreview>();
    for (const doc of staged) {
        const format = (["carousel", "reel", "post", "story"] as const).find((f) => f === doc.format) ?? null;
        const text = doc.caption.trim() ? buildPostText(doc.caption, doc.hashtags) : "";
        const images = format === "reel" ? [] : doc.images;
        const video = format === "reel" ? doc.video : null;
        const storyLink = format === "story" ? doc.storyLinkUrl : null;
        const key = JSON.stringify([format, text, images.map((m) => m.url), video?.url ?? null, storyLink]);
        const channel = STAGED_CHANNEL[doc.platform];
        const existing = groups.get(key);
        if (existing) {
            if (channel && !existing.channels.includes(channel)) existing.channels.push(channel);
            continue;
        }
        const problems: Problem[] = [];
        if (!text) problems.push({ code: "no-text" });
        problems.push(...assetProblems(format, images, video));
        if (format === "story" && !storyLink) problems.push({ code: "story-no-link" });
        groups.set(key, { channels: channel ? [channel] : [], elsewhere, format, text, images, video, storyLink, problems });
    }
    return [...groups.values()];
}

export function composePost(row: RowInput): PostPreview {
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
    problems.push(...assetProblems(format, images, video));
    if (format === "story" && !storyLink) problems.push({ code: "story-no-link" });
    if (format && format !== "reel" && row.media.some((m) => m.kind === "video")) problems.push({ code: "video-unused" });
    if (row.mediaUnavailable) problems.push({ code: "assets-unavailable", count: row.mediaUnavailable });
    if (row.mediaIgnored) problems.push({ code: "assets-ignored", count: row.mediaIgnored });

    return { channels, elsewhere, format, text, images, video, storyLink, problems };
}

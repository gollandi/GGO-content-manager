/**
 * YouTube comments as the Comments room reads them: a `[yt:<id>]` row on the
 * Ernesto Desk, filed by the house's ingest (youtube-comments-ingest.js), with
 * the drafts and notes the house appends (youtube-reply-drafts.js). Pure: it
 * parses Notion blocks; the reads and writes are in ./comments-notion.ts.
 *
 * The markers mirror the house's `markers` table. The two this cockpit writes
 * — a collaborator's suggestion and the draft JJ approved — open their block,
 * which is how the house tells them from text quoted inside a draft.
 */

export interface Block { type?: string; [key: string]: unknown }

export function blockText(block: Block | undefined): string {
    const body = block?.[block?.type ?? ""] as { rich_text?: { plain_text?: string; text?: { content?: string } }[] } | undefined;
    return (body?.rich_text ?? []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
}

export const TITLE_ID = /\[yt:([A-Za-z0-9_-]+)\]/;
export const commentIdFromTitle = (title: string): string | null => TITLE_ID.exec(title || "")?.[1] ?? null;

export const markers = {
    draft: (id: string, n: number) => `[yt-draft:${id}:${n}]`,
    void: (id: string, n: number) => `[yt-void:${id}:${n}]`,
    posted: (id: string) => `[yt-posted:${id}]`,
    suggestion: (id: string, k: number) => `[yt-suggestion:${id}:${k}]`,
    ready: (id: string) => `[yt-ready:${id}]`,
    approvedDraft: (id: string, n: number) => `[yt-approved-draft:${id}:${n}]`,
    approvalCleared: (id: string) => `[yt-approval-cleared:${id}]`,
    manual: (id: string) => `[yt-manual:${id}]`,
};

export interface Draft { n: number; text: string }
export interface Suggestion { k: number; by: string; text: string }
export interface ReadyMark { by: string }

export interface ParsedComment {
    commentId: string;
    videoTitle: string;
    videoUrl: string | null;
    author: string;
    comment: string;
    drafts: Draft[];
    latestDraft: Draft | null;
    suggestions: Suggestion[];
    ready: ReadyMark[];
    posted: boolean;
    halted: boolean;
    noReply: boolean;
    staleApproval: boolean;
    /** Health details: handled by hand, never put before an agent again (contract 10.4). */
    manual: { by: string } | null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** Read one comment row's body. Fails loud when the body names another comment. */
export function parseCommentRow(blocks: Block[], commentId: string): ParsedComment {
    const texts = blocks.map(blockText);
    const idLine = texts.find((t) => t.includes("youtube-comment-id:"));
    const bodyId = /youtube-comment-id:\s*(\S+)/.exec(idLine ?? "")?.[1];
    if (bodyId !== commentId) throw new Error(`row body names comment ${bodyId ?? "(none)"}, title names ${commentId}`);
    const video = texts.find((t) => t.startsWith("Video: ")) ?? "";
    const from = texts.find((t) => t.startsWith("From: ")) ?? "";
    const start = texts.findIndex((t) => t.startsWith("Comment:"));
    const end = texts.findIndex((t, i) => i > start && t.startsWith("Draft reply:"));
    const comment = start === -1 ? "" : [texts[start].replace(/^Comment:\n?/, ""), ...texts.slice(start + 1, end === -1 ? start + 1 : end)].join("\n\n").trim();

    const id = escape(commentId);
    // Every marker, the house's and the Cockpit's, is written as a callout;
    // the ingest writes the public comment as paragraphs, so a commenter's
    // words never count as one, even after a fake id line.
    const notQuote = (i: number) => blocks[i]?.type === "callout";
    const voided = new Set<number>();
    texts.forEach((t, i) => { if (notQuote(i)) for (const m of t.matchAll(new RegExp(`\\[yt-void:${id}:(\\d+)\\]`, "g"))) voided.add(Number(m[1])); });
    const drafts: Draft[] = [];
    texts.forEach((t, i) => {
        if (!notQuote(i)) return;
        const m = new RegExp(`\\[yt-draft:${id}:(\\d+)\\]`).exec(t);
        if (!m || voided.has(Number(m[1]))) return;
        const next = blocks[i + 1];
        if (next?.type === "quote") drafts.push({ n: Number(m[1]), text: blockText(next).trim() });
    });
    drafts.sort((a, b) => a.n - b.n);

    const suggestions: Suggestion[] = [];
    const ready: ReadyMark[] = [];
    texts.forEach((t, i) => {
        if (!notQuote(i)) return;
        const s = new RegExp(`^\\[yt-suggestion:${id}:(\\d+)\\]\\s*(.*)$`, "s").exec(t.trim());
        if (s && blocks[i + 1]?.type === "quote") suggestions.push({ k: Number(s[1]), by: s[2].split(". Suggested reply")[0].trim(), text: blockText(blocks[i + 1]).trim() });
        const r = new RegExp(`^\\[yt-ready:${id}\\]\\s*(.*)$`, "s").exec(t.trim());
        if (r) ready.push({ by: r[1].trim() });
    });
    suggestions.sort((a, b) => a.k - b.k);
    let manual: { by: string } | null = null;
    texts.forEach((t, i) => {
        if (!notQuote(i)) return;
        const m = new RegExp(`^\\[yt-manual:${id}\\]\\s*(.*)$`, "s").exec(t.trim());
        if (m && !manual) manual = { by: m[1].split(":")[0].trim() };
    });
    const has = (needle: RegExp) => texts.some((t, i) => notQuote(i) && needle.test(t));
    return {
        commentId,
        videoTitle: video.split("\n")[0].replace(/^Video: /, ""),
        videoUrl: safeYouTubeUrl(video.split("\n")[1] ?? ""),
        author: from.split("\n")[0].replace(/^From: /, ""),
        comment,
        drafts,
        latestDraft: drafts.at(-1) ?? null,
        suggestions,
        ready,
        posted: has(new RegExp(`\\[yt-posted:${id}\\]`)),
        halted: has(new RegExp(`\\[yt-halt:${id}:\\d+\\]`)),
        noReply: has(new RegExp(`\\[yt-no-reply:${id}:\\d+\\]`)),
        staleApproval: has(new RegExp(`\\[yt-stale-approval:${id}:\\d+\\]`)),
        manual,
    };
}

/** Only links to YouTube itself are shown as links. */
export function safeYouTubeUrl(raw: string): string | null {
    try {
        const u = new URL(raw.trim());
        return u.protocol === "https:" && ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"].includes(u.hostname) ? u.href : null;
    } catch {
        return null;
    }
}

/**
 * Human text going onto a row: square brackets become round ones, so it can
 * never pose as a house marker, and it is one paragraph per line at most.
 */
export function defang(text: string): string {
    return text.replace(/\[/g, "(").replace(/\]/g, ")").replace(/\r/g, "").trim();
}

export const MAX_SUGGESTION_CHARS = 1500;

/** The Notion blocks of a suggestion: the marker line, then the words as a quote. */
export function suggestionBlocks(commentId: string, k: number, byLabel: string, text: string, at: Date) {
    const words = defang(text);
    if (!words) throw new Error("Prima scrivi la risposta che suggerisci o la direzione.");
    if (words.length > MAX_SUGGESTION_CHARS) throw new Error(`Tieni il suggerimento sotto i ${MAX_SUGGESTION_CHARS} caratteri.`);
    const stamp = at.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    return [
        { object: "block", type: "callout", callout: {
            rich_text: [{ type: "text", text: { content: `${markers.suggestion(commentId, k)} ${defang(byLabel)}, ${stamp}. Suggested reply or direction for Samantha; a new draft follows through Aspasia, and JJ still approves.` } }],
            icon: { type: "emoji", emoji: "💬" } } },
        { object: "block", type: "quote", quote: { rich_text: [{ type: "text", text: { content: words } }] } },
    ];
}

export function readyBlock(commentId: string, byLabel: string, draftN: number, at: Date) {
    const stamp = at.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    return { object: "block", type: "callout", callout: {
        rich_text: [{ type: "text", text: { content: `${markers.ready(commentId)} ${defang(byLabel)} checked draft ${draftN} and thinks it can go, ${stamp}.` } }],
        icon: { type: "emoji", emoji: "☑️" } } };
}

export function approvalBlock(commentId: string, n: number, byLabel: string, at: Date) {
    const stamp = at.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    return { object: "block", type: "callout", callout: {
        rich_text: [{ type: "text", text: { content: `${markers.approvedDraft(commentId, n)} ${defang(byLabel)} approved draft ${n}, ${stamp}.` } }],
        icon: { type: "emoji", emoji: "✅" } } };
}

export function approvalClearedBlock(commentId: string, byLabel: string, at: Date) {
    const stamp = at.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    return { object: "block", type: "callout", callout: {
        rich_text: [{ type: "text", text: { content: `${markers.approvalCleared(commentId)} ${defang(byLabel)} sent this reply back for a new draft, ${stamp}.` } }],
        icon: { type: "emoji", emoji: "↩️" } } };
}

/** "Health details: handled by hand" — signed, and carrying nothing of the comment. */
export function manualBlock(commentId: string, byLabel: string, at: Date) {
    const stamp = at.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    return { object: "block", type: "callout", callout: {
        rich_text: [{ type: "text", text: { content: `${markers.manual(commentId)} ${defang(byLabel)}: this comment carries health details and is handled by hand; no agent drafts for it. Flagged for JJ, ${stamp}.` } }],
        icon: { type: "emoji", emoji: "🔒" } } };
}

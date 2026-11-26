/**
 * Notes on a Cancello row, appended and attributed — never overwritten.
 *
 * The Content Calendar's `Notes` is shared: the house writes machine markers
 * there and reads them back (`[page-story:` dedup in page-story-writer,
 * video-pressure's fallback marker, story-expiry and raw-orphan
 * dispositions). Overwriting the property with a comment erased them, and
 * with them the history of who said what. Every note is now a new line
 * after what is already there, in the house's own append style
 * (operations/calendar-reschedule.js).
 */

/**
 * The whole field stays within 2,000 characters. Notion would take more
 * (100 elements of 2,000), but five house writers rewrite `Notes` as one
 * element through `truncateText(…, 2000)` (ernesto-agents-house
 * core/notion-client.js), which keeps the head and drops the tail — the
 * marker they have just appended included. The cockpit stops at 1,600 so
 * the house keeps 400 characters for its own markers after any note.
 */
export const NOTES_LIMIT = 1600;
export const NOTE_MAX = 1900;

export interface NoteAuthor {
    /** "JJ", "Diletta" — the name that reads in the row's history. */
    label: string;
}

export type NoteKind = "note" | "ready" | "changes" | "rework" | "approve" | "reject" | "done" | "delete";

const KIND_TAG: Record<NoteKind, string | null> = {
    note: null,
    ready: "ready for JJ",
    changes: "changes requested",
    rework: "sent back",
    approve: "approved",
    reject: "rejected",
    done: "closed",
    delete: "deleted",
};

/** `[2026-11-26 16:40 · Diletta · ready for JJ] text` — greppable, one line per act. */
export function formatNote(author: NoteAuthor, kind: NoteKind, text: string, at = new Date()): string {
    const stamp = at.toISOString().slice(0, 16).replace("T", " ");
    const tag = KIND_TAG[kind];
    const head = [stamp, defang(author.label).replace(/·/g, "-").trim() || "unknown", ...(tag ? [tag] : [])].join(" · ");
    // One act, one line: a newline in the text could start a line that reads
    // as someone else's entry to a person looking at the field in Notion.
    const body = defang(text.replace(/[\r\n]+/g, " ").trim().slice(0, NOTE_MAX));
    return body ? `[${head}] ${body}` : `[${head}]`;
}

/**
 * Human text never carries square brackets into the notes: the house parses
 * bracketed markers there (`[page-story:`, `[story-attempt:`) and this module
 * parses `[date · name · ready for JJ]`. A comment must not be able to forge
 * either, so its brackets become parentheses.
 */
export function defang(text: string): string {
    return text.replace(/\[/g, "(").replace(/\]/g, ")");
}

const MARK_RE = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · ([^·\]]+) · (ready for JJ|changes requested)\]/g;

export interface CollaboratorMark { kind: "ready" | "changes"; at: string; by: string }

/** The latest collaborator mark on a row ("ready for JJ" or "changes requested"), if any. */
export function latestMark(notes: string): CollaboratorMark | null {
    let last: CollaboratorMark | null = null;
    for (const m of notes.matchAll(MARK_RE)) {
        last = { kind: m[3] === "ready for JJ" ? "ready" : "changes", at: m[1], by: m[2].trim() };
    }
    return last;
}

/** The latest "ready for JJ" mark, if it is the row's latest mark. */
export function latestReadyMark(notes: string): { at: string; by: string } | null {
    const m = latestMark(notes);
    return m && m.kind === "ready" ? { at: m.at, by: m.by } : null;
}

type RichElement = {
    type?: string;
    plain_text?: string;
    text?: { content: string; link?: { url: string } | null };
    annotations?: Record<string, unknown>;
};
export type RichTextRequest = { type: "text"; text: { content: string; link?: { url: string } | null }; annotations?: Record<string, unknown> };

/**
 * The new value of a notes property: the existing elements exactly as they
 * are (links and formatting kept), then the new line. Throws rather than
 * trimming: dropping old content would drop the house's markers, and a
 * silent truncation is exactly the defect this module exists to remove.
 */
export function appendNote(existingProp: unknown, line: string): { rich_text: RichTextRequest[]; text: string } {
    const elements = richElements(existingProp);
    const kept: RichTextRequest[] = elements.map((e) => e.type === "text" && e.text
        ? { type: "text", text: { content: e.text.content, link: e.text.link ?? null }, ...(e.annotations ? { annotations: e.annotations } : {}) }
        // A mention or equation cannot be written back as it was; its text is kept.
        : { type: "text", text: { content: e.plain_text ?? "" } });
    const existing = elements.map((e) => e.plain_text ?? e.text?.content ?? "").join("");
    const addition = existing ? `\n${line}` : line;
    if (existing.length + addition.length > NOTES_LIMIT) {
        throw new Error(
            `this post's notes are full (${NOTES_LIMIT} characters, the house's limit); `
            + "shorten the note, or ask JJ to tidy the row's notes in Notion",
        );
    }
    return { rich_text: [...kept, { type: "text", text: { content: addition } }], text: existing + addition };
}

function richElements(prop: unknown): RichElement[] {
    const p = prop as { type?: string; rich_text?: RichElement[] } | undefined;
    return p && p.type === "rich_text" && Array.isArray(p.rich_text) ? p.rich_text : [];
}

/** Plain text of a Notion rich_text property, as the house's readProp joins it. */
export function readRichText(prop: unknown): string {
    const p = prop as { type?: string; rich_text?: { plain_text?: string }[] } | undefined;
    if (!p || p.type !== "rich_text" || !Array.isArray(p.rich_text)) return "";
    return p.rich_text.map((t) => t.plain_text ?? "").join("");
}

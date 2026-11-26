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

/** Notion caps one rich_text element at 2,000 characters and a property at 100 elements. */
const CHUNK = 2000;
const MAX_ELEMENTS = 100;
export const NOTE_MAX = 1900;

export interface NoteAuthor {
    /** "JJ", "Diletta" — the name that reads in the row's history. */
    label: string;
}

export type NoteKind = "note" | "ready" | "rework" | "approve" | "reject" | "done" | "delete";

const KIND_TAG: Record<NoteKind, string | null> = {
    note: null,
    ready: "ready for JJ",
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
    const body = defang(text.trim().slice(0, NOTE_MAX));
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

const READY_RE = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · ([^·\]]+) · ready for JJ\]/g;

/** The latest "ready for JJ" mark on a row, if any. */
export function latestReadyMark(notes: string): { at: string; by: string } | null {
    let last: { at: string; by: string } | null = null;
    for (const m of notes.matchAll(READY_RE)) last = { at: m[1], by: m[2].trim() };
    return last;
}

export function toRichText(text: string): { text: { content: string } }[] {
    const out: { text: { content: string } }[] = [];
    for (let i = 0; i < text.length; i += CHUNK) out.push({ text: { content: text.slice(i, i + CHUNK) } });
    return out;
}

/**
 * The new value of a notes property: everything already there, then the
 * new line. Throws rather than trimming: dropping old content would drop
 * the house's markers, and a silent truncation is exactly the defect this
 * module exists to remove.
 */
export function appendNote(existing: string, line: string): { rich_text: { text: { content: string } }[] } {
    const value = existing ? `${existing}\n${line}` : line;
    const rich = toRichText(value);
    if (rich.length > MAX_ELEMENTS) {
        throw new Error("the row's notes are full (Notion limit); archive old notes in Notion before adding more");
    }
    return { rich_text: rich };
}

/** Plain text of a Notion rich_text property, as the house's readProp joins it. */
export function readRichText(prop: unknown): string {
    const p = prop as { type?: string; rich_text?: { plain_text?: string }[] } | undefined;
    if (!p || p.type !== "rich_text" || !Array.isArray(p.rich_text)) return "";
    return p.rich_text.map((t) => t.plain_text ?? "").join("");
}

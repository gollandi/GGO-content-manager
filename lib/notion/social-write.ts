/**
 * Family B write path — Samantha's captions/hashtags on Content Calendar.
 *
 * DELIBERATELY NARROW (defence-in-depth, like the Sanity drafts-only client):
 *  - writes ONLY the Caption and Hashtags properties;
 *  - ONLY on pages that belong to the Content Calendar DB (verified per call);
 *  - never touches Status — scheduling/publication stays JJ's flip in Notion.
 * The Ambrogio DBs remain write-free everywhere (asserted by test).
 */
import { notion } from "./client";
import { notionConfig } from "../config";

export class ForbiddenSocialWriteError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = "ForbiddenSocialWriteError";
    }
}

const norm = (id: string) => id.replace(/-/g, "");

/**
 * Create a NEW Calendar row for a Samantha-proposed post.
 * Status is HARDCODED to "Draft" — scheduling/publication is JJ's flip.
 * sourceUrl carries the source page (PIF traceability via the views).
 */
export async function createCalendarRow(input: {
    topicTitle: string;
    caption: string;
    hashtags: string;
    contentType?: string;
    date?: string; // YYYY-MM-DD proposed slot
    sourceUrl?: string;
}): Promise<string> {
    const properties: Parameters<typeof notion.pages.create>[0]["properties"] = {
        "Topic Title": { title: [{ type: "text", text: { content: input.topicTitle.slice(0, 190) } }] },
        Status: { select: { name: "Draft" } }, // never Scheduled from code
        Caption: { rich_text: [{ type: "text", text: { content: input.caption.slice(0, 1990) } }] },
        Hashtags: { rich_text: [{ type: "text", text: { content: input.hashtags.slice(0, 1990) } }] },
    };
    if (input.contentType) properties["Content Type"] = { select: { name: input.contentType } };
    if (input.date) properties["Date"] = { date: { start: input.date } };
    if (input.sourceUrl) properties["Source URL"] = { url: input.sourceUrl };
    const page = await notion.pages.create({
        parent: { database_id: notionConfig.dbs.contentCalendar() },
        properties,
    });
    return page.id;
}

/** Write caption+hashtags on ONE Calendar row. Fails loudly on anything else. */
export async function writeCalendarCaption(
    pageId: string,
    caption: string,
    hashtags: string
): Promise<void> {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const parent = (page as { parent?: { type?: string; database_id?: string } }).parent;
    const calendarDb = notionConfig.dbs.contentCalendar();
    if (parent?.type !== "database_id" || norm(parent.database_id ?? "") !== norm(calendarDb)) {
        throw new ForbiddenSocialWriteError(
            `Refusing: page ${pageId} is not a Content Calendar row`
        );
    }
    await notion.pages.update({
        page_id: pageId,
        properties: {
            Caption: { rich_text: [{ type: "text", text: { content: caption.slice(0, 1990) } }] },
            Hashtags: { rich_text: [{ type: "text", text: { content: hashtags.slice(0, 1990) } }] },
        },
    });
}

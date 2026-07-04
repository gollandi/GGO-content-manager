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

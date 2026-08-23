import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "./client";
import { notionConfig } from "../config";
import { cached } from "../cache";

/**
 * The morning brief — read-only.
 *
 * ernesto-agents-house's `morning-brief` job rewrites one Notion page at
 * 07:00 every day (decisions awaiting JJ, approved-but-unscheduled topics,
 * production, ingest, Cartografina drift). Until now nothing in the Shell
 * read it: the brief existed, the cockpit showed a different thing (the
 * Claude prose over the Activity Log) and the operator had to open Notion
 * to see what the night had concluded. This module turns the page into
 * Markdown for La Casa di Ernesto. It never writes.
 */

export interface MorningBrief {
    configured: boolean;
    pageId: string | null;
    url: string | null;
    lastEditedAt: string | null;
    markdown: string;
}

const BRIEF_TTL_MS = 5 * 60 * 1000; // the page changes once a day; five minutes is plenty

type RichText = { plain_text?: string; href?: string | null; annotations?: { bold?: boolean; code?: boolean } };

function inline(rich: RichText[] | undefined): string {
    return (rich ?? [])
        .map((t) => {
            let text = t.plain_text ?? "";
            if (!text) return "";
            if (t.annotations?.code) text = `\`${text}\``;
            else if (t.annotations?.bold) text = `**${text}**`;
            if (t.href) text = `[${text}](${t.href})`;
            return text;
        })
        .join("");
}

/** One Notion block → one Markdown line (unknown block types are skipped). */
function blockToMarkdown(block: BlockObjectResponse): string | null {
    const b = block as unknown as Record<string, { rich_text?: RichText[]; checked?: boolean }> & { type: string };
    const body = b[block.type];
    switch (block.type) {
        case "heading_1":
            return `# ${inline(body?.rich_text)}`;
        case "heading_2":
            return `## ${inline(body?.rich_text)}`;
        case "heading_3":
            return `### ${inline(body?.rich_text)}`;
        case "bulleted_list_item":
            return `- ${inline(body?.rich_text)}`;
        case "numbered_list_item":
            return `1. ${inline(body?.rich_text)}`;
        case "to_do":
            return `- [${body?.checked ? "x" : " "}] ${inline(body?.rich_text)}`;
        case "quote":
            return `> ${inline(body?.rich_text)}`;
        case "callout":
            return `> ${inline(body?.rich_text)}`;
        case "paragraph": {
            const text = inline(body?.rich_text);
            return text ? text : "";
        }
        case "divider":
            return "---";
        default:
            return null;
    }
}

async function readBriefUncached(pageId: string): Promise<MorningBrief> {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const lastEditedAt = "last_edited_time" in page ? page.last_edited_time : null;
    const url = "url" in page ? page.url : null;

    const lines: string[] = [];
    let cursor: string | undefined;
    do {
        const res = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
        for (const block of res.results) {
            if (!("type" in block)) continue;
            const line = blockToMarkdown(block as BlockObjectResponse);
            if (line !== null) lines.push(line);
        }
        cursor = res.next_cursor || undefined;
    } while (cursor);

    return { configured: true, pageId, url, lastEditedAt, markdown: lines.join("\n").trim() };
}

/** The current morning brief, or `configured: false` when no page id is set. */
export async function getMorningBrief(): Promise<MorningBrief> {
    const pageId = notionConfig.pages.ernestoBrief();
    if (!pageId) return { configured: false, pageId: null, url: null, lastEditedAt: null, markdown: "" };
    return cached(`ernesto:brief:${pageId}`, () => readBriefUncached(pageId), BRIEF_TTL_MS);
}

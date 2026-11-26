/**
 * Natascia's weekly readings (📊 Natascia Weekly Reports), read-only.
 *
 * One row per week, written by the house on Monday after the Sunday
 * Performance Snapshot ingest; the Friday interpretive slot adds a section
 * to the row's body. The cockpit shows the newest few, properties and body,
 * to the people who plan social work. This module holds no write call.
 */
import type { BlockObjectResponse, PageObjectResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "./client";
import { notionConfig } from "../config";
import { cached } from "../cache";
import { blockToMarkdown } from "./brief";
import * as x from "./extract";

const TTL_MS = 30 * 60 * 1000; // written weekly
/** A body longer than this is cut, and the cut is said. */
const MAX_BODY_CHARS = 12_000;

export interface NatasciaReport {
    id: string;
    title: string;
    weekOf: string | null;
    summary: string;
    editorial: string;
    anomaly: string;
    silentPages: string;
    /** The page body as Markdown (the interpretive section lives here). */
    body: string;
    bodyTruncated: boolean;
    url: string | null;
}

export function mapReport(p: PageObjectResponse, body: string): NatasciaReport {
    const truncated = body.length > MAX_BODY_CHARS;
    return {
        id: p.id,
        title: x.anyTitle(p.properties),
        weekOf: x.date(x.prop(p.properties, "Week Of")),
        summary: x.richText(x.prop(p.properties, "Summary")),
        editorial: x.richText(x.prop(p.properties, "Editorial")),
        anomaly: x.richText(x.prop(p.properties, "Anomaly")),
        silentPages: x.richText(x.prop(p.properties, "Silent Pages")),
        body: truncated ? body.slice(0, MAX_BODY_CHARS) : body,
        bodyTruncated: truncated,
        url: p.url ?? null,
    };
}

async function pageBody(pageId: string): Promise<string> {
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
    return lines.join("\n").trim();
}

async function readUncached(limit: number): Promise<NatasciaReport[]> {
    const res: QueryDatabaseResponse = await notion.databases.query({
        database_id: notionConfig.dbs.natasciaWeeklyReports(),
        sorts: [{ property: "Week Of", direction: "descending" }],
        page_size: limit,
    });
    const pages = res.results.filter((r): r is PageObjectResponse => "properties" in r);
    const out: NatasciaReport[] = [];
    for (const page of pages) out.push(mapReport(page, await pageBody(page.id)));
    return out;
}

/** The newest `limit` weekly readings, newest first. Throws if Notion refuses. */
export function getNatasciaReports(limit = 6): Promise<NatasciaReport[]> {
    return cached(`natascia:weekly:${limit}`, () => readUncached(limit), TTL_MS);
}

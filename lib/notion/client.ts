import { Client } from "@notionhq/client";
import { notionConfig } from "../config";
import { withNotionRetry } from "./fetch-retry";

/**
 * Notion SDK client, configured via the central lib/config.ts (12-factor).
 *
 * Database ids are resolved lazily through notionConfig.dbs — the app boots
 * with only NOTION_API_KEY plus the ids of the DBs a page actually queries.
 * A missing id fails loudly, by name, at query time.
 *
 * Requests go through withNotionRetry: bursts are gated and 429s are retried
 * with backoff instead of surfacing Notion's rate-limit message in the UI.
 */
export const notion = new Client({
    auth: process.env.NOTION_API_KEY,
    fetch: withNotionRetry(fetch),
});

export const isNotionConfigured = () => notionConfig.isConfigured();

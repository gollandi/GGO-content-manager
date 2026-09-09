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
// Next can bundle this module separately for each route. One server process
// must still have one Notion limiter, including the background warm-up.
const shared = globalThis as typeof globalThis & { __ggoNotionClientV1?: Client };
export const notion = shared.__ggoNotionClientV1 ?? new Client({
    auth: process.env.NOTION_API_KEY,
    fetch: withNotionRetry(fetch),
});
if (process.env.NODE_ENV === "production") shared.__ggoNotionClientV1 = notion;

export const isNotionConfigured = () => notionConfig.isConfigured();

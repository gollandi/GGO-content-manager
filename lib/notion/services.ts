import { notion } from "./client";
import { SCHEMA } from "./schema";
import {
    mapContentItem,
    mapPifValidationItem,
    mapEvidenceItem,
    mapKeywordItem,
    mapSchemaValidationItem
} from "./mappers";
import {
    ContentItem,
    PifValidationItem,
    EvidenceItem,
    KeywordItem,
    SchemaValidationItem
} from "./types";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Generic fetcher for Notion databases with mapping
 */
async function fetchAll<T>(
    databaseId: string,
    mapper: (page: PageObjectResponse) => T,
    filter?: any
): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined = undefined;

    do {
        // @ts-ignore - notion.databases.query exists but type inference is failing in this environment
        const response: any = await notion.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
            filter: filter,
        });

        items.push(...(response.results as PageObjectResponse[]).map(mapper));
        cursor = response.next_cursor || undefined;
    } while (cursor);

    return items;
}

/**
 * Content Assets Service
 */
export async function getContentAssets(): Promise<ContentItem[]> {
    return fetchAll(SCHEMA.ContentMaster.databaseId, mapContentItem);
}

/**
 * PIF TICK Compliance Service
 */
export async function getPifValidations(): Promise<PifValidationItem[]> {
    return fetchAll(SCHEMA.PifValidation.databaseId, mapPifValidationItem);
}

/**
 * Evidence Sources Service
 */
export async function getEvidenceSources(): Promise<EvidenceItem[]> {
    return fetchAll(SCHEMA.Evidence.databaseId, mapEvidenceItem);
}

/**
 * Keywords Service
 */
export async function getKeywords(): Promise<KeywordItem[]> {
    return fetchAll(SCHEMA.Keywords.databaseId, mapKeywordItem);
}

/**
 * Schema Validation Service
 */
export async function getSchemaValidations(): Promise<SchemaValidationItem[]> {
    return fetchAll(SCHEMA.SchemaValidation.databaseId, mapSchemaValidationItem);
}

/**
 * Single Item Fetchers
 */
export async function getContentAsset(id: string): Promise<ContentItem> {
    const response = await notion.pages.retrieve({ page_id: id });
    return mapContentItem(response as PageObjectResponse);
}

export async function getPifValidation(id: string): Promise<PifValidationItem> {
    const response = await notion.pages.retrieve({ page_id: id });
    return mapPifValidationItem(response as PageObjectResponse);
}

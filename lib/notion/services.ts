import { notion } from "./client";
import { SCHEMA } from "./schema";
import {
    mapContentItem,
    mapPifValidationItem,
    mapEvidenceItem,
    mapKeywordItem,
    mapSchemaValidationItem,
    mapPatientJourneyItem
} from "./mappers";
import {
    ContentItem,
    PifValidationItem,
    EvidenceItem,
    KeywordItem,
    SchemaValidationItem,
    PatientJourneyItem
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
        // @ts-ignore - notion.databases.query exists in 2.2.3
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
 * Joins PIF validations with related Content Asset metadata
 */
export async function getPifValidations(): Promise<PifValidationItem[]> {
    const validations = await fetchAll(SCHEMA.PifValidation.databaseId, mapPifValidationItem);

    // Get unique related content IDs
    const contentIds = Array.from(new Set(validations.map(v => v.contentAssetId).filter(id => !!id))) as string[];

    if (contentIds.length === 0) return validations;

    // Fetch related content assets 
    // Instead of making N parallel requests, fetch all assets natively to save API limits & prevent timeouts
    const contentAssets = await getContentAssets();
    const assetMap = new Map(contentAssets.map(a => [a.id, a]));

    // Merge data
    return validations.map(v => {
        if (v.contentAssetId && assetMap.has(v.contentAssetId)) {
            const asset = assetMap.get(v.contentAssetId)!;
            return {
                ...v,
                contentAssetTitle: asset.title,
                contentAssetUrl: asset.liveUrl || undefined,
                contentAssetNotes: asset.notes
            };
        }
        return v;
    });
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
 * Patient Journeys Service
 */
export async function getPatientJourneys(): Promise<PatientJourneyItem[]> {
    return fetchAll(SCHEMA.PatientJourneys.databaseId, mapPatientJourneyItem);
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

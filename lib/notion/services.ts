import { notion } from "./client";
import { SCHEMA } from "./schema";
import {
    mapContentItem,
    mapPifValidationItem,
    mapEvidenceItem,
    mapKeywordItem,
    mapSchemaValidationItem,
    mapPatientJourneyItem,
    mapFeedbackItem,
    mapAnnualReviewLogItem,
    mapContentRequestItem
} from "./mappers";
import {
    ContentItem,
    PifValidationItem,
    EvidenceItem,
    KeywordItem,
    SchemaValidationItem,
    PatientJourneyItem,
    FeedbackItem,
    AnnualReviewLogItem,
    ContentRequestItem
} from "./types";
import { PageObjectResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { cached } from "../cache";

/** Notion filter type — matches the SDK's accepted filter shapes */
type NotionFilter = Parameters<typeof notion.databases.query>[0] extends { filter?: infer F } ? F : never;

/**
 * Generic fetcher for Notion databases with mapping
 */
async function fetchAll<T>(
    databaseId: string,
    mapper: (page: PageObjectResponse) => T,
    filter?: NotionFilter
): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined = undefined;

    do {
        const response: QueryDatabaseResponse = await notion.databases.query({
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
 * Joins PIF validations with related Content Asset metadata.
 * Reuses cached content assets to avoid redundant Notion API calls.
 */
export async function getPifValidations(): Promise<PifValidationItem[]> {
    const validations = await fetchAll(SCHEMA.PifValidation.databaseId, mapPifValidationItem);

    // Get unique related content IDs
    const contentIds = Array.from(new Set(validations.map(v => v.contentAssetId).filter(id => !!id))) as string[];

    if (contentIds.length === 0) return validations;

    // Reuse cached content assets instead of making a fresh Notion call
    const contentAssets = await cached("content", () =>
        fetchAll(SCHEMA.ContentMaster.databaseId, mapContentItem)
    );
    const assetMap = new Map(contentAssets.map(a => [a.id, a]));

    // Merge data with safe fallbacks for missing joins
    return validations.map(v => {
        if (v.contentAssetId) {
            const asset = assetMap.get(v.contentAssetId);
            return {
                ...v,
                contentAssetTitle: asset?.title ?? "Unknown Asset",
                contentAssetUrl: asset?.liveUrl || undefined,
                contentAssetNotes: asset?.notes ?? "",
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
 * Stakeholder Feedback Service
 * Joins feedback with related Content Asset titles for display.
 */
export async function getFeedback(): Promise<FeedbackItem[]> {
    const feedback = await fetchAll(SCHEMA.StakeholderFeedback.databaseId, mapFeedbackItem);

    // Collect related content IDs for joining
    const allContentIds = Array.from(
        new Set(feedback.flatMap((f) => f.relatedContentIds))
    );

    if (allContentIds.length === 0) return feedback;

    // Reuse cached content assets to avoid redundant fetches
    const contentAssets = await cached("content", () =>
        fetchAll(SCHEMA.ContentMaster.databaseId, mapContentItem)
    );
    const assetMap = new Map(contentAssets.map((a) => [a.id, a]));

    return feedback.map((f) => ({
        ...f,
        relatedContentTitles: f.relatedContentIds
            .map((id) => assetMap.get(id)?.title)
            .filter((t): t is string => !!t),
    }));
}

/**
 * Content Requests Service
 * Joins requests with Resulting Content titles for display.
 */
export async function getContentRequests(): Promise<ContentRequestItem[]> {
    const requests = await fetchAll(SCHEMA.ContentRequests.databaseId, mapContentRequestItem);

    const allContentIds = Array.from(
        new Set(requests.flatMap((r) => r.resultingContentIds))
    );

    if (allContentIds.length === 0) return requests;

    const contentAssets = await cached("content", () =>
        fetchAll(SCHEMA.ContentMaster.databaseId, mapContentItem)
    );
    const assetMap = new Map(contentAssets.map((a) => [a.id, a]));

    return requests.map((r) => ({
        ...r,
        resultingContentTitles: r.resultingContentIds
            .map((id) => assetMap.get(id)?.title)
            .filter((t): t is string => !!t),
    }));
}

/**
 * Annual Review Log Service
 * Returns all 21 PIF TICK criterion rows for the requested cycle (defaults to current FY).
 */
export async function getAnnualReviewLog(): Promise<AnnualReviewLogItem[]> {
    return fetchAll(SCHEMA.AnnualReviewLog.databaseId, mapAnnualReviewLogItem);
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

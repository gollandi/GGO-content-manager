/**
 * Editorial workflow state — the Notion tier of the optimised hybrid
 * (spec §2.1: Notion is truth for workflow state; read via SDK).
 *
 * Property names are verified against ernesto-agents-house
 * docs/notion-databases.md (live-schema audit of 2026-04-17) — NOT invented.
 * Env var names match ernesto's .env.example verbatim.
 *
 * READ-ONLY: this module holds no create/update/append call, by design.
 * The Ambrogio DBs in particular must never gain a write path here
 * (independence by construction — spec §3 Module 4; asserted by test).
 */
import { PageObjectResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "./client";
import { notionConfig } from "../config";
import { cached } from "../cache";
import * as x from "./extract";

const EDITORIAL_TTL_MS = 5 * 60 * 1000; // workflow state moves daily, not weekly

async function fetchAllPages(databaseId: string): Promise<PageObjectResponse[]> {
    const pages: PageObjectResponse[] = [];
    let cursor: string | undefined = undefined;
    do {
        const response: QueryDatabaseResponse = await notion.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
        });
        pages.push(...(response.results as PageObjectResponse[]));
        cursor = response.next_cursor || undefined;
    } while (cursor);
    return pages;
}

// ── Row types ────────────────────────────────────────────────────────────────

export interface CalendarRow {
    id: string;
    topicTitle: string;
    status: string | null; // Draft/In Production/Review/Scheduled/Published/Archived/Blocked
    assetStatus: string | null;
    date: string | null;
    contentType: string | null;
    sourceUrl: string | null;
    sanitySync: string; // Sanity _id once synced; empty = not yet
    syncedAt: string | null;
    topicIds: string[];
    mediaAssetIds: string[];
}

export interface TopicPoolRow {
    id: string;
    title: string;
    status: string | null; // New/Approved/Scheduled
    cluster: string | null;
    urgency: string | null;
    seoPriority: string | null;
    source: string | null;
    addedBy: string | null;
    sourceUrl: string | null;
    angle: string;
}

export interface DeskRow {
    id: string;
    item: string;
    type: string | null;
    status: string | null; // Pending/Approved/Rejected/In production/Done
    priority: string | null;
    due: string | null;
    creditsEstimate: number | null;
    decidedAt: string | null;
}

export interface PublishQueueRow {
    id: string;
    title: string;
    platform: string | null;
    format: string | null;
    publishedAt: string | null;
    externalLink: string | null;
    captionSnippet: string;
    sanityId: string;
    creationMode: string | null;
    status: string | null;
}

export interface NewsletterItemRow {
    id: string;
    title: string;
    status: string | null; // status-type: Draft/Ready
    relatedAssetIds: string[];
}

export interface MediaAssetRow {
    id: string;
    title: string;
    status: string | null;
    assetType: string | null;
    format: string | null;
    roll: string | null;
    sourceSkill: string | null;
    shootingDate: string | null;
    fileLocation: string | null;
    calendarIds: string[];
}

export interface ContentNeedRow {
    id: string;
    need: string;
    source: string | null;
    actionStatus: string | null; // status-type: To do/In progress/Done/Blocked
    details: string;
    contentAssetIds: string[];
    /** Impact loop (PIF "measuring impact"): success defined at intake,
     *  outcome verified at review — JJ's verdict, evidence from Feedback. */
    successDefinition: string;
    impactReviewDate: string | null;
    impactOutcome: string | null; // Pending/Achieved/Partially achieved/Not achieved
    impactEvidence: string;
}

export interface ActivityLogRow {
    id: string;
    run: string;
    job: string | null;
    status: string | null; // Success/Failed/Partial/Disabled
    startedAt: string | null;
    durationMs: number | null;
    rowsWritten: number | null;
    errors: number | null;
    summary: string;
    errorMessage: string;
    triggeredBy: string | null;
}

export interface AmbrogioProposalRow {
    id: string;
    proposal: string;
    type: string | null;
    severity: string | null;
    estimatedComplexity: string | null;
    affects: string[];
    decision: string | null; // JJ-only axis
    applied: boolean; // Battista-only axis
    motivation: string;
    actionPlan: string;
    createdAt: string | null;
    decidedAt: string | null;
}

/**
 * Cache-tier shim (spec S1.7, honest Phase-1 scope): GA4 / Search Console
 * metrics read from their existing Notion-resident rows (written weekly by
 * ernesto's ingesters). The cache tier OWNING this data directly from the
 * external APIs is Phase 2 — this is a read shim, not the third tier.
 */
export interface PerformanceSnapshotRow {
    id: string;
    title: string;
    channel: string | null;
    weekOf: string | null;
    source: string | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    averagePosition: number | null;
    sessions: number | null;
    engagementRate: number | null;
    assetIds: string[];
}

/** Audits DB has no verified property catalogue — mapped schema-tolerantly. */
export interface AmbrogioAuditRow {
    id: string;
    title: string;
    lastEdited: string;
    /** Every scalar property, by its live Notion name. */
    fields: Record<string, string>;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

const mapCalendar = (p: PageObjectResponse): CalendarRow => ({
    id: p.id,
    topicTitle: x.anyTitle(p.properties),
    status: x.selectOrStatus(x.prop(p.properties, "Status")),
    assetStatus: x.select(x.prop(p.properties, "Asset Status")),
    date: x.date(x.prop(p.properties, "Date")),
    contentType: x.select(x.prop(p.properties, "Content Type")),
    sourceUrl: x.url(x.prop(p.properties, "Source URL")),
    sanitySync: x.richText(x.prop(p.properties, "Sanity Sync")),
    syncedAt: x.date(x.prop(p.properties, "Synced At")),
    topicIds: x.relationIds(x.prop(p.properties, "Topic")),
    mediaAssetIds: x.relationIds(x.prop(p.properties, "Media Assets")),
});

const mapTopicPool = (p: PageObjectResponse): TopicPoolRow => ({
    id: p.id,
    title: x.anyTitle(p.properties),
    status: x.select(x.prop(p.properties, "Status")),
    cluster: x.select(x.prop(p.properties, "Cluster")),
    urgency: x.select(x.prop(p.properties, "Urgency")),
    seoPriority: x.select(x.prop(p.properties, "SEO Priority")),
    source: x.select(x.prop(p.properties, "Source")),
    addedBy: x.select(x.prop(p.properties, "Added By")),
    sourceUrl: x.url(x.prop(p.properties, "Source URL")),
    angle: x.richText(x.prop(p.properties, "Angle")),
});

const mapDesk = (p: PageObjectResponse): DeskRow => ({
    id: p.id,
    item: x.anyTitle(p.properties),
    type: x.select(x.prop(p.properties, "Type")),
    status: x.select(x.prop(p.properties, "Status")),
    priority: x.select(x.prop(p.properties, "Priority")),
    due: x.date(x.prop(p.properties, "Due")),
    creditsEstimate: x.number(x.prop(p.properties, "Credits Estimate")),
    decidedAt: x.date(x.prop(p.properties, "Decided At")),
});

const mapPublishQueue = (p: PageObjectResponse): PublishQueueRow => ({
    id: p.id,
    title: x.anyTitle(p.properties),
    platform: x.select(x.prop(p.properties, "Platform")),
    format: x.select(x.prop(p.properties, "Format")),
    publishedAt: x.date(x.prop(p.properties, "Published At")),
    externalLink: x.url(x.prop(p.properties, "External Link")),
    captionSnippet: x.richText(x.prop(p.properties, "Caption Snippet")),
    sanityId: x.richText(x.prop(p.properties, "Sanity ID")),
    creationMode: x.select(x.prop(p.properties, "Creation Mode")),
    status: x.selectOrStatus(x.prop(p.properties, "Status")),
});

const mapNewsletterItem = (p: PageObjectResponse): NewsletterItemRow => ({
    id: p.id,
    title: x.anyTitle(p.properties),
    status: x.status(x.prop(p.properties, "Status")), // status-type, verified
    relatedAssetIds: x.relationIds(x.prop(p.properties, "Related Asset")),
});

const mapMediaAsset = (p: PageObjectResponse): MediaAssetRow => ({
    id: p.id,
    title: x.anyTitle(p.properties),
    status: x.select(x.prop(p.properties, "Status")),
    assetType: x.select(x.prop(p.properties, "Asset Type")),
    format: x.select(x.prop(p.properties, "Format")),
    roll: x.select(x.prop(p.properties, "Roll")),
    sourceSkill: x.select(x.prop(p.properties, "Source Skill")),
    shootingDate: x.date(x.prop(p.properties, "Shooting Date")),
    fileLocation: x.url(x.prop(p.properties, "File Location")),
    calendarIds: x.relationIds(x.prop(p.properties, "Calendar")),
});

const mapContentNeed = (p: PageObjectResponse): ContentNeedRow => ({
    id: p.id,
    need: x.anyTitle(p.properties),
    source: x.select(x.prop(p.properties, "Source")),
    actionStatus: x.status(x.prop(p.properties, "Action Status")), // status-type, verified
    details: x.richText(x.prop(p.properties, "Details")),
    contentAssetIds: x.relationIds(x.prop(p.properties, "Content Assets")),
    successDefinition: x.richText(x.prop(p.properties, "Success Definition")),
    impactReviewDate: x.date(x.prop(p.properties, "Impact Review Date")),
    impactOutcome: x.select(x.prop(p.properties, "Impact Outcome")),
    impactEvidence: x.richText(x.prop(p.properties, "Impact Evidence")),
});

const mapPerformanceSnapshot = (p: PageObjectResponse): PerformanceSnapshotRow => ({
    id: p.id,
    title: x.anyTitle(p.properties),
    channel: x.select(x.prop(p.properties, "Channel")),
    weekOf: x.date(x.prop(p.properties, "Week Of")),
    source: x.select(x.prop(p.properties, "Source")),
    impressions: x.number(x.prop(p.properties, "Impressions")),
    clicks: x.number(x.prop(p.properties, "Clicks")),
    ctr: x.number(x.prop(p.properties, "CTR")),
    averagePosition: x.number(x.prop(p.properties, "Average Position")),
    sessions: x.number(x.prop(p.properties, "Sessions")),
    engagementRate: x.number(x.prop(p.properties, "Engagement Rate")),
    assetIds: x.relationIds(x.prop(p.properties, "Asset")),
});

const mapActivityLog = (p: PageObjectResponse): ActivityLogRow => ({
    id: p.id,
    run: x.anyTitle(p.properties),
    job: x.select(x.prop(p.properties, "Job")),
    status: x.select(x.prop(p.properties, "Status")),
    startedAt: x.date(x.prop(p.properties, "Started At")),
    durationMs: x.number(x.prop(p.properties, "Duration (ms)")),
    rowsWritten: x.number(x.prop(p.properties, "Rows Written")),
    errors: x.number(x.prop(p.properties, "Errors")),
    summary: x.richText(x.prop(p.properties, "Summary")),
    errorMessage: x.richText(x.prop(p.properties, "Error Message")),
    triggeredBy: x.select(x.prop(p.properties, "Triggered By")),
});

const mapAmbrogioProposal = (p: PageObjectResponse): AmbrogioProposalRow => ({
    id: p.id,
    proposal: x.anyTitle(p.properties),
    type: x.select(x.prop(p.properties, "Type")),
    severity: x.select(x.prop(p.properties, "Severity")),
    estimatedComplexity: x.select(x.prop(p.properties, "Estimated Complexity")),
    affects: x.multiSelect(x.prop(p.properties, "Affects")),
    decision: x.select(x.prop(p.properties, "Decision")),
    applied: x.checkbox(x.prop(p.properties, "Applied")),
    motivation: x.richText(x.prop(p.properties, "Motivation")),
    actionPlan: x.richText(x.prop(p.properties, "Action Plan")),
    createdAt: x.date(x.prop(p.properties, "Created At")),
    decidedAt: x.date(x.prop(p.properties, "Decided At")),
});

/** Schema-tolerant: extract every scalar without assuming property names. */
const mapAmbrogioAudit = (p: PageObjectResponse): AmbrogioAuditRow => {
    const fields: Record<string, string> = {};
    for (const [name, prop] of Object.entries(p.properties)) {
        if (prop.type === "title") continue;
        const value =
            x.select(prop) ??
            x.status(prop) ??
            (x.date(prop) || null) ??
            (x.richText(prop) || null) ??
            (x.formulaString(prop) || null) ??
            (prop.type === "checkbox" ? String(prop.checkbox) : null) ??
            (prop.type === "number" && prop.number !== null
                ? String(prop.number)
                : null);
        if (value) fields[name] = value;
    }
    return {
        id: p.id,
        title: x.anyTitle(p.properties),
        lastEdited: p.last_edited_time,
        fields,
    };
};

// ── Services (cached, read-only) ─────────────────────────────────────────────

const service =
    <T>(key: string, dbId: () => string, mapper: (p: PageObjectResponse) => T) =>
    (): Promise<T[]> =>
        cached(
            `editorial:${key}`,
            async () => (await fetchAllPages(dbId())).map(mapper),
            EDITORIAL_TTL_MS
        );

export const getContentCalendar = service("calendar", notionConfig.dbs.contentCalendar, mapCalendar);
export const getTopicPool = service("topic-pool", notionConfig.dbs.topicPool, mapTopicPool);
export const getErnestoDesk = service("desk", notionConfig.dbs.ernestoDesk, mapDesk);
export const getPublishQueue = service("publish-queue", notionConfig.dbs.publishQueue, mapPublishQueue);
export const getNewsletterItems = service("newsletter", notionConfig.dbs.newsletterItems, mapNewsletterItem);
export const getMediaAssets = service("media-assets", notionConfig.dbs.mediaAssets, mapMediaAsset);
export const getContentNeeds = service("content-needs", notionConfig.dbs.contentNeeds, mapContentNeed);
export const getAgentsActivityLog = service("activity-log", notionConfig.dbs.agentsActivityLog, mapActivityLog);
export const getPerformanceSnapshot = service("performance-snapshot", notionConfig.dbs.performanceSnapshot, mapPerformanceSnapshot);
export const getAmbrogioProposals = service("ambrogio-proposals", notionConfig.dbs.ambrogioProposals, mapAmbrogioProposal);
export const getAmbrogioAudits = service("ambrogio-audits", notionConfig.dbs.ambrogioAudits, mapAmbrogioAudit);

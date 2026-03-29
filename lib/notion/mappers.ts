import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { SCHEMA } from "./schema";
import {
    ContentItem,
    PifValidationItem,
    EvidenceItem,
    KeywordItem,
    SchemaValidationItem,
    PatientJourneyItem,
    ContentType,
    ContentStatus
} from "./types";

// Helper to safely extract property values
const getProp = (props: any, key: string) => props[key];

// Extractors
const extractTitle = (prop: any): string => prop?.title?.[0]?.plain_text ?? "Untitled";
const extractRichText = (prop: any): string => prop?.rich_text?.[0]?.plain_text ?? "";
const extractSelect = (prop: any): string | null => prop?.select?.name ?? null;
const extractMultiSelect = (prop: any): string[] => prop?.multi_select?.map((o: any) => o.name) ?? [];
const extractDate = (prop: any): string | null => prop?.date?.start ?? null; // ISO string
const extractCheckbox = (prop: any): boolean => prop?.checkbox ?? false;
const extractUrl = (prop: any): string | null => prop?.url ?? null;
const extractNumber = (prop: any): number | null => prop?.number ?? null;
const extractRelation = (prop: any): string[] => prop?.relation?.map((r: any) => r.id) ?? [];
const extractPeople = (prop: any): string[] => prop?.people?.map((p: any) => p.name) ?? [];

export function mapContentItem(page: PageObjectResponse): ContentItem {
    const props = page.properties;
    const S = SCHEMA.ContentMaster;

    return {
        id: page.id,
        title: extractTitle(getProp(props, S.title)),
        contentType: (extractSelect(getProp(props, S.contentType)) as ContentType) || "General Info",
        status: (extractSelect(getProp(props, S.status)) as ContentStatus) || "📝 Draft",
        slug: extractRichText(getProp(props, S.slug)),
        lastReviewed: extractDate(getProp(props, S.lastReviewed)),
        reviewedBy: extractPeople(getProp(props, S.reviewedBy)),
        metaTitle: extractRichText(getProp(props, S.metaTitle)),
        metaDescription: extractRichText(getProp(props, S.metaDescription)),

        pifReviewIds: extractRelation(getProp(props, S.pifReviews)),
        evidenceSourceIds: extractRelation(getProp(props, S.evidenceSources)),
        schemaValidationIds: extractRelation(getProp(props, S.schemaValidation)),
        parentPageId: extractRelation(getProp(props, S.parentPage))[0] ?? null,

        platform: extractMultiSelect(getProp(props, S.platform)),
        pathway: extractMultiSelect(getProp(props, S.pathway)),
        interactiveElements: extractMultiSelect(getProp(props, S.interactiveElements)),
        transcriptStatus: extractSelect(getProp(props, S.transcriptStatus)),
        contentLocation: extractSelect(getProp(props, S.contentLocation)),
        ctaQuality: extractSelect(getProp(props, S.ctaQuality)),
        toneScore: extractSelect(getProp(props, S.toneScore)),
        duration: extractRichText(getProp(props, S.duration)),
        hasDisclaimer: extractCheckbox(getProp(props, S.hasDisclaimer)),
        youtubeId: extractRichText(getProp(props, S.youtubeId)),
        liveUrl: extractUrl(getProp(props, S.liveUrl)),
        sanityId: extractRichText(getProp(props, S.sanityId)),
        notes: extractRichText(getProp(props, S.notes)),

        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
    };
}

export function mapPifValidationItem(page: PageObjectResponse): PifValidationItem {
    const props = page.properties;
    const S = SCHEMA.PifValidation;

    // Handle the formula field safely (String formula)
    const pifStatusFormula = getProp(props, S.pifTickStatus);
    const pifStatus = pifStatusFormula?.formula?.string || "❌ NO";

    return {
        id: page.id,
        title: extractTitle(getProp(props, S.title)),
        status: pifStatus as "✅ YES" | "❌ NO",
        reviewDate: extractDate(getProp(props, S.reviewDate)),
        reviewer: extractPeople(getProp(props, S.reviewer)),

        evidenceBasedReview: extractCheckbox(getProp(props, S.evidenceBasedReview)),
        contentNeedDocumented: extractCheckbox(getProp(props, S.contentNeedDocumented)),
        patientReadability: extractCheckbox(getProp(props, S.patientReadability)),
        inclusivityAssessment: extractCheckbox(getProp(props, S.inclusivityAssessment)),
        expertPeerReview: extractCheckbox(getProp(props, S.expertPeerReview)),
        pifTickDeclaration: extractCheckbox(getProp(props, S.pifTickDeclaration)),

        readabilityTier1: extractNumber(getProp(props, S.readabilityTier1)),
        readabilityTier2: extractNumber(getProp(props, S.readabilityTier2)),

        contentAssetId: extractRelation(getProp(props, S.contentAsset))[0] ?? null,
        evidenceSourceIds: extractRelation(getProp(props, S.evidenceSourcesUsed)),

        automationLog: extractRichText(getProp(props, S.automationLog)),
        llmProvisionalResult: extractSelect(getProp(props, S.llmProvisionalResult)),
        patientInvolvementActions: extractRichText(getProp(props, S.patientInvolvementActions)),
        patientInvolvementMethod: extractSelect(getProp(props, S.patientInvolvementMethod)),
        patientInvolvementSampleSize: extractNumber(getProp(props, S.patientInvolvementSampleSize)),
        complianceMismatch: extractCheckbox(getProp(props, S.complianceMismatch)),
        patientInvolvementDone: extractCheckbox(getProp(props, S.patientInvolvementDone)),
        bannerAllowed: getProp(props, S.bannerAllowed)?.formula?.string || null,
        inclusivityNotes: extractRichText(getProp(props, S.inclusivityNotes)),
        contentNeedNotes: extractRichText(getProp(props, S.contentNeedNotes)),
        patientInvolvementOutput: extractRichText(getProp(props, S.patientInvolvementOutput)),

        createdTime: page.created_time,
    };
}

export function mapEvidenceItem(page: PageObjectResponse): EvidenceItem {
    const props = page.properties;
    const S = SCHEMA.Evidence;

    return {
        id: page.id,
        title: extractTitle(getProp(props, S.title)),
        organisation: extractSelect(getProp(props, S.organisation)),
        url: extractUrl(getProp(props, S.url)),
        lastUpdated: extractDate(getProp(props, S.lastUpdated)),
        datePublished: extractDate(getProp(props, S.datePublished)),
        currencyStatus: extractSelect(getProp(props, S.currencyStatus)),
        topicsCovered: extractMultiSelect(getProp(props, S.topicsCovered)),
        guidelineCode: extractRichText(getProp(props, S.guidelineCode)),
        notes: extractRichText(getProp(props, S.notes)),

        contentAssetIds: extractRelation(getProp(props, S.contentAssets)),

        createdTime: page.created_time,
    };
}

export function mapKeywordItem(page: PageObjectResponse): KeywordItem {
    const props = page.properties;
    const S = SCHEMA.Keywords;

    return {
        id: page.id,
        keyword: extractTitle(getProp(props, S.keyword)),
        volume: extractNumber(getProp(props, S.volume)),
        searchVolume: extractNumber(getProp(props, S.searchVolume)),
        difficulty: extractNumber(getProp(props, S.difficulty)),
        intent: extractMultiSelect(getProp(props, S.intent)),
        currentRanking: extractNumber(getProp(props, S.currentRanking)),
        positionChange: extractNumber(getProp(props, S.positionChange)),
        traffic: extractNumber(getProp(props, S.traffic)),
        cpc: extractNumber(getProp(props, S.cpc)),
        competitiveDensity: extractNumber(getProp(props, S.competitiveDensity)),
        trend: extractRichText(getProp(props, S.trend)),
        serpFeatures: extractMultiSelect(getProp(props, S.serpFeatures)),
        lastUpdated: extractDate(getProp(props, S.lastUpdated)),
        lastSemrushUpdate: extractDate(getProp(props, S.lastSemrushUpdate)),
        semrushUrl: extractUrl(getProp(props, S.semrushUrl)),
        notes: extractRichText(getProp(props, S.notes)),

        contentAssetIds: extractRelation(getProp(props, S.contentAssets)),

        createdTime: page.created_time,
    };
}

export function mapPatientJourneyItem(page: PageObjectResponse): PatientJourneyItem {
    const props = page.properties;
    const S = SCHEMA.PatientJourneys;

    return {
        id: page.id,
        patientLanguage: extractTitle(getProp(props, S.patientLanguage)),
        exampleQuestion: extractRichText(getProp(props, S.exampleQuestion)),
        journeyStage: extractSelect(getProp(props, S.journeyStage)),
        urgency: extractSelect(getProp(props, S.urgency)),
        pathway: extractSelect(getProp(props, S.pathway)),
        medicalTerms: extractRichText(getProp(props, S.medicalTerms)),
        contentAssetIds: extractRelation(getProp(props, S.contentAssets)),
        notes: extractRichText(getProp(props, S.notes)),
        createdTime: page.created_time,
    };
}

export function mapSchemaValidationItem(page: PageObjectResponse): SchemaValidationItem {
    const props = page.properties;
    const S = SCHEMA.SchemaValidation;

    return {
        id: page.id,
        name: extractTitle(getProp(props, S.title)),
        slug: extractRichText(getProp(props, S.slug)),
        relatedConditions: extractRichText(getProp(props, S.relatedConditions)),
        schemaType: extractMultiSelect(getProp(props, S.schemaType)),
        hasFaq: extractCheckbox(getProp(props, S.hasFaq)),
        validated: extractCheckbox(getProp(props, S.validated)),
        relatedProcedures: extractRichText(getProp(props, S.relatedProcedures)),
        validationErrors: extractNumber(getProp(props, S.validationErrors)),
        validationWarnings: extractNumber(getProp(props, S.validationWarnings)),
        faqCount: extractNumber(getProp(props, S.faqCount)),
        parentPage: extractRichText(getProp(props, S.parentPage)),
        contentAssetIds: extractRelation(getProp(props, S.contentAssets)),
        url: extractUrl(getProp(props, S.url)),
        pageType: extractSelect(getProp(props, S.pageType)),
        breadcrumbs: extractRichText(getProp(props, S.breadcrumbs)),
        lastReviewed: extractDate(getProp(props, S.lastReviewed)),
        dateModified: extractDate(getProp(props, S.dateModified)),
        mainEntity: extractRichText(getProp(props, S.mainEntity)),
        datePublished: extractDate(getProp(props, S.datePublished)),
        jsonLdRaw: extractRichText(getProp(props, S.jsonLdRaw)),
        faqsSchemaTypes: extractMultiSelect(getProp(props, S.faqsSchemaTypes)),
        notes: extractRichText(getProp(props, S.notes)),

        createdTime: page.created_time,
    };
}

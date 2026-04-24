export type ContentType =
    | "Condition"
    | "Surgery/Procedure"
    | "Test/Diagnostic"
    | "Treatment"
    | "General Info";

export type ContentStatus =
    | "📝 Draft"
    | "👁️ Review"
    | "✅ Live"
    | "⚠️ Needs Update"
    | "🗑️ Archived"
    | "🔧 To Create"
    | "🔹 Section"
    | "Live";

export interface ContentItem {
    id: string;
    title: string;
    contentType: ContentType;
    status: ContentStatus;
    slug: string;
    lastReviewed: string | null;
    reviewedBy: string[]; // List of names
    metaDescription: string;
    metaTitle: string;

    // Relations (Ids)
    pifReviewIds: string[];
    evidenceSourceIds: string[];
    schemaValidationIds: string[];
    parentPageId: string | null;

    // Other
    platform: string[];
    pathway: string[];
    interactiveElements: string[];
    transcriptStatus: string | null;
    contentLocation: string | null;
    ctaQuality: string | null;
    toneScore: string | null;
    duration: string | null;
    hasDisclaimer: boolean;
    youtubeId: string;
    liveUrl: string | null;
    sanityId: string;
    notes: string;

    createdTime: string;
    lastEditedTime: string;
}

export interface PifValidationItem {
    id: string;
    title: string;
    status: "✅ YES" | "❌ NO";
    reviewDate: string | null;
    reviewer: string[];

    // Checklist
    evidenceBasedReview: boolean;
    contentNeedDocumented: boolean;
    patientReadability: boolean;
    inclusivityAssessment: boolean;
    expertPeerReview: boolean;
    pifTickDeclaration: boolean;

    readabilityTier1: number | null;
    readabilityTier2: number | null;

    // Relations
    contentAssetId: string | null;
    evidenceSourceIds: string[];

    // New joined fields
    contentAssetTitle?: string;
    contentAssetUrl?: string;
    contentAssetNotes?: string;

    automationLog: string;
    llmProvisionalResult: string | null;
    patientInvolvementActions: string;
    patientInvolvementMethod: string | null;
    patientInvolvementSampleSize: number | null;
    complianceMismatch: boolean;
    patientInvolvementDone: boolean;
    bannerAllowed: string | null;
    inclusivityNotes: string;
    contentNeedNotes: string;
    patientInvolvementOutput: string;

    createdTime: string;
}

export interface EvidenceItem {
    id: string;
    title: string;
    organisation: string | null;
    url: string | null;
    lastUpdated: string | null;
    datePublished: string | null;
    currencyStatus: string | null;
    topicsCovered: string[];
    guidelineCode: string;
    notes: string;

    contentAssetIds: string[];

    createdTime: string;
}

export interface KeywordItem {
    id: string;
    keyword: string;
    volume: number | null;
    searchVolume: number | null;
    difficulty: number | null;
    intent: string[];
    currentRanking: number | null;
    positionChange: number | null;
    traffic: number | null;
    cpc: number | null;
    competitiveDensity: number | null;
    trend: string;
    serpFeatures: string[];
    lastUpdated: string | null;
    lastSemrushUpdate: string | null;
    semrushUrl: string | null;
    notes: string;

    contentAssetIds: string[];

    createdTime: string;
}

export interface PatientJourneyItem {
    id: string;
    patientLanguage: string;
    exampleQuestion: string;
    journeyStage: string | null;
    urgency: string | null;
    pathway: string | null;
    medicalTerms: string;
    contentAssetIds: string[];
    notes: string;
    createdTime: string;
}

export type FeedbackType = "Patient" | "Expert" | "Clinician" | "Public";
export type FeedbackActionStatus = "Not Started" | "In Progress" | "Completed";

export interface FeedbackItem {
    id: string;
    feedbackId: string;
    feedbackType: FeedbackType | null;
    feedbackDate: string | null;
    feedbackSummary: string;
    relatedContentIds: string[];
    actionRequired: boolean;
    actionStatus: FeedbackActionStatus | null;
    actionOwner: string[];
    actionTaken: string;

    // Joined fields (populated by services)
    relatedContentTitles?: string[];

    createdTime: string;
}

export interface SchemaValidationItem {
    id: string;
    name: string;
    slug: string;
    relatedConditions: string;
    schemaType: string[];
    hasFaq: boolean;
    validated: boolean;
    relatedProcedures: string;
    validationErrors: number | null;
    validationWarnings: number | null;
    faqCount: number | null;
    parentPage: string;
    contentAssetIds: string[];
    url: string | null;
    pageType: string | null;
    breadcrumbs: string;
    lastReviewed: string | null;
    dateModified: string | null;
    mainEntity: string;
    datePublished: string | null;
    jsonLdRaw: string;
    faqsSchemaTypes: string[];
    notes: string;

    createdTime: string;
}

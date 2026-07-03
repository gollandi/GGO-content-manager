/**
 * Row shapes returned by the named GROQ views (lib/views).
 * These are the contract consumed by the cockpit UI, the HTTP view API,
 * and (Phase 3) the editorial skills.
 */

/** The four GGOMed doc types that carry PIF + editorial metadata. */
export type GgomedDocType =
    | "dedicatedPage"
    | "categoryHubPage"
    | "blogPost"
    | "legalPage";

export interface EditorialContentRow {
    _id: string;
    _type: GgomedDocType;
    _updatedAt: string;
    title: string | null;
    slug: string | null;
    /** Site pathname — /{slug}, blogPost → /blog/{slug} (per app/sitemap.ts). */
    pathname: string | null;
    category: string | null;
    lastReviewed: string | null;
    publishDate: string | null;
    showPifTick: boolean;
    noIndex: boolean;
}

/** The single join surface for asset identity (spec §5.5). */
export interface AssetIdentityRow {
    pathname: string;
    sanity_id: string;
    title: string | null;
}

/** GGOMed PIF assessment — field names verbatim from pifTickAssessment.ts. */
export interface PifGgomedRow {
    _id: string;
    _type: GgomedDocType;
    _updatedAt: string;
    title: string | null;
    slug: string | null;
    pathname: string | null;
    showPifTick: boolean;
    assessment: {
        readabilityCheck: boolean | null;
        healthInequalitiesCheck: boolean | null;
        transparencyCheck: boolean | null;
        evidenceBasedCheck: boolean | null;
        tier1ReadabilityScore: number | null;
        targetScore: number | null;
        inclusivityScore: number | null;
        transparencyScore: number | null;
        evidenceBasedScore: number | null;
        assessedAt: string | null;
        llmModel: string | null;
        contentHash: string | null;
    } | null;
    governance: {
        reviewerName: string | null;
        publicationDate: string | null;
        lastUpdated: string | null;
        nextReviewDate: string | null;
        reviewCycleYears: number | null;
        version: string | null;
        referenceCount: number;
        guidelineCount: number;
    } | null;
}

/** Compass PIF slice — field names verbatim from the live m05ykm6e docs. */
export interface PifCompassRow {
    _id: string;
    _type: "medicalIntervention" | "ggoProcedure";
    _updatedAt: string;
    title: string | null;
    specialty: string | null;
    syncStatus: string | null;
    pifChecks: {
        evidenceBasedReview: boolean | null;
        patientReadability: boolean | null;
        inclusivityAssessment: boolean | null;
        expertPeerReview: boolean | null;
    } | null;
    pifGovernance: {
        reviewerName: string | null;
        reviewerGmcNumber: string | null;
        reviewerRegistrationBody: string | null;
        nextReviewDate: string | null;
        referenceCount: number;
    } | null;
    /** Existence-join on the immutable pifCertification audit doc. */
    certified: boolean;
    certification: {
        signedAt: string | null;
        certifierName: string | null;
    } | null;
}

/**
 * Named GROQ view layer — the shared read service of the cockpit (spec §2.2).
 *
 * Consumed two ways, deliberately:
 *  - imported directly by server components (zero network hop);
 *  - served over /api/views/[view] for out-of-process consumers
 *    (the editorial skills, Phase 3).
 *
 * Every view is READ-ONLY, live GROQ (no mirror), and named so that UI and
 * skills depend on the view name, never on a raw Sanity shape.
 *
 * Two clients, two projects, no cross-project join (spec §4.1) — the PIF
 * union happens app-side in lib/pif/normalise.ts.
 */
import { ggomedClient, compassPifClient } from "../sanity/clients";
import { sanityCompassConfig } from "../config";
import { cached } from "../cache";
import type {
    EditorialContentRow,
    AssetIdentityRow,
    PifGgomedRow,
    PifCompassRow,
} from "./types";

/** GROQ template tag (identity — for editor syntax highlighting only). */
const groq = String.raw;

/** Pathname per app/sitemap.ts: blogPost → /blog/{slug}; others → /{slug}. */
const PATHNAME_PROJECTION = groq`select(
    _type == "blogPost" => "/blog/" + slug.current,
    "/" + slug.current
)`;

const GGOMED_PIF_TYPES = `["dedicatedPage", "categoryHubPage", "blogPost", "legalPage"]`;

export const editorialContentQuery = groq`
*[_type in ${GGOMED_PIF_TYPES}] | order(_updatedAt desc) {
    _id,
    _type,
    _updatedAt,
    title,
    "slug": slug.current,
    "pathname": ${PATHNAME_PROJECTION},
    "category": coalesce(parentCategory->title, category->title),
    lastReviewed,
    publishDate,
    "showPifTick": showPifTick == true,
    "noIndex": coalesce(seo.noIndex, noIndex, false) == true
}`;

export const assetIdentityQuery = groq`
*[_type in ${GGOMED_PIF_TYPES} && defined(slug.current)] {
    "pathname": ${PATHNAME_PROJECTION},
    "sanity_id": _id,
    title
}`;

export const pifGgomedQuery = groq`
*[_type in ${GGOMED_PIF_TYPES}] | order(_updatedAt desc) {
    _id,
    _type,
    _updatedAt,
    title,
    "slug": slug.current,
    "pathname": ${PATHNAME_PROJECTION},
    "showPifTick": showPifTick == true,
    "assessment": pifTickAssessment {
        readabilityCheck,
        healthInequalitiesCheck,
        transparencyCheck,
        evidenceBasedCheck,
        tier1ReadabilityScore,
        targetScore,
        inclusivityScore,
        transparencyScore,
        evidenceBasedScore,
        assessedAt,
        llmModel,
        contentHash
    },
    "governance": pifTickGovernance {
        "reviewerName": reviewer->name,
        publicationDate,
        lastUpdated,
        nextReviewDate,
        reviewCycleYears,
        version,
        "referenceCount": count(coalesce(references, [])),
        "guidelineCount": count(coalesce(guidelines, []))
    }
}`;

/**
 * Compass PIF slice — the ONLY m05ykm6e read in the cockpit. Tenant-scoped
 * ($tenant in visibleTo) because the PIF capability is GGOMED-only
 * (ADR-0124). pifChecks/pifGovernance are queried raw: they exist on live
 * docs but are not declared on the ggoProcedure Studio schema (ADR-0124 D3).
 */
export const pifCompassQuery = groq`
*[_type in ["medicalIntervention", "ggoProcedure"] && $tenant in visibleTo]
    | order(_updatedAt desc) {
    _id,
    _type,
    _updatedAt,
    "title": coalesce(title, name),
    specialty,
    syncStatus,
    pifChecks {
        evidenceBasedReview,
        patientReadability,
        inclusivityAssessment,
        expertPeerReview
    },
    pifGovernance {
        reviewerName,
        reviewerGmcNumber,
        reviewerRegistrationBody,
        nextReviewDate,
        "referenceCount": count(coalesce(references, []))
    },
    "certified": count(*[_type == "pifCertification" && docId == ^._id]) > 0,
    "certification": *[_type == "pifCertification" && docId == ^._id]
        | order(signedAt desc)[0] { signedAt, certifierName }
}`;

// ── Fetchers (cached: live GROQ behind a short in-process TTL) ──────────────

const VIEW_TTL_MS = 5 * 60 * 1000; // 5 min — live-ish without hammering Sanity

export function getEditorialContent(): Promise<EditorialContentRow[]> {
    return cached(
        "view:editorial-content",
        () => ggomedClient.fetch<EditorialContentRow[]>(editorialContentQuery),
        VIEW_TTL_MS
    );
}

export function getAssetIdentity(): Promise<AssetIdentityRow[]> {
    return cached(
        "view:asset-identity",
        () => ggomedClient.fetch<AssetIdentityRow[]>(assetIdentityQuery),
        VIEW_TTL_MS
    );
}

export function getPifGgomed(): Promise<PifGgomedRow[]> {
    return cached(
        "view:pif-ggomed",
        () => ggomedClient.fetch<PifGgomedRow[]>(pifGgomedQuery),
        VIEW_TTL_MS
    );
}

export function getPifCompass(): Promise<PifCompassRow[]> {
    return cached(
        "view:pif-compass",
        () =>
            compassPifClient.fetch<PifCompassRow[]>(pifCompassQuery, {
                tenant: sanityCompassConfig.tenantScope,
            }),
        VIEW_TTL_MS
    );
}

/**
 * The registry the HTTP API serves. Names are the public contract —
 * skills will call /api/views/<name> in Phase 3. Add views here, nowhere else.
 */
export const VIEW_REGISTRY = {
    "editorial-content": getEditorialContent,
    "asset-identity": getAssetIdentity,
    "pif-ggomed": getPifGgomed,
    "pif-compass": getPifCompass,
} as const;

export type ViewName = keyof typeof VIEW_REGISTRY;

export function isViewName(name: string): name is ViewName {
    return name in VIEW_REGISTRY;
}

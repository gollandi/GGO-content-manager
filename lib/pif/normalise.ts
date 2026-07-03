/**
 * PIF Tick normalisation — the two-project union (spec §4).
 *
 * PIF data lives in two Sanity projects with DIFFERENT schemas and GROQ
 * cannot join across projects, so this module takes the two view outputs
 * and normalises them app-side into one PifRow[] grid.
 *
 * Criterion mapping is BY CRITERION, not by key string (spec §4.2):
 *
 *   Normalised            GGOMed (gxyjgvr0)          Compass (m05ykm6e)
 *   ─────────────────     ────────────────────────   ─────────────────────
 *   evidenceBased         evidenceBasedCheck         evidenceBasedReview
 *   readability           readabilityCheck           patientReadability
 *   inclusivity           healthInequalitiesCheck    inclusivityAssessment
 *   expertPeerReview      DERIVED: governance         expertPeerReview
 *                         reviewer present            (stored bool)
 *   transparency          transparencyCheck          N/A — always null
 *
 * Badge-lit is computed, not queryable, on BOTH sides (spec §4.4):
 * GGOMed stores showPifTick (auto-reconciled in Studio) — read it.
 * Compass computes it outside GROQ — replicate the predicate here.
 */
import type { PifGgomedRow, PifCompassRow } from "../views/types";

export type PifSource = "ggomed" | "compass";

export interface PifCriteria {
    evidenceBased: boolean | null;
    readability: boolean | null;
    inclusivity: boolean | null;
    expertPeerReview: boolean | null;
    /** GGOMed-only criterion — always null for Compass rows. */
    transparency: boolean | null;
}

export interface PifRow {
    source: PifSource;
    id: string;
    docType: string;
    title: string;
    /** Site pathname (GGOMed) — null for Compass rows. */
    pathname: string | null;
    criteria: PifCriteria;
    /** All applicable criteria ticked (transparency excluded for Compass). */
    allTicked: boolean;
    /** The patient-facing badge state (stored for GGOMed, computed for Compass). */
    badgeLit: boolean;
    reviewerName: string | null;
    nextReviewDate: string | null;
    /** nextReviewDate < today (spec §4.5). */
    overdue: boolean;
    lastAssessedAt: string | null;
    /** Compass only: the immutable certification audit exists. */
    certified: boolean | null;
    updatedAt: string;
}

const isOverdue = (nextReviewDate: string | null, today: Date): boolean =>
    !!nextReviewDate && new Date(nextReviewDate).getTime() < today.getTime();

export function normaliseGgomed(rows: PifGgomedRow[], today = new Date()): PifRow[] {
    return rows.map((r) => {
        const a = r.assessment;
        const criteria: PifCriteria = {
            evidenceBased: a?.evidenceBasedCheck ?? null,
            readability: a?.readabilityCheck ?? null,
            inclusivity: a?.healthInequalitiesCheck ?? null,
            // Derived — there is no expertPeerReview field on gxyjgvr0:
            // a named clinical reviewer on governance IS the peer review.
            expertPeerReview: r.governance ? !!r.governance.reviewerName : null,
            transparency: a?.transparencyCheck ?? null,
        };
        const applicable = [
            criteria.evidenceBased,
            criteria.readability,
            criteria.inclusivity,
            criteria.expertPeerReview,
            criteria.transparency,
        ];
        return {
            source: "ggomed" as const,
            id: r._id,
            docType: r._type,
            title: r.title ?? "(untitled)",
            pathname: r.pathname,
            criteria,
            allTicked: applicable.every((c) => c === true),
            // Stored, Studio-reconciled — do NOT re-derive (spec §4.4).
            badgeLit: r.showPifTick,
            reviewerName: r.governance?.reviewerName ?? null,
            nextReviewDate: r.governance?.nextReviewDate ?? null,
            overdue: isOverdue(r.governance?.nextReviewDate ?? null, today),
            lastAssessedAt: r.assessment?.assessedAt ?? null,
            certified: null,
            updatedAt: r._updatedAt,
        };
    });
}

export function normaliseCompass(rows: PifCompassRow[], today = new Date()): PifRow[] {
    return rows.map((r) => {
        const c = r.pifChecks;
        const criteria: PifCriteria = {
            evidenceBased: c?.evidenceBasedReview ?? null,
            readability: c?.patientReadability ?? null,
            inclusivity: c?.inclusivityAssessment ?? null,
            expertPeerReview: c?.expertPeerReview ?? null,
            transparency: null, // no transparency check on m05ykm6e — by design
        };
        const fourChecks = [
            criteria.evidenceBased,
            criteria.readability,
            criteria.inclusivity,
            criteria.expertPeerReview,
        ];
        const allTicked = fourChecks.every((v) => v === true);
        const nextReviewDate = r.pifGovernance?.nextReviewDate ?? null;
        const reviewLapsed = isOverdue(nextReviewDate, today);
        // Replicated normalisePathway predicate (spec §4.4): certified AND
        // not flagged-for-review AND review not lapsed AND all four ticked.
        const badgeLit =
            r.certified &&
            r.syncStatus !== "flag-for-review" &&
            !reviewLapsed &&
            allTicked;
        return {
            source: "compass" as const,
            id: r._id,
            docType: r._type,
            title: r.title ?? "(untitled)",
            pathname: null,
            criteria,
            allTicked,
            badgeLit,
            reviewerName: r.pifGovernance?.reviewerName ?? null,
            nextReviewDate,
            overdue: reviewLapsed,
            lastAssessedAt: r.certification?.signedAt ?? null,
            certified: r.certified,
            updatedAt: r._updatedAt,
        };
    });
}

/** The one grid the PIF module renders: both projects, side by side. */
export function normalisePif(
    ggomed: PifGgomedRow[],
    compass: PifCompassRow[],
    today = new Date()
): PifRow[] {
    return [...normaliseGgomed(ggomed, today), ...normaliseCompass(compass, today)];
}

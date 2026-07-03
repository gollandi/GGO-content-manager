import { describe, it, expect } from "vitest";
import { normaliseGgomed, normaliseCompass } from "../lib/pif/normalise";
import type { PifGgomedRow, PifCompassRow } from "../lib/views/types";

/**
 * The two-project PIF union (spec §4): criterion mapping BY CRITERION,
 * derived peer review on GGOMed, replicated badge predicate on Compass.
 */

const TODAY = new Date("2026-07-03T12:00:00Z");

const ggomedRow = (over: Partial<PifGgomedRow> = {}): PifGgomedRow => ({
    _id: "g1",
    _type: "dedicatedPage",
    _updatedAt: "2026-07-01T00:00:00Z",
    title: "Circumcision",
    slug: "circumcision",
    pathname: "/circumcision",
    showPifTick: true,
    assessment: {
        readabilityCheck: true,
        healthInequalitiesCheck: true,
        transparencyCheck: true,
        evidenceBasedCheck: true,
        tier1ReadabilityScore: 72,
        targetScore: 70,
        inclusivityScore: 8,
        transparencyScore: 9,
        evidenceBasedScore: 9,
        assessedAt: "2026-06-01",
        llmModel: "claude",
        contentHash: "abc",
    },
    governance: {
        reviewerName: "Mr Giangiacomo Ollandini",
        publicationDate: "2026-01-01",
        lastUpdated: "2026-06-01",
        nextReviewDate: "2027-01-01",
        reviewCycleYears: 1,
        version: "1.0",
        referenceCount: 4,
        guidelineCount: 2,
    },
    ...over,
});

const compassRow = (over: Partial<PifCompassRow> = {}): PifCompassRow => ({
    _id: "c1",
    _type: "medicalIntervention",
    _updatedAt: "2026-07-01T00:00:00Z",
    title: "Varicocele repair",
    specialty: "urology",
    syncStatus: "in-sync",
    pifChecks: {
        evidenceBasedReview: true,
        patientReadability: true,
        inclusivityAssessment: true,
        expertPeerReview: true,
    },
    pifGovernance: {
        reviewerName: "Mr Giangiacomo Ollandini",
        reviewerGmcNumber: "1234567",
        reviewerRegistrationBody: "GMC",
        nextReviewDate: "2027-01-01",
        referenceCount: 3,
    },
    certified: true,
    certification: { signedAt: "2026-06-13", certifierName: "GGO" },
    ...over,
});

describe("normaliseGgomed", () => {
    it("maps the four checks + transparency by criterion", () => {
        const [row] = normaliseGgomed([ggomedRow()], TODAY);
        expect(row.criteria).toEqual({
            evidenceBased: true,
            readability: true,
            inclusivity: true,
            expertPeerReview: true, // derived from reviewerName
            transparency: true,
        });
        expect(row.allTicked).toBe(true);
    });

    it("derives expertPeerReview from governance.reviewer presence", () => {
        const noReviewer = ggomedRow({
            governance: { ...ggomedRow().governance!, reviewerName: null },
        });
        const [row] = normaliseGgomed([noReviewer], TODAY);
        expect(row.criteria.expertPeerReview).toBe(false);
        const noGov = ggomedRow({ governance: null });
        expect(normaliseGgomed([noGov], TODAY)[0].criteria.expertPeerReview).toBeNull();
    });

    it("reads the stored badge, never re-derives it", () => {
        // Checks all false but stored showPifTick true → badge stays lit
        // (Studio reconciles it; the cockpit must not second-guess — §4.4).
        const stored = ggomedRow({
            assessment: {
                ...ggomedRow().assessment!,
                readabilityCheck: false,
                evidenceBasedCheck: false,
            },
            showPifTick: true,
        });
        expect(normaliseGgomed([stored], TODAY)[0].badgeLit).toBe(true);
    });

    it("flags overdue reviews", () => {
        const overdue = ggomedRow({
            governance: { ...ggomedRow().governance!, nextReviewDate: "2026-01-01" },
        });
        expect(normaliseGgomed([overdue], TODAY)[0].overdue).toBe(true);
    });
});

describe("normaliseCompass", () => {
    it("maps the four checks; transparency is always null", () => {
        const [row] = normaliseCompass([compassRow()], TODAY);
        expect(row.criteria.transparency).toBeNull();
        expect(row.allTicked).toBe(true);
        expect(row.badgeLit).toBe(true);
    });

    it("badge predicate: certification required", () => {
        const uncertified = compassRow({ certified: false, certification: null });
        expect(normaliseCompass([uncertified], TODAY)[0].badgeLit).toBe(false);
    });

    it("badge predicate: flag-for-review de-certifies", () => {
        const flagged = compassRow({ syncStatus: "flag-for-review" });
        expect(normaliseCompass([flagged], TODAY)[0].badgeLit).toBe(false);
    });

    it("badge predicate: lapsed review de-certifies (pifReviewLapsed)", () => {
        const lapsed = compassRow({
            pifGovernance: { ...compassRow().pifGovernance!, nextReviewDate: "2026-01-01" },
        });
        const [row] = normaliseCompass([lapsed], TODAY);
        expect(row.badgeLit).toBe(false);
        expect(row.overdue).toBe(true);
    });

    it("badge predicate: an unticked check de-certifies", () => {
        const gap = compassRow({
            pifChecks: { ...compassRow().pifChecks!, expertPeerReview: false },
        });
        expect(normaliseCompass([gap], TODAY)[0].badgeLit).toBe(false);
    });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
    computeAwaiting,
    computeNight,
    computeWeek,
    computeEditorial,
    computePif,
    mondayOf,
} from "../lib/house/state";
import type { CancelloState, DeskRow, CalendarRow as GateCalendarRow, WebsiteArticle } from "../lib/cancello/state";
import type { ActivityLogRow, CalendarRow, ContentNeedRow } from "../lib/notion/editorial";
import type { EditorialContentRow } from "../lib/views/types";
import type { PifRow } from "../lib/pif/normalise";

/**
 * The house state is the ONE place a "what awaits JJ" number is derived.
 * These tests pin the formulas so no room can drift from Il Cancello.
 */

const NOW = new Date("2026-09-02T09:00:00Z");

const desk = (over: Partial<DeskRow>): DeskRow => ({
    rowId: "d", url: "", title: "t", type: "question", status: "Pending", priority: "Normal",
    due: null, correction: "", body: "", videos: [], ...over,
});
const cal = (over: Partial<GateCalendarRow>): GateCalendarRow => ({
    rowId: "c", title: "t", contentType: "Reel", status: "Review", platforms: null, date: null, variant: null,
    caption: "", hashtags: "", notes: "", canva: null, hasAssets: false, media: [], url: "", sourceUrl: null,
    createdAt: "", ...over,
});
const site = (over: Partial<WebsiteArticle>): WebsiteArticle => ({
    rowId: "w", title: "t", status: null, category: null, reviewDue: null, lastReviewed: null, liveUrl: null,
    url: "", proposals: [], patch: null, ...over,
});
const gate = (over: Partial<CancelloState>): CancelloState => ({
    wall: [], desk: [], calendar: [], website: [], generatedAt: NOW.toISOString(), cached: false, warnings: [],
    ...over,
});

describe("computeAwaiting splits the desk into editorial acts and questions", () => {
    it("counts wall + pending editorial desk + calendar Review + website patches at the gate", () => {
        const state = gate({
            wall: [desk({ rowId: "a", type: "publish-approval" })],
            desk: [
                desk({ rowId: "a", type: "publish-approval" }),
                desk({ rowId: "b", type: "clip-script" }),
                desk({ rowId: "c", type: "publish-approval", status: "Approved" }),
                desk({ rowId: "q1", type: "question" }),
                desk({ rowId: "q2", type: "recommendation" }),
                desk({ rowId: "q3", type: "recommendation" }),
                desk({ rowId: "q4", type: "plan-proposal", status: "Done" }),
            ],
            calendar: [cal({ rowId: "r1" }), cal({ rowId: "s1", status: "Scheduled" })],
            website: [
                site({ rowId: "p", patch: { id: "p", title: null, rationale: null, sources: [], operations: [], sanityDocId: "x", batch: "b" } }),
                site({ rowId: "q", patch: { id: "q", title: null, rationale: null, sources: [], operations: [], sanityDocId: "y", batch: "b" }, patchState: "awaiting-publish" }),
            ],
        });
        const a = computeAwaiting(state, [], NOW);
        expect(a.desk).toBe(2);
        expect(a.social).toBe(1);
        expect(a.website).toBe(1);
        expect(a.total).toBe(4);
        expect(a.scheduled).toBe(1);
        expect(a.questions).toBe(3);
        expect(a.questionsByKind).toEqual({ question: 1, recommendation: 2 });
    });

    it("sends any desk row carrying a clip to the gate, whatever its type", () => {
        const a = computeAwaiting(
            gate({ desk: [desk({ rowId: "v", type: "question", videos: [{ url: "/video?path=a.mp4", name: "a", path: "a.mp4", ageDays: 40 }] })] }),
            [],
            NOW
        );
        expect(a.desk).toBe(1);
        expect(a.questions).toBe(0);
    });

    it("treats an unknown desk type as a question, never as a publish act", () => {
        const a = computeAwaiting(gate({ desk: [desk({ rowId: "z", type: "something-new" })] }), [], NOW);
        expect(a.total).toBe(0);
        expect(a.questions).toBe(1);
    });

    it("reports the oldest overdue item per family, open needs and impact verdicts due", () => {
        const state = gate({
            desk: [
                desk({ rowId: "a", type: "question", due: "2026-08-20" }),
                desk({ rowId: "b", type: "publish-approval", due: "2026-08-30" }),
                desk({ rowId: "c", type: "question", due: "2026-09-10" }),
            ],
        });
        const needs: ContentNeedRow[] = [
            { id: "n", need: "x", source: null, actionStatus: "To do", details: "", contentAssetIds: [],
              successDefinition: "more clicks", impactReviewDate: "2026-09-01", impactOutcome: null, impactEvidence: "" },
            { id: "m", need: "y", source: null, actionStatus: "Done", details: "", contentAssetIds: [],
              successDefinition: "", impactReviewDate: "2026-09-01", impactOutcome: null, impactEvidence: "" },
        ];
        const a = computeAwaiting(state, needs, NOW);
        expect(a.oldestDays).toBe(3);
        expect(a.questionsOldestDays).toBe(13);
        expect(a.needsOpen).toBe(1);
        expect(a.impact).toBe(1);
    });
});

describe("computeNight", () => {
    const run = (over: Partial<ActivityLogRow>): ActivityLogRow => ({
        id: "r", run: "r", job: "job", status: "Success", startedAt: "2026-09-02T03:00:00Z", durationMs: null,
        rowsWritten: null, errors: null, summary: "", errorMessage: "", triggeredBy: null, ...over,
    });
    it("keeps the last 24 hours and lists what needs a look", () => {
        const n = computeNight(
            [run({ id: "1" }), run({ id: "2", status: "Failed", errorMessage: "boom" }), run({ id: "old", startedAt: "2026-08-30T03:00:00Z", status: "Failed" })],
            NOW
        );
        expect(n.runs).toBe(2);
        expect(n.ok).toBe(1);
        expect(n.attention).toBe(1);
        expect(n.failed.map((f) => f.id)).toEqual(["2"]);
        expect(n.failed[0].summary).toBe("boom");
    });
    it("finds the last productive produce slot and the zero-output streak", () => {
        const n = computeNight(
            [
                run({ id: "p3", job: "ernesto-headless-produce", startedAt: "2026-09-02T02:00:00Z", summary: "0 slot claimed" }),
                run({ id: "p2", job: "ernesto-headless-produce", startedAt: "2026-09-01T02:00:00Z", status: "Failed" }),
                run({ id: "p1", job: "ernesto-headless-produce", startedAt: "2026-08-31T02:00:00Z", summary: "2 reels drafted" }),
            ],
            NOW
        );
        expect(n.lastProductiveAt).toBe("2026-08-31T02:00:00Z");
        expect(n.zeroOutputStreak).toBe(2);
    });
});

describe("computeWeek", () => {
    const row = (over: Partial<CalendarRow>): CalendarRow => ({
        id: "c", topicTitle: "t", status: "Draft", assetStatus: null, date: "2026-09-02", contentType: "Reel",
        sourceUrl: null, sanitySync: "", syncedAt: null, topicIds: [], mediaAssetIds: [], ...over,
    });
    it("starts on Monday and groups this week's calendar by content type and status", () => {
        expect(mondayOf(NOW)).toBe("2026-08-31");
        const w = computeWeek(
            [
                row({ id: "1", status: "Published" }),
                row({ id: "2", status: "Review", date: "2026-09-06" }),
                row({ id: "3", contentType: "Static", status: "Scheduled", date: "2026-08-31" }),
                row({ id: "4", date: "2026-09-07" }), // next Monday — out
                row({ id: "5", date: "2026-08-30" }), // last Sunday — out
            ],
            NOW,
            5
        );
        expect(w.weekOf).toBe("2026-08-31");
        expect(w.total).toBe(3);
        expect(w.published).toBe(1);
        expect(w.target).toBe(5);
        expect(w.lanes).toEqual([
            { type: "Reel", draft: 0, inProduction: 0, review: 1, scheduled: 0, published: 1 },
            { type: "Static", draft: 0, inProduction: 0, review: 0, scheduled: 1, published: 0 },
        ]);
    });
});

describe("computeEditorial and computePif", () => {
    it("treats never-reviewed and six-month-old pages as stale", () => {
        const page = (over: Partial<EditorialContentRow>): EditorialContentRow => ({
            _id: "x", _type: "blogPost", _updatedAt: "", title: "t", slug: "s", pathname: "/s", category: null,
            lastReviewed: "2026-08-01", publishDate: null, showPifTick: true, noIndex: false, ...over,
        });
        const e = computeEditorial([page({}), page({ lastReviewed: null }), page({ lastReviewed: "2025-12-01" })], NOW);
        expect(e.live).toBe(3);
        expect(e.stale).toBe(2);
        expect(e.oldestStaleDays).toBe(275);
        expect(e.pifLit).toBe(3);
    });
    it("counts unlit badges and the next review coming up", () => {
        const pif = (over: Partial<PifRow>): PifRow => ({
            source: "ggomed", id: "p", docType: "page", title: "t", pathname: "/t",
            criteria: {} as PifRow["criteria"], allTicked: true, badgeLit: true, reviewerName: null,
            nextReviewDate: null, overdue: false, lastAssessedAt: null, certified: null, updatedAt: "", ...over,
        });
        const p = computePif(
            [pif({ nextReviewDate: "2026-10-01" }), pif({ badgeLit: false, overdue: true, nextReviewDate: "2026-08-01" }), pif({ nextReviewDate: "2026-09-12" })],
            NOW
        );
        expect(p.rows).toBe(3);
        expect(p.unlit).toBe(1);
        expect(p.overdue).toBe(1);
        expect(p.nextReviewDate).toBe("2026-09-12");
        expect(p.nextReviewInDays).toBe(10);
    });
});

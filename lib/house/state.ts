/**
 * The state of the house — ONE read model for every "what awaits JJ" number.
 *
 * Before this file the same facts were re-derived on the client by the
 * Sidebar, the Atrio, HousePulse, ErnestoOperationsBoard and Editorial, each
 * with its own filter, so four surfaces could show four different queues.
 * Every count the cockpit shows about the house now comes from here; rooms
 * consume it, they never recompute it.
 *
 * Read-only by construction: it composes the existing cached loaders and
 * never touches Notion or Sanity write paths.
 */
import { loadCancelloState, type CancelloState } from "../cancello/state";
import {
    getAgentsActivityLog,
    getContentCalendar,
    getContentNeeds,
    getPerformanceSnapshot,
    getAmbrogioProposals,
    type ActivityLogRow,
    type CalendarRow,
    type ContentNeedRow,
} from "../notion/editorial";
import { getEditorialContent, getPifGgomed, getPifCompass } from "../views";
import type { EditorialContentRow } from "../views/types";
import { normaliseGgomed, normaliseCompass, type PifRow } from "../pif/normalise";
import { listRuns } from "../runner/store";
import { listRetros } from "../retro/run";
import { settle } from "../settle";
import { cached } from "../cache";
import { deskFamily } from "./families";

/* ── Shape ─────────────────────────────────────────────────────────────── */

export interface Awaiting {
    /** Editorial acts at Il Cancello: publish approvals, clips, social in
     *  Review, website patches — the gate's own entry list. */
    total: number;
    social: number;
    /** Desk rows of the editorial family (publish-approval, clip-script…). */
    desk: number;
    website: number;
    /** Impact verdicts due (Content Needs with a review date reached). */
    impact: number;
    /** Days the oldest overdue editorial desk item has been standing. */
    oldestDays: number | null;
    /** Calendar rows already sealed and scheduled towards publication. */
    scheduled: number;
    /** Content Needs still "To do": proposals waiting to be triaged. */
    needsOpen: number;
    /** Le Questioni: desk rows of the question family, pending, by kind. */
    questions: number;
    questionsByKind: Record<string, number>;
    questionsOldestDays: number | null;
}

export interface NightRun {
    id: string;
    job: string | null;
    status: string | null;
    startedAt: string | null;
    summary: string;
}

export interface Night {
    /** Runs that started in the last 24 hours. */
    runs: number;
    ok: number;
    attention: number;
    /** The runs that need a look, newest first. */
    failed: NightRun[];
    /** The last produce slot that actually made something. */
    lastProductiveAt: string | null;
    zeroOutputStreak: number;
}

export interface WeekLane {
    type: string;
    draft: number;
    inProduction: number;
    review: number;
    scheduled: number;
    published: number;
}

export interface Week {
    /** ISO date of the Monday the lanes cover. */
    weekOf: string;
    lanes: WeekLane[];
    total: number;
    published: number;
    /** Weekly target from COCKPIT_WEEKLY_TARGET; null = not set (never invented). */
    target: number | null;
}

export interface Editorial {
    live: number;
    /** Pages whose last review is older than six months, or never reviewed. */
    stale: number;
    oldestStaleDays: number | null;
    pifLit: number;
}

export interface Pif {
    rows: number;
    lit: number;
    unlit: number;
    overdue: number;
    /** The next review date coming up, or null. */
    nextReviewDate: string | null;
    /** Days until that date (negative when already passed). */
    nextReviewInDays: number | null;
}

export interface HouseState {
    generatedAt: string;
    awaiting: Awaiting | null;
    night: Night | null;
    week: Week | null;
    editorial: Editorial | null;
    pif: Pif | null;
    runs: { active: number; failed: number };
    retros: number;
    /** Ambrogio's proposals still undecided — decided in his study, never here. */
    ambrogioPending: number | null;
    snapshot: { latestWeekOf: string | null; ageDays: number | null } | null;
    errors: string[];
}

/* ── Pure derivations (unit-tested) ─────────────────────────────────────── */

const DAY_MS = 86_400_000;
export const STALE_AFTER_DAYS = 180;
const PRODUCE_JOB = "ernesto-headless-produce";
const ZERO_OUTPUT_RE = /\b(0|zero|no|nessun[oa]?)\b.*\b(slot|output|claimed|prodott)/i;
const ATTENTION = new Set(["Failed", "Partial"]);

export function daysBetween(from: string | null, now: Date): number | null {
    if (!from) return null;
    const t = new Date(from).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.floor((now.getTime() - t) / DAY_MS);
}

/** Identical to the entry list Il Cancello renders — one formula, one place. */
export function computeAwaiting(state: CancelloState, needs: ContentNeedRow[], now: Date): Awaiting {
    const wallIds = new Set(state.wall.map((r) => r.rowId));
    const pending = [
        ...state.wall,
        ...state.desk.filter((r) => r.status === "Pending" && !wallIds.has(r.rowId)),
    ];
    const editorialDesk = pending.filter((r) => deskFamily(r.type, r.videos.length > 0) === "editorial");
    const questionDesk = pending.filter((r) => deskFamily(r.type, r.videos.length > 0) === "question");
    const social = state.calendar.filter((r) => r.status === "Review").length;
    const website = state.website.filter((r) => r.patch && r.patchState !== "awaiting-publish").length;
    const today = now.toISOString().slice(0, 10);
    const impact = needs.filter(
        (r) =>
            r.successDefinition &&
            r.impactReviewDate &&
            r.impactReviewDate <= today &&
            (!r.impactOutcome || r.impactOutcome === "Pending")
    ).length;
    const oldest = (rows: { due: string | null }[]): number | null => {
        const ages = rows.map((r) => daysBetween(r.due, now)).filter((d): d is number => d !== null && d > 0);
        return ages.length ? Math.max(...ages) : null;
    };
    const questionsByKind: Record<string, number> = {};
    for (const r of questionDesk) questionsByKind[r.type] = (questionsByKind[r.type] ?? 0) + 1;
    return {
        total: editorialDesk.length + social + website,
        social,
        desk: editorialDesk.length,
        website,
        impact,
        oldestDays: oldest(editorialDesk),
        scheduled: state.calendar.filter((r) => r.status === "Scheduled").length,
        needsOpen: needs.filter((r) => r.actionStatus === "To do").length,
        questions: questionDesk.length,
        questionsByKind,
        questionsOldestDays: oldest(questionDesk),
    };
}

export function computeNight(activity: ActivityLogRow[], now: Date): Night {
    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    const recent = activity
        .filter((r) => r.startedAt && new Date(r.startedAt).getTime() >= cutoff)
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    const produce = activity
        .filter((r) => r.job === PRODUCE_JOB && r.startedAt)
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    const isProductive = (r: ActivityLogRow) => r.status === "Success" && !ZERO_OUTPUT_RE.test(r.summary || "");
    let zeroOutputStreak = 0;
    for (const r of produce) {
        if (isProductive(r)) break;
        zeroOutputStreak += 1;
    }
    return {
        runs: recent.length,
        ok: recent.filter((r) => r.status === "Success").length,
        attention: recent.filter((r) => ATTENTION.has(r.status ?? "")).length,
        failed: recent
            .filter((r) => ATTENTION.has(r.status ?? ""))
            .map((r) => ({
                id: r.id,
                job: r.job,
                status: r.status,
                startedAt: r.startedAt,
                summary: (r.errorMessage || r.summary || "").slice(0, 200),
            })),
        lastProductiveAt: produce.find(isProductive)?.startedAt ?? null,
        zeroOutputStreak,
    };
}

/** Monday of the ISO week containing `now`, as YYYY-MM-DD. */
export function mondayOf(now: Date): string {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return d.toISOString().slice(0, 10);
}

export function computeWeek(calendar: CalendarRow[], now: Date, target: number | null): Week {
    const weekOf = mondayOf(now);
    const end = new Date(`${weekOf}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const endIso = end.toISOString().slice(0, 10);
    const inWeek = calendar.filter((r) => r.date && r.date.slice(0, 10) >= weekOf && r.date.slice(0, 10) < endIso);
    const lanes = new Map<string, WeekLane>();
    for (const r of inWeek) {
        const type = r.contentType || "Senza tipo";
        const lane = lanes.get(type) ?? { type, draft: 0, inProduction: 0, review: 0, scheduled: 0, published: 0 };
        switch (r.status) {
            case "Draft": lane.draft += 1; break;
            case "In Production": lane.inProduction += 1; break;
            case "Review": lane.review += 1; break;
            case "Scheduled": lane.scheduled += 1; break;
            case "Published": lane.published += 1; break;
            default: break;
        }
        lanes.set(type, lane);
    }
    const ordered = [...lanes.values()].sort((a, b) => a.type.localeCompare(b.type));
    return {
        weekOf,
        lanes: ordered,
        total: inWeek.length,
        published: ordered.reduce((n, l) => n + l.published, 0),
        target,
    };
}

export function computeEditorial(rows: EditorialContentRow[], now: Date): Editorial {
    const staleAges = rows
        .map((r) => (r.lastReviewed ? daysBetween(r.lastReviewed, now) : Number.POSITIVE_INFINITY))
        .filter((d): d is number => d !== null && d >= STALE_AFTER_DAYS);
    const finite = staleAges.filter((d) => Number.isFinite(d));
    return {
        live: rows.length,
        stale: staleAges.length,
        oldestStaleDays: finite.length ? Math.max(...finite) : null,
        pifLit: rows.filter((r) => r.showPifTick).length,
    };
}

export function computePif(rows: PifRow[], now: Date): Pif {
    const today = now.toISOString().slice(0, 10);
    const upcoming = rows
        .map((r) => r.nextReviewDate)
        .filter((d): d is string => !!d)
        .sort();
    const next = upcoming.find((d) => d >= today) ?? upcoming[0] ?? null;
    const inDays = next ? -(daysBetween(next, now) ?? 0) : null;
    return {
        rows: rows.length,
        lit: rows.filter((r) => r.badgeLit).length,
        unlit: rows.filter((r) => !r.badgeLit).length,
        overdue: rows.filter((r) => r.overdue).length,
        nextReviewDate: next,
        nextReviewInDays: inDays,
    };
}

/* ── The loader ─────────────────────────────────────────────────────────── */

const HOUSE_TTL_MS = 60 * 1000;

function weeklyTarget(): number | null {
    const raw = process.env.COCKPIT_WEEKLY_TARGET;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

async function build(now: Date): Promise<HouseState> {
    const [cancello, needs, activity, calendar, site, ggomed, compass, snapshot, ambrogio] = await Promise.all([
        settle(() => loadCancelloState()),
        settle(getContentNeeds),
        settle(getAgentsActivityLog),
        settle(getContentCalendar),
        settle(getEditorialContent),
        settle(getPifGgomed),
        settle(getPifCompass),
        settle(getPerformanceSnapshot),
        settle(getAmbrogioProposals),
    ]);
    const pifRows: PifRow[] = [
        ...(ggomed.data ? normaliseGgomed(ggomed.data, now) : []),
        ...(compass.data ? normaliseCompass(compass.data, now) : []),
    ];
    let runs: { active: number; failed: number } = { active: 0, failed: 0 };
    try {
        const all = listRuns();
        runs = {
            active: all.filter((r) => r.status === "running" || r.status === "awaiting-jj").length,
            failed: all.filter((r) => r.status === "error").length,
        };
    } catch { /* no runs directory yet — the house has not run */ }
    let retros = 0;
    try { retros = listRetros().length; } catch { /* no retro directory yet */ }
    const weeks = (snapshot.data ?? []).map((r) => r.weekOf).filter((w): w is string => !!w).sort();
    const latestWeekOf = weeks.length ? weeks[weeks.length - 1] : null;
    return {
        generatedAt: now.toISOString(),
        awaiting: cancello.data ? computeAwaiting(cancello.data, needs.data ?? [], now) : null,
        night: activity.data ? computeNight(activity.data, now) : null,
        week: calendar.data ? computeWeek(calendar.data, now, weeklyTarget()) : null,
        editorial: site.data ? computeEditorial(site.data, now) : null,
        pif: ggomed.data || compass.data ? computePif(pifRows, now) : null,
        runs,
        retros,
        ambrogioPending: ambrogio.data ? ambrogio.data.filter((r) => r.decision === "Pending").length : null,
        snapshot: snapshot.data ? { latestWeekOf, ageDays: daysBetween(latestWeekOf, now) } : null,
        errors: [cancello, needs, activity, calendar, site, ggomed, compass, snapshot, ambrogio]
            .map((s) => s.error)
            .filter((e): e is string => !!e),
    };
}

export function getHouseState({ refresh = false } = {}): Promise<HouseState> {
    if (refresh) return build(new Date());
    return cached("house:state", () => build(new Date()), HOUSE_TTL_MS);
}

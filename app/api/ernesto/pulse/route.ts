import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { getAgentsActivityLog, getErnestoDesk, getPerformanceSnapshot } from "../../../../lib/notion/editorial";
import { settle } from "../../../../lib/settle";

/**
 * The house's pulse — three freshness facts the operator kept having to
 * infer from "things look old": when the last produce slot actually made
 * something, how long the decision queue is and how old its head is, and
 * which week the performance snapshot reached. Read model only; the
 * underlying reads are the same cached editorial services the rooms use.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCE_JOB = "ernesto-headless-produce";
/** A produce slot that claimed nothing says so in its own words. */
const ZERO_OUTPUT_RE = /\b0 (work orders?|unità|units?|nuov[ie] work order)/i;

export interface Pulse {
    produce: { lastRunAt: string | null; lastProductiveAt: string | null; zeroOutputStreak: number };
    desk: { pending: number; pendingOldestDays: number | null; approvedUnclaimed: number };
    snapshot: { latestWeekOf: string | null; ageDays: number | null };
    errors: string[];
    generatedAt: string;
}

function ageDays(value: string | null): number | null {
    if (!value) return null;
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const [activity, desk, snapshot] = await Promise.all([
        settle(getAgentsActivityLog),
        settle(getErnestoDesk),
        settle(getPerformanceSnapshot),
    ]);

    const produceRuns = (activity.data ?? [])
        .filter((r) => r.job === PRODUCE_JOB && r.startedAt)
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    const productive = produceRuns.find((r) => r.status === "Success" && !ZERO_OUTPUT_RE.test(r.summary || ""));
    let zeroOutputStreak = 0;
    for (const r of produceRuns) {
        if (r.status === "Success" && !ZERO_OUTPUT_RE.test(r.summary || "")) break;
        zeroOutputStreak += 1;
    }

    const deskRows = desk.data ?? [];
    const pending = deskRows.filter((r) => r.status === "Pending");
    const pendingAges = pending.map((r) => ageDays(r.createdAt)).filter((d): d is number => d !== null);
    const approvedUnclaimed = deskRows.filter((r) => r.status === "Approved" && (ageDays(r.createdAt) ?? 0) > 14).length;

    const weeks = (snapshot.data ?? []).map((r) => r.weekOf).filter((w): w is string => Boolean(w)).sort();
    const latestWeekOf = weeks.length ? weeks[weeks.length - 1] : null;

    const pulse: Pulse = {
        produce: {
            lastRunAt: produceRuns[0]?.startedAt ?? null,
            lastProductiveAt: productive?.startedAt ?? null,
            zeroOutputStreak,
        },
        desk: {
            pending: pending.length,
            pendingOldestDays: pendingAges.length ? Math.max(...pendingAges) : null,
            approvedUnclaimed,
        },
        snapshot: { latestWeekOf, ageDays: ageDays(latestWeekOf) },
        errors: [activity.error, desk.error, snapshot.error].filter((e): e is string => Boolean(e)),
        generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(pulse);
}

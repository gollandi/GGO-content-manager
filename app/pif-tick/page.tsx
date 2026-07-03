import Link from "next/link";
import { getPifGgomed, getPifCompass } from "../../lib/views";
import { normaliseGgomed, normaliseCompass, type PifRow } from "../../lib/pif/normalise";
import { settle } from "../../lib/settle";
import StatusBadge from "../../components/StatusBadge";

/**
 * Module 2 — PIF Tick (spec §3, §4). Every PIF criterion, per content
 * asset, across BOTH Sanity projects, in one normalised grid. Live GROQ —
 * no mirror. Server component (the cockpit's server-render path).
 */
export const dynamic = "force-dynamic";

const CRITERIA: { key: keyof PifRow["criteria"]; label: string }[] = [
    { key: "evidenceBased", label: "Evidence-based" },
    { key: "readability", label: "Readability" },
    { key: "inclusivity", label: "Inclusivity" },
    { key: "expertPeerReview", label: "Peer review" },
    { key: "transparency", label: "Transparency" },
];

function Tick({ value }: { value: boolean | null }) {
    if (value === null) return <span className="text-subtle" title="Not applicable / not assessed">—</span>;
    return value ? (
        <span className="text-emerald-600 font-bold" title="Ticked">✓</span>
    ) : (
        <span className="text-red-500 font-bold" title="Not ticked">✗</span>
    );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={
                active
                    ? "px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-ggo-purple to-ggo-teal text-white"
                    : "px-3 py-1.5 rounded-full text-xs font-medium bg-surface-muted text-charcoal hover:text-ggo-purple"
            }
        >
            {label}
        </Link>
    );
}

export default async function PifTickPage({
    searchParams,
}: {
    searchParams: Promise<{ source?: string; state?: string }>;
}) {
    const { source = "all", state = "all" } = await searchParams;

    const [ggomed, compass] = await Promise.all([
        settle(getPifGgomed),
        settle(getPifCompass),
    ]);

    const rows: PifRow[] = [
        ...(ggomed.data ? normaliseGgomed(ggomed.data) : []),
        ...(compass.data ? normaliseCompass(compass.data) : []),
    ];

    const filtered = rows
        .filter((r) => source === "all" || r.source === source)
        .filter((r) => {
            switch (state) {
                case "badge-lit": return r.badgeLit;
                case "unlit": return !r.badgeLit;
                case "overdue": return r.overdue;
                case "gaps": return !r.allTicked;
                default: return true;
            }
        });

    const lit = rows.filter((r) => r.badgeLit).length;
    const overdue = rows.filter((r) => r.overdue).length;

    const filterHref = (s: string, st: string) => `/pif-tick?source=${s}&state=${st}`;

    return (
        <div className="p-8 max-lg:p-4">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">PIF Tick</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Live criterion tracking across <strong>gxyjgvr0</strong> (GGOMed site)
                    and <strong>m05ykm6e</strong> (Patient-Compass slice) — two GROQ reads,
                    normalised app-side. No Notion mirror.
                </p>
            </header>

            {(ggomed.error || compass.error) && (
                <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900">
                    {ggomed.error && <p><strong>GGOMed view failed:</strong> {ggomed.error}</p>}
                    {compass.error && <p><strong>Compass view failed:</strong> {compass.error}</p>}
                    <p className="mt-1 text-xs">Check SANITY_VIEWER_TOKEN / SANITY_M05_VIEWER_TOKEN in .env.local (see .env.example).</p>
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-4 max-lg:grid-cols-2 gap-4 mb-6">
                {[
                    { label: "Tracked assets", value: rows.length },
                    { label: "Badge lit", value: lit },
                    { label: "Badge unlit", value: rows.length - lit },
                    { label: "Review overdue", value: overdue },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl border border-border-default p-5">
                        <div className="text-3xl font-bold">{s.value}</div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-1">Source</span>
                {["all", "ggomed", "compass"].map((s) => (
                    <FilterLink key={s} href={filterHref(s, state)} label={s === "all" ? "All" : s === "ggomed" ? "GGOMed site" : "Compass"} active={source === s} />
                ))}
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-4 mr-1">State</span>
                {[
                    ["all", "All"],
                    ["badge-lit", "Badge lit"],
                    ["unlit", "Unlit"],
                    ["gaps", "Criterion gaps"],
                    ["overdue", "Overdue"],
                ].map(([st, label]) => (
                    <FilterLink key={st} href={filterHref(source, st)} label={label} active={state === st} />
                ))}
            </div>

            {/* Criterion grid */}
            <div className="bg-white rounded-2xl border border-border-default overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border-default text-left">
                            <th className="px-4 py-3 font-semibold">Asset</th>
                            <th className="px-4 py-3 font-semibold">Source</th>
                            {CRITERIA.map((c) => (
                                <th key={c.key} className="px-3 py-3 font-semibold text-center whitespace-nowrap">{c.label}</th>
                            ))}
                            <th className="px-4 py-3 font-semibold text-center">Badge</th>
                            <th className="px-4 py-3 font-semibold">Reviewer</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Next review</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={`${r.source}:${r.id}`} className="border-b border-border-soft hover:bg-surface-muted/50">
                                <td className="px-4 py-3">
                                    <div className="font-medium">{r.title}</div>
                                    <div className="text-xs text-subtle">{r.docType}{r.pathname ? ` · ${r.pathname}` : ""}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge tone={r.source === "ggomed" ? "info" : "secondary"} label={r.source === "ggomed" ? "GGOMed" : "Compass"} />
                                </td>
                                {CRITERIA.map((c) => (
                                    <td key={c.key} className="px-3 py-3 text-center"><Tick value={r.criteria[c.key]} /></td>
                                ))}
                                <td className="px-4 py-3 text-center">
                                    <StatusBadge tone={r.badgeLit ? "success" : "warning"} label={r.badgeLit ? "LIT" : "unlit"} />
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{r.reviewerName ?? "—"}</td>
                                <td className={`px-4 py-3 whitespace-nowrap ${r.overdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                                    {r.nextReviewDate ?? "—"}{r.overdue ? " ⚠" : ""}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No rows match the current filter.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-subtle mt-4">
                Transparency applies to GGOMed only (no such check on m05ykm6e). GGOMed peer
                review is derived from a named clinical reviewer. Badge state: stored
                (GGOMed, Studio-reconciled) / computed predicate (Compass).
            </p>
        </div>
    );
}

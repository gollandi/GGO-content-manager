import Link from "next/link";
import { getEditorialContent } from "../../lib/views";
import {
    getContentCalendar,
    getTopicPool,
    getErnestoDesk,
    getPublishQueue,
    getNewsletterItems,
    getContentNeeds,
} from "../../lib/notion/editorial";
import { settle, type Settled } from "../../lib/settle";
import StatusBadge, { getStatusTone } from "../../components/StatusBadge";

/**
 * Module 1 — Editorial views (spec §3). One surface over the two truths:
 * the GGOMed site read LIVE via GROQ, and the editorial workflow state
 * read from Notion (Calendar, Topic Pool, Desk, Publish Queue, Newsletter,
 * Content Needs). Aggregated filters cut across all sections.
 */
export const dynamic = "force-dynamic";

function Section({ title, note, error, children }: {
    title: string;
    note?: string;
    error?: string | null;
    children?: React.ReactNode;
}) {
    return (
        <section className="bg-white rounded-2xl border border-border-default p-5 mb-6">
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-base font-bold">{title}</h2>
                {note && <span className="text-xs text-subtle">{note}</span>}
            </div>
            {error ? (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900">
                    Unavailable: {error} — set the DB id in .env.local (see .env.example).
                </div>
            ) : (
                children
            )}
        </section>
    );
}

const matches = (q: string, ...fields: (string | null | undefined)[]) =>
    !q || fields.some((f) => f?.toLowerCase().includes(q));

export default async function EditorialPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; due?: string }>;
}) {
    const { q: rawQ = "", due = "" } = await searchParams;
    const q = rawQ.toLowerCase();

    const [site, calendar, topics, desk, queue, newsletter, needs] =
        await Promise.all([
            settle(getEditorialContent),
            settle(getContentCalendar),
            settle(getTopicPool),
            settle(getErnestoDesk),
            settle(getPublishQueue),
            settle(getNewsletterItems),
            settle(getContentNeeds),
        ]);

    const today = new Date().toISOString().slice(0, 10);
    const reviewDue = (d: string | null) => !!d && d <= today;

    const siteRows = (site.data ?? [])
        .filter((r) => matches(q, r.title, r.slug, r.category))
        .filter((r) => (due === "review" ? reviewDue(r.lastReviewed) === false && r.lastReviewed !== null : true));

    const calRows = (calendar.data ?? []).filter((r) => matches(q, r.topicTitle, r.status, r.contentType));
    const topicRows = (topics.data ?? []).filter((r) => matches(q, r.title, r.cluster, r.status));
    const deskRows = (desk.data ?? []).filter((r) => matches(q, r.item, r.type, r.status));
    const queueRows = (queue.data ?? []).filter((r) => matches(q, r.title, r.platform ?? undefined, r.format ?? undefined));
    const newsRows = (newsletter.data ?? []).filter((r) => matches(q, r.title, r.status));
    const needRows = (needs.data ?? []).filter((r) => matches(q, r.need, r.source, r.actionStatus));

    const counts = {
        site: site.data?.length ?? 0,
        pifLit: site.data?.filter((r) => r.showPifTick).length ?? 0,
        deskPending: desk.data?.filter((r) => r.status === "Pending").length ?? 0,
        topicsNew: topics.data?.filter((r) => r.status === "New").length ?? 0,
        calScheduled: calendar.data?.filter((r) => r.status === "Scheduled").length ?? 0,
        needsOpen: needs.data?.filter((r) => r.actionStatus !== "Done").length ?? 0,
    };

    return (
        <div className="p-8 max-lg:p-4">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Editorial</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Site content live from Sanity (GROQ, no mirror) · workflow state live
                    from Notion. One filter cuts across every section.
                </p>
            </header>

            {/* Aggregated stat strip */}
            <div className="grid grid-cols-6 max-lg:grid-cols-3 gap-3 mb-6">
                {[
                    { label: "Site pages", value: counts.site },
                    { label: "PIF badge lit", value: counts.pifLit },
                    { label: "Desk pending", value: counts.deskPending },
                    { label: "Topics new", value: counts.topicsNew },
                    { label: "Cal. scheduled", value: counts.calScheduled },
                    { label: "Needs open", value: counts.needsOpen },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl border border-border-default p-4">
                        <div className="text-2xl font-bold">{s.value}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Cross-source filter */}
            <form method="GET" className="flex items-center gap-3 mb-6">
                <input
                    type="text"
                    name="q"
                    defaultValue={rawQ}
                    placeholder="Filter everything — title, cluster, status, platform…"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border-default bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ggo-teal"
                />
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-ggo-purple to-ggo-teal text-white text-sm font-semibold">
                    Filter
                </button>
                {rawQ && (
                    <Link href="/editorial" className="text-sm text-muted-foreground hover:text-ggo-purple">Clear</Link>
                )}
            </form>

            <Section title="Site content — live GROQ" note={`${siteRows.length} of ${counts.site} · gxyjgvr0/production`} error={site.error}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-default text-left">
                                <th className="px-3 py-2 font-semibold">Title</th>
                                <th className="px-3 py-2 font-semibold">Type</th>
                                <th className="px-3 py-2 font-semibold">Category</th>
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Last reviewed</th>
                                <th className="px-3 py-2 font-semibold text-center">PIF</th>
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {siteRows.slice(0, 100).map((r) => (
                                <tr key={r._id} className="border-b border-border-soft hover:bg-surface-muted/50">
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{r.title ?? "(untitled)"}</div>
                                        <div className="text-xs text-subtle">{r.pathname}</div>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{r._type}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.lastReviewed ?? "—"}</td>
                                    <td className="px-3 py-2 text-center">{r.showPifTick ? "✓" : "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r._updatedAt.slice(0, 10)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {siteRows.length > 100 && <p className="text-xs text-subtle mt-2">Showing first 100 — refine the filter.</p>}
                </div>
            </Section>

            <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-6">
                <Section title="Content Calendar" note={`${calRows.length} rows`} error={calendar.error}>
                    <ul className="divide-y divide-border-soft">
                        {calRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.topicTitle || "(untitled)"}</div>
                                    <div className="text-xs text-subtle">{r.date ?? "no date"}{r.contentType ? ` · ${r.contentType}` : ""}{r.sanitySync ? " · synced" : ""}</div>
                                </div>
                                {r.status && <StatusBadge tone={getStatusTone(r.status)} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Topic Pool" note={`${topicRows.length} rows`} error={topics.error}>
                    <ul className="divide-y divide-border-soft">
                        {topicRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.title || "(untitled)"}</div>
                                    <div className="text-xs text-subtle">{[r.cluster, r.urgency, r.seoPriority].filter(Boolean).join(" · ") || "—"}</div>
                                </div>
                                {r.status && <StatusBadge tone={r.status === "New" ? "info" : "secondary"} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Ernesto Desk" note={`${deskRows.length} rows · JJ decides in Notion`} error={desk.error}>
                    <ul className="divide-y divide-border-soft">
                        {deskRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.item || "(untitled)"}</div>
                                    <div className="text-xs text-subtle">{[r.type, r.priority, r.due].filter(Boolean).join(" · ") || "—"}</div>
                                </div>
                                {r.status && (
                                    <StatusBadge
                                        tone={r.status === "Pending" ? "warning" : r.status === "Done" ? "success" : "secondary"}
                                        label={r.status}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Publish Queue → Social" note={`${queueRows.length} rows`} error={queue.error}>
                    <ul className="divide-y divide-border-soft">
                        {queueRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.title || r.captionSnippet.slice(0, 60) || "(untitled)"}</div>
                                    <div className="text-xs text-subtle">{[r.platform, r.format, r.publishedAt?.slice(0, 10)].filter(Boolean).join(" · ") || "—"}</div>
                                </div>
                                {r.status && <StatusBadge tone={r.status === "Failed" ? "danger" : "secondary"} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Newsletter Items" note={`${newsRows.length} rows`} error={newsletter.error}>
                    <ul className="divide-y divide-border-soft">
                        {newsRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div className="text-sm font-medium">{r.title || "(untitled)"}</div>
                                {r.status && <StatusBadge tone={r.status === "Ready" ? "success" : "secondary"} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Content Needs" note={`${needRows.length} rows`} error={needs.error}>
                    <ul className="divide-y divide-border-soft">
                        {needRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.need || "(untitled)"}</div>
                                    <div className="text-xs text-subtle">{r.source ?? "—"}</div>
                                </div>
                                {r.actionStatus && (
                                    <StatusBadge
                                        tone={r.actionStatus === "Done" ? "success" : r.actionStatus === "Blocked" ? "danger" : "info"}
                                        label={r.actionStatus}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </Section>
            </div>
        </div>
    );
}

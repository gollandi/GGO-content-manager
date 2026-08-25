import Link from "next/link";
import { getEditorialContent, getDraftDelta } from "../../lib/views";
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
import ArticleActions from "../../components/ArticleActions";
import { loadPatches } from "../../lib/cancello/patches";
import Citofono from "../../components/Citofono";
import NeedIntakeForm from "../../components/NeedIntakeForm";
import ImpactReviewCard from "../../components/ImpactReviewCard";

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
        <section className="paper mb-6 border border-paper-edge text-paper-foreground">
            <div className="flex items-baseline justify-between gap-3 border-b-[3px] border-double border-paper-edge px-5 py-3">
                <h2 className="document-title text-[17px]">{title}</h2>
                {note && <span className="serial text-paper-foreground-soft">{note}</span>}
            </div>
            <div className="px-5 py-4">
                {error ? (
                    <div className="border border-sepia px-3 py-2.5 text-xs text-sepia">
                        Unavailable: {error} — set the DB id in .env.local (see .env.example).
                    </div>
                ) : (
                    children
                )}
            </div>
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

    const [site, calendar, topics, desk, queue, newsletter, needs, dariaDrafts] =
        await Promise.all([
            settle(getEditorialContent),
            settle(getContentCalendar),
            settle(getTopicPool),
            settle(getErnestoDesk),
            settle(getPublishQueue),
            settle(getNewsletterItems),
            settle(getContentNeeds),
            settle(getDraftDelta),
        ]);

    // Prepared patches on the house's disk, keyed by Sanity doc id: the table
    // shows which pages already have reviewed work waiting at the gate.
    const patchDocIds = new Set(loadPatches().map((p) => p.sanityDocId));

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
    // Impact loop: verdicts due = success defined, review date reached, no verdict yet
    const impactDue = (needs.data ?? []).filter(
        (r) =>
            r.successDefinition &&
            r.impactReviewDate &&
            r.impactReviewDate <= today &&
            (!r.impactOutcome || r.impactOutcome === "Pending")
    );

    const counts = {
        site: site.data?.length ?? 0,
        pifLit: site.data?.filter((r) => r.showPifTick).length ?? 0,
        deskPending: desk.data?.filter((r) => r.status === "Pending").length ?? 0,
        topicsNew: topics.data?.filter((r) => r.status === "New").length ?? 0,
        calScheduled: calendar.data?.filter((r) => r.status === "Scheduled").length ?? 0,
        needsOpen: needs.data?.filter((r) => r.actionStatus !== "Done").length ?? 0,
    };

    return (
        <>
        <div className="p-8 max-lg:p-4">
            <header className="mb-6 border-b border-plate-rule pb-4">
                <p className="column-label">Editorial · la scrivania</p>
                <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">Editorial</h1>
                <p className="mt-2 max-w-[38rem] text-[13px] leading-relaxed text-plate-foreground-soft">
                    Sito letto vivo da Sanity (GROQ, senza specchio) · stato del flusso letto
                    vivo da Notion. Un solo filtro taglia ogni sezione.
                </p>
            </header>

            {/* Aggregated stat strip */}
            <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                {[
                    { label: "Site pages", value: counts.site },
                    { label: "PIF badge lit", value: counts.pifLit },
                    { label: "Desk pending", value: counts.deskPending },
                    { label: "Topics new", value: counts.topicsNew },
                    { label: "Cal. scheduled", value: counts.calScheduled },
                    { label: "Needs open", value: counts.needsOpen },
                ].map((s) => (
                    <div key={s.label} className="flex items-baseline gap-2">
                        <span className="tabular font-serif text-[24px] font-bold text-plate-foreground-strong">{s.value}</span>
                        <span className="column-label">{s.label}</span>
                    </div>
                ))}
                <Link href="/editorial/daria" className="group flex items-baseline gap-2" title="Il lavoro di Daria, pre/post a confronto">
                    <span className="tabular font-serif text-[24px] font-bold text-stamp">
                        {dariaDrafts.data?.length ?? 0}
                    </span>
                    <span className="column-label group-hover:text-engraving-bright">Daria pre/post →</span>
                </Link>
            </div>

            {/* Cross-source filter */}
            <form method="GET" className="flex items-center gap-3 mb-6">
                <input
                    type="text"
                    name="q"
                    defaultValue={rawQ}
                    placeholder="Filtra tutto — titolo, cluster, stato, piattaforma…"
                    className="flex-1 border border-plate-rule bg-transparent px-4 py-2.5 text-sm text-plate-foreground outline-none placeholder:text-plate-foreground-soft focus:border-engraving-bright"
                />
                <button type="submit" className="act-quiet">
                    Filtra
                </button>
                {rawQ && (
                    <Link href="/editorial" className="font-condensed text-[11px] uppercase tracking-[0.12em] text-plate-foreground-soft hover:text-engraving-bright">Pulisci</Link>
                )}
            </form>

            <Section title="Site content — live GROQ" note={`${siteRows.length} of ${counts.site} · gxyjgvr0/production`} error={site.error}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-[3px] border-double border-paper-edge text-left">
                                <th className="column-label column-label-paper px-3 py-2 font-bold">Title</th>
                                <th className="column-label column-label-paper px-3 py-2 font-bold">Type</th>
                                <th className="column-label column-label-paper px-3 py-2 font-bold">Category</th>
                                <th className="column-label column-label-paper px-3 py-2 font-bold whitespace-nowrap">Last reviewed</th>
                                <th className="column-label column-label-paper px-3 py-2 font-bold text-center">PIF</th>
                                <th className="column-label column-label-paper px-3 py-2 font-bold whitespace-nowrap">Updated</th>
                                <th className="column-label column-label-paper px-3 py-2 font-bold text-right">Lavori</th>
                            </tr>
                        </thead>
                        <tbody>
                            {siteRows.slice(0, 100).map((r) => (
                                <tr key={r._id} className="border-b border-paper-edge hover:bg-[var(--engraving-wash)]">
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{r.title ?? "(untitled)"}</div>
                                        <div className="text-xs text-paper-foreground-soft">{r.pathname}</div>
                                    </td>
                                    <td className="px-3 py-2 text-paper-foreground-soft">{r._type}</td>
                                    <td className="px-3 py-2 text-paper-foreground-soft">{r.category ?? "—"}</td>
                                    <td className="px-3 py-2 text-paper-foreground-soft whitespace-nowrap">{r.lastReviewed ?? "—"}</td>
                                    <td className="px-3 py-2 text-center">{r.showPifTick ? "✓" : "—"}</td>
                                    <td className="px-3 py-2 text-paper-foreground-soft whitespace-nowrap">{r._updatedAt.slice(0, 10)}</td>
                                    <td className="px-3 py-2 text-right align-top">
                                        <ArticleActions
                                            title={r.title ?? "(untitled)"}
                                            pathname={r.pathname ?? null}
                                            patchReady={patchDocIds.has(r._id)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {siteRows.length > 100 && <p className="text-xs text-paper-foreground-soft mt-2">Showing first 100 — refine the filter.</p>}
                </div>
            </Section>

            <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-6">
                <Section title="Content Calendar" note={`${calRows.length} rows`} error={calendar.error}>
                    <ul className="divide-y divide-paper-edge">
                        {calRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.topicTitle || "(untitled)"}</div>
                                    <div className="text-xs text-paper-foreground-soft">{r.date ?? "no date"}{r.contentType ? ` · ${r.contentType}` : ""}{r.sanitySync ? " · synced" : ""}</div>
                                </div>
                                {r.status && <StatusBadge tone={getStatusTone(r.status)} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Topic Pool" note={`${topicRows.length} rows`} error={topics.error}>
                    <ul className="divide-y divide-paper-edge">
                        {topicRows.slice(0, 25).map((r) => {
                            const brief = [
                                `Scrivi la pagina GGOMed per il topic: "${r.title}".`,
                                r.cluster ? `Cluster: ${r.cluster}.` : "",
                                r.angle ? `Angolo editoriale: ${r.angle}` : "",
                                r.sourceUrl ? `Fonte di partenza: ${r.sourceUrl}` : "",
                                r.seoPriority ? `Priorità SEO: ${r.seoPriority}.` : "",
                                "Pubblico UK, voce JJ.",
                            ].filter(Boolean).join("\n");
                            return (
                                <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium">{r.title || "(untitled)"}</div>
                                        <div className="text-xs text-paper-foreground-soft">{[r.cluster, r.urgency, r.seoPriority].filter(Boolean).join(" · ") || "—"}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {r.status && <StatusBadge tone={r.status === "New" ? "info" : "secondary"} label={r.status} />}
                                        <a
                                            href={`/casa-di-ernesto?brief=${encodeURIComponent(brief)}`}
                                            className="font-condensed text-[10px] font-bold uppercase tracking-[0.12em] text-engraving-ink hover:text-seal whitespace-nowrap"
                                        >
                                            ✍︎ Scrivi con Ernesto
                                        </a>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Section>

                <Section title="Ernesto Desk" note={`${deskRows.length} rows · JJ decides in Notion`} error={desk.error}>
                    <ul className="divide-y divide-paper-edge">
                        {deskRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.item || "(untitled)"}</div>
                                    <div className="text-xs text-paper-foreground-soft">{[r.type, r.priority, r.due].filter(Boolean).join(" · ") || "—"}</div>
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
                    <ul className="divide-y divide-paper-edge">
                        {queueRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.title || r.captionSnippet.slice(0, 60) || "(untitled)"}</div>
                                    <div className="text-xs text-paper-foreground-soft">{[r.platform, r.format, r.publishedAt?.slice(0, 10)].filter(Boolean).join(" · ") || "—"}</div>
                                </div>
                                {r.status && <StatusBadge tone={r.status === "Failed" ? "danger" : "secondary"} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Newsletter Items" note={`${newsRows.length} rows`} error={newsletter.error}>
                    <ul className="divide-y divide-paper-edge">
                        {newsRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div className="text-sm font-medium">{r.title || "(untitled)"}</div>
                                {r.status && <StatusBadge tone={r.status === "Ready" ? "success" : "secondary"} label={r.status} />}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section
                    title="Impact review dovute"
                    note={`${impactDue.length} verdetti da dare — PIF measuring impact`}
                    error={needs.error}
                >
                    {impactDue.length === 0 ? (
                        <p className="text-xs text-paper-foreground-soft">Nessuna review dovuta. I need con definizione di successo compaiono qui alla data di verifica.</p>
                    ) : (
                        <ul className="divide-y divide-paper-edge">
                            {impactDue.slice(0, 15).map((r) => (
                                <ImpactReviewCard
                                    key={r.id}
                                    id={r.id}
                                    need={r.need}
                                    successDefinition={r.successDefinition}
                                    reviewDate={r.impactReviewDate}
                                />
                            ))}
                        </ul>
                    )}
                </Section>

                <Section title="Content Needs" note={`${needRows.length} rows`} error={needs.error}>
                    <NeedIntakeForm />
                    <ul className="divide-y divide-paper-edge">
                        {needRows.slice(0, 25).map((r) => (
                            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium">{r.need || "(untitled)"}</div>
                                    <div className="text-xs text-paper-foreground-soft">{r.source ?? "—"}</div>
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
            <Citofono voice="edmondo" />
        </>
    );
}

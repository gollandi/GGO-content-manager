import Link from "next/link";
import { getPifGgomed, getPifCompass } from "../../lib/views";
import { normaliseGgomed, normaliseCompass, type PifRow } from "../../lib/pif/normalise";
import { settle } from "../../lib/settle";
import { Guilloche, Socket, Mark } from "../../components/Registro";

/**
 * Module 2 — PIF Tick. Every criterion, per asset, across BOTH Sanity
 * projects, in one ruled register. Live GROQ — no mirror. Server component.
 *
 * In the register's vocabulary the mapping is literal: a criterion met is a
 * tick struck in engraving ink, a criterion failed is a strike in seal red,
 * and the badge itself is a socket — lit is sealed, unlit still waits.
 */
export const dynamic = "force-dynamic";

const CRITERIA: { key: keyof PifRow["criteria"]; label: string }[] = [
    { key: "evidenceBased", label: "Evidence" },
    { key: "readability", label: "Readability" },
    { key: "inclusivity", label: "Inclusivity" },
    { key: "expertPeerReview", label: "Peer review" },
    { key: "transparency", label: "Transparency" },
];

function Tick({ value }: { value: boolean | null }) {
    if (value === null) {
        return <span className="text-paper-foreground-soft" title="Not applicable / not assessed">—</span>;
    }
    return value ? (
        <span className="font-bold text-engraving-ink" title="Ticked">✓</span>
    ) : (
        <span className="font-bold text-seal" title="Not ticked">✗</span>
    );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={
                active
                    ? "border-b-2 border-engraving-bright px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-[0.12em] text-engraving-bright"
                    : "border-b-2 border-transparent px-3 py-1.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.12em] text-plate-foreground-soft hover:text-plate-foreground"
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
        <>
            <div className="relative min-h-screen overflow-hidden">
                <Guilloche
                    size={860}
                    rings={4}
                    opacity={0.16}
                    className="pointer-events-none absolute -right-64 -top-56 h-[860px] w-[860px]"
                />

                <header className="relative border-b border-plate-rule px-8 pb-4 pt-7 max-sm:px-4">
                    <p className="column-label">PIF Tick · certificazione</p>
                    <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                        {rows.length === 0
                            ? "Il registro dei criteri"
                            : lit === rows.length
                                ? "Ogni badge è sigillato"
                                : `${rows.length - lit} badge senza sigillo`}
                    </h1>
                    <p className="mt-2 max-w-[38rem] text-[13px] leading-relaxed text-plate-foreground-soft">
                        Ogni criterio, per asset, sui due progetti Sanity — <strong className="text-plate-foreground">gxyjgvr0</strong> e{" "}
                        <strong className="text-plate-foreground">m05ykm6e</strong> — letti vivi via GROQ, senza specchio Notion.
                    </p>

                    {/* The running totals, struck like a certificate's margin line. */}
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                        {[
                            { label: "asset tracciati", value: rows.length, tone: "text-plate-foreground-strong" },
                            { label: "badge sigillati", value: lit, tone: "text-engraving-bright" },
                            { label: "senza sigillo", value: rows.length - lit, tone: "text-seal-bright" },
                            { label: "review scadute", value: overdue, tone: overdue > 0 ? "text-sepia-bright" : "text-plate-foreground-soft" },
                        ].map((s) => (
                            <div key={s.label} className="flex items-baseline gap-2">
                                <span className={`tabular font-serif text-[26px] font-bold ${s.tone}`}>{s.value}</span>
                                <span className="column-label">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </header>

                {(ggomed.error || compass.error) && (
                    <div className="relative mx-8 mt-5 border border-sepia px-4 py-3 text-[13px] text-sepia-bright max-sm:mx-4" role="alert">
                        {ggomed.error && <p><strong>GGOMed view failed:</strong> {ggomed.error}</p>}
                        {compass.error && <p><strong>Compass view failed:</strong> {compass.error}</p>}
                        <p className="mt-1 text-[11px] opacity-80">Check SANITY_VIEWER_TOKEN / SANITY_M05_VIEWER_TOKEN in .env.local (see .env.example).</p>
                    </div>
                )}

                <div className="relative px-8 py-5 max-sm:px-4">
                    {/* Filters, cut into the plate. */}
                    <div className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-plate-rule pb-0">
                        <span className="column-label mr-2 pb-1.5">Fonte</span>
                        {["all", "ggomed", "compass"].map((s) => (
                            <FilterLink key={s} href={filterHref(s, state)} label={s === "all" ? "Tutte" : s === "ggomed" ? "Sito GGOMed" : "Compass"} active={source === s} />
                        ))}
                        <span className="column-label ml-6 mr-2 pb-1.5">Stato</span>
                        {[
                            ["all", "Tutti"],
                            ["badge-lit", "Sigillati"],
                            ["unlit", "Senza sigillo"],
                            ["gaps", "Criteri mancanti"],
                            ["overdue", "Scaduti"],
                        ].map(([st, label]) => (
                            <FilterLink key={st} href={filterHref(source, st)} label={label} active={state === st} />
                        ))}
                    </div>

                    {/* The ruled register of criteria. */}
                    <div className="paper overflow-x-auto border border-paper-edge">
                        <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
                            <thead>
                                <tr className="border-b-[3px] border-double border-paper-edge text-left">
                                    <th className="column-label column-label-paper px-4 py-2.5 font-bold">Asset</th>
                                    <th className="column-label column-label-paper px-4 py-2.5 font-bold">Fonte</th>
                                    {CRITERIA.map((c) => (
                                        <th key={c.key} className="column-label column-label-paper whitespace-nowrap px-3 py-2.5 text-center font-bold">{c.label}</th>
                                    ))}
                                    <th className="column-label column-label-paper px-4 py-2.5 text-center font-bold">Sigillo</th>
                                    <th className="column-label column-label-paper px-4 py-2.5 font-bold">Reviewer</th>
                                    <th className="column-label column-label-paper whitespace-nowrap px-4 py-2.5 font-bold">Prossima review</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => (
                                    <tr key={`${r.source}:${r.id}`} className="border-b border-paper-edge text-paper-foreground hover:bg-[var(--engraving-wash)]">
                                        <td className="px-4 py-2.5">
                                            <div className="font-medium">{r.title}</div>
                                            <div className="serial mt-0.5 text-paper-foreground-soft">{r.docType}{r.pathname ? ` · ${r.pathname}` : ""}</div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Mark tone={r.source === "ggomed" ? "stamped" : "quiet"} onPaper>
                                                {r.source === "ggomed" ? "GGOMed" : "Compass"}
                                            </Mark>
                                        </td>
                                        {CRITERIA.map((c) => (
                                            <td key={c.key} className="px-3 py-2.5 text-center"><Tick value={r.criteria[c.key]} /></td>
                                        ))}
                                        <td className="px-4 py-2.5 text-center">
                                            <Socket sealed={r.badgeLit} size={22} title={r.badgeLit ? "Badge lit" : "Badge unlit"} />
                                        </td>
                                        <td className="px-4 py-2.5 text-paper-foreground-soft">{r.reviewerName ?? "—"}</td>
                                        <td className={`whitespace-nowrap px-4 py-2.5 ${r.overdue ? "font-semibold text-seal" : "text-paper-foreground-soft"}`}>
                                            {r.nextReviewDate ?? "—"}{r.overdue ? " · scaduta" : ""}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-10 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                                            Nessuna riga per il filtro corrente
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-4 max-w-[44rem] text-[12px] leading-relaxed text-plate-foreground-soft">
                        Transparency vale solo per GGOMed (nessun check equivalente su m05ykm6e). Il peer
                        review GGOMed deriva dal clinico nominato. Stato badge: memorizzato
                        (GGOMed, riconciliato da Studio) / predicato calcolato (Compass).
                    </p>
                </div>
            </div>
        </>
    );
}

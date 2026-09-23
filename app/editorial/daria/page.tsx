import Link from "next/link";
import { getDraftDelta } from "../../../lib/views";
import type { DraftDeltaRow } from "../../../lib/views/types";
import { computeDocDelta, type FieldDelta } from "../../../lib/delta/doc-delta";
import { diffText } from "../../../lib/delta/word-diff";
import { settle } from "../../../lib/settle";
import { Mark } from "../../../components/Registro";

/**
 * The Daria register — pre/post over every pending draft in gxyjgvr0.
 *
 * Pre is the published document, post is the draft awaiting JJ's seal.
 * Reading only: the seal itself stays in Sanity Studio / Il Cancello,
 * never here (site publish is a JJ-only gate).
 */
export const dynamic = "force-dynamic";

/** Fields short enough to read side by side; prose gets the inline diff. */
const SIDE_BY_SIDE_MAX = 220;

function DiffProse({ pre, post }: { pre: string; post: string }) {
    return (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {diffText(pre, post).map((seg, i) =>
                seg.kind === "same" ? (
                    <span key={i}>{seg.text}</span>
                ) : seg.kind === "del" ? (
                    <del key={i} className="text-sepia line-through decoration-[1.5px]">
                        {seg.text}
                    </del>
                ) : (
                    <ins
                        key={i}
                        className="text-stamp no-underline"
                        style={{ background: "var(--stamp-wash)" }}
                    >
                        {seg.text}
                    </ins>
                )
            )}
        </p>
    );
}

function FieldRow({ delta }: { delta: FieldDelta }) {
    const sideBySide =
        delta.kind === "changed" &&
        Math.max(delta.pre.length, delta.post.length) <= SIDE_BY_SIDE_MAX;
    return (
        <div className="border-t border-paper-edge px-5 py-3">
            <div className="mb-1.5 flex items-baseline gap-2">
                <span className="column-label column-label-paper font-bold">{delta.field}</span>
                {delta.kind !== "changed" && (
                    <span className="text-[11px] uppercase tracking-[0.1em] text-paper-foreground-soft">
                        {delta.kind === "added" ? "added by the draft" : "removed by the draft"}
                    </span>
                )}
            </div>
            {sideBySide ? (
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                    <div>
                        <span className="column-label column-label-paper">pre</span>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-paper-foreground-soft">
                            {delta.pre}
                        </p>
                    </div>
                    <div>
                        <span className="column-label column-label-paper">post</span>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{delta.post}</p>
                    </div>
                </div>
            ) : (
                <DiffProse pre={delta.pre} post={delta.post} />
            )}
        </div>
    );
}

function DraftEntry({ row }: { row: DraftDeltaRow }) {
    const { publishedDoc, ...draft } = row;
    const deltas = computeDocDelta(draft, publishedDoc);
    const title =
        (typeof row.title === "string" && row.title) ||
        (typeof publishedDoc?.title === "string" && (publishedDoc.title as string)) ||
        "(untitled)";
    const slug = row.slug?.current ?? null;
    return (
        <section className="paper mb-6 border border-paper-edge text-paper-foreground">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-[3px] border-double border-paper-edge px-5 py-3">
                <div className="flex items-baseline gap-3">
                    <h2 className="document-title text-[17px]">{title}</h2>
                    <Mark tone={publishedDoc ? "stamped" : "pending"} onPaper>
                        {publishedDoc ? "draft over published" : "new document"}
                    </Mark>
                </div>
                <span className="serial text-paper-foreground-soft">
                    {row._type}
                    {slug ? ` · /${slug}` : ""} · {row._updatedAt.slice(0, 16).replace("T", " ")}
                </span>
            </div>
            {deltas.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-paper-foreground-soft">
                    The draft matches the published document — nothing to compare.
                </p>
            ) : (
                deltas.map((d) => <FieldRow key={d.field} delta={d} />)
            )}
        </section>
    );
}

export default async function DariaPage() {
    const drafts = await settle(getDraftDelta);
    const rows = drafts.data ?? [];

    return (
        <div className="p-8 max-lg:p-4">
            <header className="mb-6 border-b border-plate-rule pb-4">
                <p className="column-label">Editorial · Daria</p>
                <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                    Pre / post
                </h1>
                <p className="mt-2 max-w-[38rem] text-[13px] leading-relaxed text-plate-foreground-soft">
                    Ogni bozza in attesa a confronto con la pagina pubblicata:{" "}
                    <del className="text-sepia line-through">tolto</del> ·{" "}
                    <ins className="text-stamp no-underline" style={{ background: "var(--stamp-wash)" }}>
                        aggiunto
                    </ins>
                    . Il sigillo resta tuo, in Studio o al Cancello.
                </p>
                <Link
                    href="/editorial"
                    className="mt-3 inline-block font-condensed text-[11px] uppercase tracking-[0.12em] text-plate-foreground-soft hover:text-engraving-bright"
                >
                    ← Editorial
                </Link>
            </header>

            {drafts.error ? (
                <div className="border border-sepia px-3 py-2.5 text-xs text-sepia">
                    Unavailable: {drafts.error}
                </div>
            ) : rows.length === 0 ? (
                <p className="text-[13px] text-plate-foreground-soft">
                    Nessuna bozza in attesa — la scrivania di Daria è sgombra.
                </p>
            ) : (
                rows.map((row) => <DraftEntry key={row._id} row={row} />)
            )}
        </div>
    );
}

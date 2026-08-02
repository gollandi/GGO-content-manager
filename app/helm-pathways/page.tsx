import Link from "next/link";
import AppShell from "../../components/AppShell";
import StatusBadge from "../../components/StatusBadge";
import { getPifCompass } from "../../lib/views";
import { normaliseCompass } from "../../lib/pif/normalise";
import { settle } from "../../lib/settle";

export const dynamic = "force-dynamic";

function filterHref(state: string) {
  return `/helm-pathways?state=${state}`;
}

function FilterLink({ state, active, label }: { state: string; active: boolean; label: string }) {
  return (
    <Link
      href={filterHref(state)}
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

export default async function HelmPathwaysPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state = "certified" } = await searchParams;
  const compass = await settle(getPifCompass);
  const rows = compass.data ? normaliseCompass(compass.data) : [];

  const certifiedRows = rows.filter((row) => row.badgeLit);
  const certificationDocs = rows.filter((row) => row.certified).length;
  const overdueRows = rows.filter((row) => row.overdue);
  const gapRows = rows.filter((row) => !row.allTicked);

  const filtered = rows.filter((row) => {
    switch (state) {
      case "all":
        return true;
      case "cert-doc":
        return row.certified;
      case "gaps":
        return !row.allTicked;
      case "overdue":
        return row.overdue;
      case "certified":
      default:
        return row.badgeLit;
    }
  });

  return (
    <AppShell>
      <div className="p-8 max-lg:p-4">
        <header className="mb-6 border-b border-plate-rule pb-4">
          <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">The Helm Pathways</h1>
          <p className="mt-2 max-w-[38rem] text-[13px] leading-relaxed text-plate-foreground-soft">
            PIF Tick certified pathways from The Helm / Compass Sanity slice
            (<strong>m05ykm6e</strong>). Default view shows pathways where the patient-facing
            badge is currently valid.
          </p>
        </header>

        {compass.error && (
          <div className="mb-6 p-4  border border-sepia text-sm text-sepia">
            <p><strong>Compass view failed:</strong> {compass.error}</p>
            <p className="mt-1 text-xs">Check SANITY_M05_VIEWER_TOKEN and tenant scope in .env.local.</p>
          </div>
        )}

        <div className="grid grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4 mb-6">
          {[
            { label: "Certified pathways", value: certifiedRows.length },
            { label: "Certification docs", value: certificationDocs },
            { label: "Criterion gaps", value: gapRows.length },
            { label: "Review overdue", value: overdueRows.length },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2">
              <div className="tabular font-serif text-[26px] font-bold text-plate-foreground-strong">{stat.value}</div>
              <div className="column-label">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="column-label mr-2">State</span>
          <FilterLink state="certified" active={state === "certified"} label="PIF Tick certified" />
          <FilterLink state="cert-doc" active={state === "cert-doc"} label="Has cert doc" />
          <FilterLink state="gaps" active={state === "gaps"} label="Criterion gaps" />
          <FilterLink state="overdue" active={state === "overdue"} label="Overdue" />
          <FilterLink state="all" active={state === "all"} label="All Helm pathways" />
          <Link
            href="/pif-tick?source=compass&state=badge-lit"
            className="ml-auto border-b-2 border-transparent px-3 py-1.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.12em] text-plate-foreground-soft hover:text-plate-foreground"
          >
            Open in PIF grid
          </Link>
        </div>

        <div className="paper border border-paper-edge overflow-x-auto text-paper-foreground">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-[3px] border-double border-paper-edge text-left">
                <th className="column-label column-label-paper px-4 py-3 font-bold">Pathway</th>
                <th className="column-label column-label-paper px-4 py-3 font-bold">Type</th>
                <th className="column-label column-label-paper px-4 py-3 font-bold text-center">Badge</th>
                <th className="column-label column-label-paper px-4 py-3 font-bold text-center">Checks</th>
                <th className="column-label column-label-paper px-4 py-3 font-bold">Reviewer</th>
                <th className="column-label column-label-paper px-4 py-3 font-bold whitespace-nowrap">Next review</th>
                <th className="column-label column-label-paper px-4 py-3 font-bold whitespace-nowrap">Signed at</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-paper-edge hover:bg-[var(--engraving-wash)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-xs text-paper-foreground-soft">{row.id}</div>
                  </td>
                  <td className="px-4 py-3 text-paper-foreground-soft">{row.docType}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge tone={row.badgeLit ? "success" : "warning"} label={row.badgeLit ? "PIF Tick" : "not live"} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge tone={row.allTicked ? "success" : "warning"} label={row.allTicked ? "complete" : "gaps"} />
                  </td>
                  <td className="px-4 py-3 text-paper-foreground-soft">{row.reviewerName ?? "-"}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${row.overdue ? "text-seal font-semibold" : "text-paper-foreground-soft"}`}>
                    {row.nextReviewDate ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-paper-foreground-soft whitespace-nowrap">{row.lastAssessedAt ?? "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-paper-foreground-soft">No Helm pathways match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-plate-foreground-soft mt-4">
          Badge validity follows the existing Compass predicate: certification exists, sync status is not
          flag-for-review, review is not lapsed, and all four applicable PIF checks are ticked.
        </p>
      </div>
    </AppShell>
  );
}

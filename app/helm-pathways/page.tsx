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
          ? "px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-ggo-purple to-ggo-teal text-white"
          : "px-3 py-1.5 rounded-full text-xs font-medium bg-surface-muted text-charcoal hover:text-ggo-purple"
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
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">The Helm Pathways</h1>
          <p className="text-sm text-muted-foreground mt-1">
            PIF Tick certified pathways from The Helm / Compass Sanity slice
            (<strong>m05ykm6e</strong>). Default view shows pathways where the patient-facing
            badge is currently valid.
          </p>
        </header>

        {compass.error && (
          <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900">
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
            <div key={stat.label} className="bg-white rounded-2xl border border-border-default p-5">
              <div className="text-3xl font-bold">{stat.value}</div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-1">State</span>
          <FilterLink state="certified" active={state === "certified"} label="PIF Tick certified" />
          <FilterLink state="cert-doc" active={state === "cert-doc"} label="Has cert doc" />
          <FilterLink state="gaps" active={state === "gaps"} label="Criterion gaps" />
          <FilterLink state="overdue" active={state === "overdue"} label="Overdue" />
          <FilterLink state="all" active={state === "all"} label="All Helm pathways" />
          <Link
            href="/pif-tick?source=compass&state=badge-lit"
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-surface-muted text-charcoal hover:text-ggo-purple"
          >
            Open in PIF grid
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-border-default overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left">
                <th className="px-4 py-3 font-semibold">Pathway</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-center">Badge</th>
                <th className="px-4 py-3 font-semibold text-center">Checks</th>
                <th className="px-4 py-3 font-semibold">Reviewer</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Next review</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Signed at</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border-soft hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-xs text-subtle">{row.id}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.docType}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge tone={row.badgeLit ? "success" : "warning"} label={row.badgeLit ? "PIF Tick" : "not live"} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge tone={row.allTicked ? "success" : "warning"} label={row.allTicked ? "complete" : "gaps"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.reviewerName ?? "-"}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${row.overdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                    {row.nextReviewDate ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.lastAssessedAt ?? "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No Helm pathways match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-subtle mt-4">
          Badge validity follows the existing Compass predicate: certification exists, sync status is not
          flag-for-review, review is not lapsed, and all four applicable PIF checks are ticked.
        </p>
      </div>
    </AppShell>
  );
}

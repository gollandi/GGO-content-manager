import { redirect } from "next/navigation";

/**
 * Helm Pathways was the PIF Tick register filtered to the Compass project —
 * the same rows, the same criteria, the same badge logic, rendered twice.
 * One register now: the room folds into PIF Tick's own source filter.
 */
export default async function HelmPathwaysPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const mapped = state === "certified" ? "badge-lit" : state === "gaps" ? "gaps" : state === "overdue" ? "overdue" : "all";
  redirect(`/pif-tick?source=compass&state=${mapped}`);
}

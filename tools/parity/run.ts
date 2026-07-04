/**
 * Parity harness (spec S1.6 / §5.2) — the gate for Phase 3.
 *
 * Compares the doomed Notion mirror DBs (Content Assets, PIF Tick
 * Compliance) against the live GROQ views, and classifies every difference:
 *
 *   identical                    — mirror == live
 *   accounted:legacy-platform    — mirror row is a Legacy Website page (no live doc expected)
 *   accounted:temporal-skew      — live doc changed after the last weekly ETL run
 *   accounted:fallback-ticks     — mirror PIF tick set by applyFallbackTicks(), absent in Sanity
 *   accounted:notion-only-field  — value lives only in Notion (§5.3 divergence → MIGRATE before drop)
 *   UNEXPLAINED                  — fails the gate; Phase 3 stays locked
 *
 * Output: reports/parity-<date>.{md,json}. Exit 1 when UNEXPLAINED > 0.
 * Run: npm run parity
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Cause =
    | "identical"
    | "accounted:legacy-platform"
    | "accounted:temporal-skew"
    | "accounted:fallback-ticks"
    | "accounted:notion-only-field"
    | "accounted:stale-mirror-id"      // live doc found by pathname; stored Sanity ID is stale
    | "accounted:stale-mirror-deleted" // doc no longer exists in Sanity (verified raw) → archive row
    | "accounted:type-not-mirrored"    // legalPage — the old ETL never synced this type
    | "UNEXPLAINED";

interface Finding {
    key: string; // sanityId or mirror row id
    title: string;
    field: string;
    mirror: unknown;
    live: unknown;
    cause: Cause;
}

/** Last weekly ETL slot: most recent Sunday 04:00 UTC before now. */
function lastEtlRun(): Date {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0));
    while (d.getUTCDay() !== 0 || d > now) d.setUTCDate(d.getUTCDate() - 1);
    return d;
}

const norm = (s: unknown) =>
    String(s ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

async function main() {
    // Import AFTER env is loaded (clients read env at import time).
    const { getContentAssets, getPifValidations } = await import("../../lib/notion/services");
    const { ggomedClient, ggomedRawClient } = await import("../../lib/sanity/clients");
    const { editorialContentQuery, pifGgomedQuery } = await import("../../lib/views");

    console.log("Loading mirror rows (Notion) + live views (GROQ)…");
    const [assets, pifRows, liveContent, livePif] = await Promise.all([
        getContentAssets(),
        getPifValidations(),
        ggomedClient.fetch(editorialContentQuery),
        ggomedClient.fetch(pifGgomedQuery),
    ]);

    const etlCutoff = lastEtlRun();
    const findings: Finding[] = [];
    const liveById = new Map<string, (typeof liveContent)[number]>(liveContent.map((d: { _id: string }) => [d._id, d]));
    const livePifById = new Map<string, (typeof livePif)[number]>(livePif.map((d: { _id: string }) => [d._id, d]));
    const skewed = (docId: string) => {
        const doc = liveById.get(docId) ?? livePifById.get(docId);
        return !!doc && new Date(doc._updatedAt) > etlCutoff;
    };

    // ── Content Assets vs editorial-content view ────────────────────────
    let matched = 0;
    const liveByPathname = new Map<string, (typeof liveContent)[number]>(
        (liveContent as { pathname: string | null }[]).filter((d) => d.pathname).map((d) => [d.pathname as string, d as (typeof liveContent)[number]])
    );
    const resolvedLiveId = new Map<string, string>(); // mirror row id → live _id
    const staleRows = new Set<string>(); // rows matched only by pathname — whole row is stale
    const unresolvedAssets: { asset: (typeof assets)[number]; isLegacy: boolean }[] = [];
    for (const a of assets) {
        const isLegacy = a.platform.some((p) => /legacy/i.test(p));
        if (!a.sanityId) {
            findings.push({
                key: a.id, title: a.title, field: "(row)", mirror: "no Sanity ID", live: null,
                cause: isLegacy ? "accounted:legacy-platform" : "accounted:notion-only-field",
            });
            continue;
        }
        let live = liveById.get(a.sanityId);
        let matchedByPathname = false;
        if (!live && a.liveUrl) {
            const path = new URL(a.liveUrl).pathname;
            live = liveByPathname.get(path);
            matchedByPathname = !!live;
        }
        if (!live) {
            unresolvedAssets.push({ asset: a, isLegacy });
            continue;
        }
        if (matchedByPathname) {
            findings.push({
                key: a.id, title: a.title, field: "Sanity ID", mirror: a.sanityId, live: live._id,
                cause: "accounted:stale-mirror-id",
            });
            resolvedLiveId.set(a.id, live._id);
            staleRows.add(a.id);
        } else {
            resolvedLiveId.set(a.id, a.sanityId);
        }
        matched++;
        const pairs: [string, unknown, unknown][] = [
            ["title", a.title, live.title],
            ["pathname", a.liveUrl ? new URL(a.liveUrl).pathname : null, live.pathname],
        ];
        for (const [field, mirror, liveVal] of pairs) {
            if (norm(mirror) === norm(liveVal)) continue;
            findings.push({
                key: a.sanityId, title: a.title, field, mirror, live: liveVal,
                cause: staleRows.has(a.id)
                    ? "accounted:stale-mirror-id"
                    : skewed(resolvedLiveId.get(a.id) ?? a.sanityId)
                      ? "accounted:temporal-skew"
                      : "UNEXPLAINED",
            });
        }
        // Notion-only fields (the §5.3 migration list): status + relations
        if (a.status) {
            findings.push({ key: a.sanityId, title: a.title, field: "Status", mirror: a.status, live: "(not in Sanity)", cause: "accounted:notion-only-field" });
        }
    }

    // Unresolved mirror rows: check raw Sanity (drafts included) before judging.
    if (unresolvedAssets.length > 0) {
        const ids = unresolvedAssets.map((u) => u.asset.sanityId).filter(Boolean);
        const existing: string[] = ids.length
            ? await ggomedRawClient.fetch(`*[_id in $ids]._id`, { ids })
            : [];
        for (const { asset: a, isLegacy } of unresolvedAssets) {
            const cause: Cause = isLegacy
                ? "accounted:legacy-platform"
                : a.sanityId && !existing.includes(a.sanityId)
                  ? "accounted:stale-mirror-deleted"
                  : "UNEXPLAINED";
            findings.push({ key: a.sanityId || a.id, title: a.title, field: "(row)", mirror: "exists", live: "missing", cause });
        }
    }

    // ── PIF Compliance vs pif-ggomed view ───────────────────────────────
    const assetById = new Map(assets.map((a) => [a.id, a]));
    for (const v of pifRows) {
        const asset = v.contentAssetId ? assetById.get(v.contentAssetId) : undefined;
        const sanityId = asset ? (resolvedLiveId.get(asset.id) ?? asset.sanityId) : undefined;
        const live = sanityId ? livePifById.get(sanityId) : undefined;
        if (!live) {
            const isLegacy = asset?.platform.some((p) => /legacy/i.test(p)) ?? false;
            const parentDeleted = findings.some(
                (f) => f.key === (asset?.sanityId || asset?.id) && f.cause === "accounted:stale-mirror-deleted"
            );
            findings.push({
                key: v.id, title: v.title, field: "(pif row)", mirror: "exists", live: "no matching live doc",
                cause: isLegacy
                    ? "accounted:legacy-platform"
                    : parentDeleted
                      ? "accounted:stale-mirror-deleted"
                      : sanityId
                        ? "UNEXPLAINED"
                        : "accounted:notion-only-field",
            });
            continue;
        }
        const checks: [string, boolean, boolean | null | undefined][] = [
            ["evidenceBased", v.evidenceBasedReview, live.assessment?.evidenceBasedCheck],
            ["readability", v.patientReadability, live.assessment?.readabilityCheck],
            ["inclusivity", v.inclusivityAssessment, live.assessment?.healthInequalitiesCheck],
        ];
        for (const [field, mirrorTick, liveTick] of checks) {
            if (!!mirrorTick === !!liveTick) continue;
            findings.push({
                key: sanityId!, title: v.title, field: `pif.${field}`, mirror: mirrorTick, live: liveTick ?? null,
                // Mirror tick true with no live tick = the old ETL's
                // applyFallbackTicks() corroboration — the known cause.
                cause: mirrorTick && !liveTick
                    ? "accounted:fallback-ticks"
                    : asset && staleRows.has(asset.id)
                      ? "accounted:stale-mirror-id"
                      : skewed(sanityId!)
                        ? "accounted:temporal-skew"
                        : "UNEXPLAINED",
            });
        }
    }

    // ── Live docs with no mirror row (new since last ETL?) ──────────────
    const mirrorSanityIds = new Set([
        ...assets.map((a) => a.sanityId).filter(Boolean),
        ...resolvedLiveId.values(),
    ]);
    for (const doc of liveContent as { _id: string; _type: string; title: string | null; _updatedAt: string }[]) {
        if (mirrorSanityIds.has(doc._id)) continue;
        findings.push({
            key: doc._id, title: doc.title ?? "(untitled)", field: "(row)", mirror: "missing", live: "exists",
            cause:
                doc._type === "legalPage"
                    ? "accounted:type-not-mirrored"
                    : new Date(doc._updatedAt) > etlCutoff
                      ? "accounted:temporal-skew"
                      : "UNEXPLAINED",
        });
    }

    // ── Report ───────────────────────────────────────────────────────────
    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.cause] = (counts[f.cause] ?? 0) + 1;
    const unexplained = findings.filter((f) => f.cause === "UNEXPLAINED");
    const migrate = findings.filter((f) => f.cause === "accounted:notion-only-field");

    const stamp = new Date().toISOString().slice(0, 10);
    const dir = join(process.cwd(), "reports");
    mkdirSync(dir, { recursive: true });

    const row = (f: Finding) =>
        `| ${f.title.slice(0, 40)} | ${f.field} | ${String(f.mirror).slice(0, 40)} | ${String(f.live).slice(0, 40)} |`;
    const md = `# Parity report — ${stamp}

Mirror rows: ${assets.length} Content Assets, ${pifRows.length} PIF rows.
Live docs: ${liveContent.length} content, ${livePif.length} PIF-bearing. Matched: ${matched}.
ETL cutoff assumed: ${etlCutoff.toISOString()} (last weekly run).

## Verdict: ${unexplained.length === 0 ? "✅ RECONCILED — zero unexplained. Phase 3 gate OPEN." : `❌ ${unexplained.length} UNEXPLAINED — Phase 3 gate LOCKED.`}

| Cause | Count |
|---|---|
${Object.entries(counts).map(([c, n]) => `| ${c} | ${n} |`).join("\n")}

## UNEXPLAINED (${unexplained.length})
${unexplained.length ? `| Title | Field | Mirror | Live |\n|---|---|---|---|\n${unexplained.map(row).join("\n")}` : "None."}

## §5.3 Notion-only values — MIGRATE before retiring the mirror (${migrate.length})
${migrate.length ? `| Title | Field | Mirror | Live |\n|---|---|---|---|\n${migrate.slice(0, 60).map(row).join("\n")}${migrate.length > 60 ? `\n… +${migrate.length - 60} more (see JSON)` : ""}` : "None."}
`;
    writeFileSync(join(dir, `parity-${stamp}.md`), md);
    writeFileSync(join(dir, `parity-${stamp}.json`), JSON.stringify({ counts, findings }, null, 1));

    console.log(md.split("\n").slice(0, 14).join("\n"));
    console.log(`\nFull report: reports/parity-${stamp}.md`);
    process.exit(unexplained.length === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("Parity harness failed:", err);
    process.exit(2);
});

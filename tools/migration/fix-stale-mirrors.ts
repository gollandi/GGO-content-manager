/**
 * §5.3 migration, step 1 — repair the mirror rows the parity harness proved
 * stale (parity-2026-07-04, causes stale-mirror-*):
 *
 *  1. ARCHIVE the "Top 6 Urological Screenings" Content Asset row + its PIF
 *     Compliance row — the Sanity doc was verified deleted (raw, incl. drafts).
 *  2. REPAIR the "/erectile-dysfunction-relationship" Content Asset row:
 *     stored Sanity ID → the live doc id (partner-ed) + real title.
 *
 * DRY-RUN by default. Apply with: npm run migrate:stale -- --apply
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const APPLY = process.argv.includes("--apply");

const TARGETS = {
    // Resolved via DB query on Sanity ID 3ef8e79a-… (the parity key was the
    // Sanity id, not the Notion page id — caught by the dry-run).
    archiveAsset: "2e4d2f3d-906b-8174-80aa-f92a769b2a00", // Top 6 — Content Asset row
    archivePif: "2e5d2f3d-906b-8158-b3c8-f4e63efe68f5", // Top 6 — PIF Compliance row
    repairAsset: "321d2f3d-906b-8197-b259-c837bd8b6d66", // ED-relationship — Content Asset row
    repairSanityId: "partner-ed",
    // Exact live title (first apply used a guessed ending off the truncated
    // report value — parity caught it; never complete truncated data).
    repairTitle: "Erectile Dysfunction in a Relationship — A Guide for Both of You",
};

async function main() {
    const { notion } = await import("../../lib/notion/client");

    // Verify every target before touching anything.
    for (const [label, id] of [
        ["archiveAsset", TARGETS.archiveAsset],
        ["archivePif", TARGETS.archivePif],
        ["repairAsset", TARGETS.repairAsset],
    ] as const) {
        const page = (await notion.pages.retrieve({ page_id: id })) as {
            archived?: boolean;
            properties?: Record<string, unknown>;
        };
        console.log(`${label}: found (archived=${page.archived ?? false})`);
    }

    if (!APPLY) {
        console.log("\nDRY-RUN — nothing changed. Re-run with --apply to execute:");
        console.log(`  archive ${TARGETS.archiveAsset} (Content Asset "Top 6 Urological Screenings")`);
        console.log(`  archive ${TARGETS.archivePif} (PIF row "Top 6 Urological Screenings")`);
        console.log(`  repair  ${TARGETS.repairAsset}: Sanity ID → "${TARGETS.repairSanityId}", Title → "${TARGETS.repairTitle}"`);
        return;
    }

    for (const [label, id] of [
        ["Content Asset (Top 6)", TARGETS.archiveAsset],
        ["PIF row (Top 6)", TARGETS.archivePif],
    ] as const) {
        const page = (await notion.pages.retrieve({ page_id: id })) as { archived?: boolean };
        if (page.archived) {
            console.log(`= già archiviata: ${label}`);
        } else {
            await notion.pages.update({ page_id: id, archived: true });
            console.log(`✓ archived ${label}`);
        }
    }
    await notion.pages.update({
        page_id: TARGETS.repairAsset,
        properties: {
            "Sanity ID": { rich_text: [{ type: "text", text: { content: TARGETS.repairSanityId } }] },
            Title: { title: [{ type: "text", text: { content: TARGETS.repairTitle } }] },
        },
    });
    console.log("✓ repaired ED-relationship row (Sanity ID + Title)");
    console.log("\nDone — re-run `npm run parity` to confirm the causes disappear.");
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});

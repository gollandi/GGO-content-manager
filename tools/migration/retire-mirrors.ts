/**
 * FASE 3 FINALE — pensionamento dei DB mirror. READY BUT DARK.
 *
 * Archivia le righe di Evidence Sources e Schema Validation (zero consumer,
 * spec §5.4) e SVUOTA Content Assets dei campi mirror… NO: per il Meccanismo
 * A lo stub sopravvive — questo script NON tocca Content Assets né PIF
 * Compliance finché anche pif-tick-lookup legacy non è morto.
 *
 * Scope di QUESTO script (il primo taglio sicuro):
 *   - Evidence Sources: archivia tutte le righe (nessun consumer operativo)
 *   - Schema Validation: archivia tutte le righe (nessun consumer operativo)
 *
 * GATE MULTIPLI, tutti obbligatori:
 *   1. --apply (default: dry-run)
 *   2. --views-live: dichiari che ernesto gira con COCKPIT_VIEWS_URL attiva
 *      da almeno una settimana senza errori (R9 — questo script non può
 *      verificarlo da qui, la dichiarazione è tua)
 *   3. parity dell'ULTIMO run dev'essere RECONCILED (verificato dal report)
 *
 * Anche dopo: le righe sono ARCHIVIATE, non cancellate — Notion le recupera.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const VIEWS_LIVE = process.argv.includes("--views-live");

async function main() {
    // Gate 3: latest parity report must be RECONCILED
    const reportsDir = join(process.cwd(), "reports");
    const reports = readdirSync(reportsDir).filter((f) => f.match(/^parity-.*\.md$/)).sort();
    if (reports.length === 0) throw new Error("Nessun parity report — esegui npm run parity prima");
    const latest = readFileSync(join(reportsDir, reports[reports.length - 1]), "utf8");
    if (!latest.includes("RECONCILED")) {
        throw new Error(`Ultimo parity (${reports[reports.length - 1]}) NON riconciliato — gate chiuso`);
    }
    console.log(`Gate parity: ✓ (${reports[reports.length - 1]} RECONCILED)`);

    const { notion } = await import("../../lib/notion/client");
    const { notionConfig } = await import("../../lib/config");

    const targets = [
        { label: "Evidence Sources", dbId: notionConfig.dbs.evidenceSources() },
        { label: "Schema Validation", dbId: notionConfig.dbs.schemaValidation() },
    ];

    for (const t of targets) {
        let cursor: string | undefined = undefined;
        const ids: string[] = [];
        do {
            const res: { results: { id: string }[]; next_cursor: string | null } =
                await notion.databases.query({ database_id: t.dbId, start_cursor: cursor });
            ids.push(...res.results.map((r) => r.id));
            cursor = res.next_cursor ?? undefined;
        } while (cursor);
        console.log(`${t.label}: ${ids.length} righe da archiviare`);

        if (!APPLY || !VIEWS_LIVE) continue;
        let done = 0;
        for (const id of ids) {
            await notion.pages.update({ page_id: id, archived: true });
            done++;
            if (done % 20 === 0) console.log(`  …${done}/${ids.length}`);
        }
        console.log(`✓ ${t.label}: ${done} archiviate`);
    }

    if (!APPLY || !VIEWS_LIVE) {
        console.log(
            "\nDRY-RUN (o gate --views-live mancante). Per eseguire:\n" +
                "  npm run retire:mirrors -- --apply --views-live\n" +
                "SOLO quando: cockpit su host sempre acceso + COCKPIT_VIEWS_URL attiva\n" +
                "in ernesto da ≥1 settimana senza errori nel 🤖 Agents Activity Log.\n" +
                "Content Assets (stub) e PIF Compliance NON sono toccati da questo script."
        );
    }
}

main().catch((err) => {
    console.error("Retire failed:", err.message);
    process.exit(1);
});

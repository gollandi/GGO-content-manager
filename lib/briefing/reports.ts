import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "../notion/client";
import { notionConfig } from "../config";
import { cached } from "../cache";
import { prepareNarrative } from "./service";
import { dayFallback, FINISHED, runNeedsAttention, type ReportRun } from "./fallback";

const DAYS_SHOWN = 7;
type RunRow = ReportRun;

async function fetchRecentRuns(): Promise<RunRow[]> {
    const since = new Date(Date.now() - DAYS_SHOWN * 86_400_000).toISOString();
    const rows: RunRow[] = [];
    let cursor: string | undefined;
    do {
        const res = await notion.databases.query({
            database_id: notionConfig.dbs.agentsActivityLog(),
            start_cursor: cursor,
            filter: { property: "Started At", date: { on_or_after: since } },
            sorts: [{ property: "Started At", direction: "descending" }],
        });
        for (const page of res.results as PageObjectResponse[]) {
            const p = page.properties;
            const text = (name: string): string => {
                const prop = p[name];
                if (prop?.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
                return "";
            };
            const sel = (name: string): string | null => {
                const prop = p[name];
                return prop?.type === "select" ? prop.select?.name ?? null : null;
            };
            const num = (name: string): number | null => {
                const prop = p[name];
                return prop?.type === "number" ? prop.number : null;
            };
            const titleProp = Object.values(p).find((v) => v.type === "title");
            rows.push({
                id: page.id,
                run: titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "",
                job: sel("Job"),
                status: sel("Status"),
                startedAt: p["Started At"]?.type === "date" ? p["Started At"].date?.start ?? null : null,
                durationMs: num("Duration (ms)"),
                rowsWritten: num("Rows Written"),
                errors: num("Errors"),
                summary: text("Summary"),
                errorMessage: text("Error Message"),
                triggeredBy: sel("Triggered By"),
            });
        }
        cursor = res.next_cursor || undefined;
    } while (cursor);
    return rows;
}

export async function getDailyReports({ start = true, wait = false } = {}) {
    const activity = await cached("ernesto:recent-report-runs", fetchRecentRuns, 5 * 60_000);
    const cutoff = Date.now() - DAYS_SHOWN * 86_400_000;
    const byDay = new Map<string, RunRow[]>();
    for (const row of activity) {
        if (!row.startedAt || !Number.isFinite(Date.parse(row.startedAt)) || Date.parse(row.startedAt) < cutoff) continue;
        const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.startedAt));
        byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }
    const days = await Promise.all([...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(async ([date, runs]) => {
        runs.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
        // Keep failures and production droughts even when a job calls itself a heartbeat.
        const meaningful = runs.filter((r) => !(new Set(["clip-ingest", "media-gc", "media-sync"]).has(r.job ?? "") &&
            FINISHED.has(r.status ?? "") && !runNeedsAttention(r) && /nothing to ingest|nothing to do|no files|0 file\(s\)/i.test(r.summary)));
        const narrative = await prepareNarrative({ key: `Giornale di bordo: ${date}`, start, wait,
            source: JSON.stringify({ date, totalRuns: runs.length, routineChecks: runs.length - meaningful.length, runs: meaningful }),
            fallback: dayFallback(runs) });
        return { date, narrative, prose: narrative.paragraphs.join("\n\n"),
            proseError: narrative.status === "unavailable" ? "Lettura ragionata non disponibile; il quadro essenziale resta consultabile." : null,
            runs, counts: { total: runs.length,
                ok: runs.filter((r) => FINISHED.has(r.status ?? "") && !runNeedsAttention(r)).length,
                attention: runs.filter(runNeedsAttention).length,
                rowsWritten: runs.reduce((n, r) => n + Math.max(0, r.rowsWritten ?? 0), 0) } };
    }));
    return { days, generatedAt: new Date().toISOString() };
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../../../../../lib/auth/api-guard";
import { notion } from "../../../../../lib/notion/client";
import { notionConfig } from "../../../../../lib/config";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * IL GIORNALE DI BORDO — the run register, day by day, in plain Italian.
 *
 * Groups the Agents Activity Log into days and asks Claude for one short
 * prose account per day: what the house did, what went wrong, what needs
 * JJ. Summaries are cached in-process per (day, rows-fingerprint) — a past
 * day never changes, today re-summarises only when new runs land.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.COCKPIT_REPORT_MODEL || "claude-sonnet-5";
const DAYS_SHOWN = 7;

interface RunRow {
    id: string;
    run: string;
    job: string | null;
    status: string | null;
    startedAt: string | null;
    durationMs: number | null;
    rowsWritten: number | null;
    errors: number | null;
    summary: string;
    errorMessage: string;
    triggeredBy: string | null;
}

interface DayReport {
    date: string;           // YYYY-MM-DD, local
    prose: string | null;   // Claude's account, null when the call failed
    proseError: string | null;
    runs: RunRow[];
    counts: { total: number; ok: number; attention: number; rowsWritten: number };
}

const OK = new Set(["Success", "Done", "Published"]);
const ATTENTION = new Set(["Failed", "Partial", "Blocked", "Error"]);

function localDayKey(iso: string): string {
    const d = new Date(iso);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
    ].join("-");
}

function fingerprint(runs: RunRow[]): string {
    return runs.map((r) => `${r.id}:${r.status}`).sort().join("|");
}

// One prose account per day, cached per fingerprint. Module-level: survives
// requests within the resident service's lifetime, which is all it needs.
const proseCache = new Map<string, { hash: string; prose: string }>();

async function summariseDay(anthropic: Anthropic, date: string, runs: RunRow[]): Promise<string> {
    const cached = proseCache.get(date);
    const hash = fingerprint(runs);
    if (cached && cached.hash === hash) return cached.prose;

    const compact = runs.map((r) => ({
        job: r.job || r.run,
        status: r.status,
        at: r.startedAt?.slice(11, 16) ?? null,
        rowsWritten: r.rowsWritten,
        errors: r.errors,
        summary: (r.errorMessage || r.summary || "").slice(0, 300),
        triggeredBy: r.triggeredBy,
    }));

    const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 400,
        system:
            "Sei il cronista di bordo del sistema editoriale GGOMed. Ricevi l'elenco delle run "
            + "automatiche (cron e headless) di una giornata, in JSON. Scrivi un resoconto in italiano "
            + "piano, per un lettore non tecnico: 2-4 frasi. Prima cosa è stato prodotto o aggiornato "
            + "(traduci i numeri in sostanza), poi eventuali problemi e cosa richiedono. Niente gergo, "
            + "niente nomi di file, niente elenchi puntati. Se è andato tutto liscio dillo in una riga. "
            + "Non inventare nulla che non sia nei dati.",
        messages: [{ role: "user", content: `Giornata ${date}. Run:\n${JSON.stringify(compact)}` }],
    });
    const prose = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    proseCache.set(date, { hash, prose });
    return prose;
}

/**
 * Only the window shown — the full Activity Log holds thousands of rows and
 * reading them all on every page load is exactly the slowness this register
 * exists to end.
 */
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

export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    let activity: RunRow[];
    try {
        activity = await fetchRecentRuns();
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 502 }
        );
    }

    const cutoff = Date.now() - DAYS_SHOWN * 86_400_000;
    const byDay = new Map<string, RunRow[]>();
    for (const row of activity) {
        if (!row.startedAt) continue;
        const t = new Date(row.startedAt).getTime();
        if (!Number.isFinite(t) || t < cutoff) continue;
        const key = localDayKey(row.startedAt);
        byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }

    const skipProse = req.nextUrl.searchParams.get("prose") === "0";
    const anthropic = new Anthropic();
    // One Claude call per day, in parallel — seven sequential calls used to
    // hold this response for the sum of their latencies.
    const days: DayReport[] = await Promise.all(
        [...byDay.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(async ([date, runs]) => {
                runs.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
                let prose: string | null = null;
                let proseError: string | null = null;
                if (!skipProse) {
                    try {
                        prose = await summariseDay(anthropic, date, runs);
                    } catch (err) {
                        proseError = err instanceof Error ? err.message : String(err);
                    }
                }
                return {
                    date,
                    prose,
                    proseError,
                    runs,
                    counts: {
                        total: runs.length,
                        ok: runs.filter((r) => OK.has(r.status ?? "")).length,
                        attention: runs.filter((r) => ATTENTION.has(r.status ?? "")).length,
                        rowsWritten: runs.reduce((n, r) => n + (r.rowsWritten ?? 0), 0),
                    },
                };
            })
    );

    return NextResponse.json({ days, generatedAt: new Date().toISOString() });
}

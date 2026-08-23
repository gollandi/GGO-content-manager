"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import AppShell from "../../components/AppShell";
import HousePulse from "../../components/HousePulse";

// recharts (with its D3 deps) is a large bundle — load it only when the
// charts actually render, off the route's critical path.
const PortineriaCharts = dynamic(() => import("../../components/PortineriaCharts"), { ssr: false });
import { useNotionData } from "../../lib/hooks/useNotionData";
import type { PerformanceSnapshotRow } from "../../lib/notion/editorial";
import styles from "./page.module.css";

type DispatchState = Record<string, "idle" | "sending" | "sent" | "error">;

const numberFmt = new Intl.NumberFormat("en-GB");
const pctFmt = new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1,
});

function n(value: number | null | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fmt(value: number | null | undefined): string {
    return numberFmt.format(n(value));
}

function fmtPct(value: number | null | undefined): string {
    const safe = n(value);
    return pctFmt.format(safe > 1 ? safe / 100 : safe);
}

function dateKey(value: string | null): string {
    return value?.slice(0, 10) || "No week";
}

function nextImpactDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 28);
    return date.toISOString().slice(0, 10);
}

function subscribeMounted() {
    return () => undefined;
}

function clientMounted() {
    return true;
}

function serverMounted() {
    return false;
}

function sourceForNeed(row: PerformanceSnapshotRow): "Search" | "Internal" {
    const source = `${row.source ?? ""} ${row.channel ?? ""}`.toLowerCase();
    return source.includes("search") || source.includes("semrush") || source.includes("google")
        ? "Search"
        : "Internal";
}

function signalScore(row: PerformanceSnapshotRow): number {
    const impressions = n(row.impressions);
    const clicks = n(row.clicks);
    const sessions = n(row.sessions);
    const ctr = row.ctr !== null ? n(row.ctr) : impressions > 0 ? clicks / impressions : 0;
    const position = n(row.averagePosition);
    const demand = Math.log10(Math.max(impressions, sessions, 1));
    const weakCtr = ctr > 0 && ctr < 0.025 ? 2 : 0;
    const noClickDemand = impressions >= 100 && clicks === 0 ? 3 : 0;
    const nearPageOne = position >= 4 && position <= 20 ? 2 : 0;
    return demand + weakCtr + noClickDemand + nearPageOne;
}

function buildBrief(row: PerformanceSnapshotRow): string {
    const source = [row.source, row.channel].filter(Boolean).join(" / ") || "unknown source";
    return [
        `Signal from La Portineria: ${row.title}`,
        `Source: ${source}`,
        `Week: ${dateKey(row.weekOf)}`,
        `Impressions: ${fmt(row.impressions)}`,
        `Clicks: ${fmt(row.clicks)}`,
        `CTR: ${fmtPct(row.ctr)}`,
        row.averagePosition !== null ? `Average position: ${row.averagePosition}` : "",
        row.sessions !== null ? `Sessions: ${fmt(row.sessions)}` : "",
        row.engagementRate !== null ? `Engagement rate: ${fmtPct(row.engagementRate)}` : "",
        "",
        "Operational ask: decide whether this signal needs a content refresh, a new page, a social follow-up, or no action.",
    ]
        .filter(Boolean)
        .join("\n");
}

export default function PortineriaPage() {
    const { data: rows, loading, error } = useNotionData<PerformanceSnapshotRow>(
        "/api/notion/performance-snapshot"
    );
    const [dispatch, setDispatch] = useState<DispatchState>({});
    const mounted = useSyncExternalStore(subscribeMounted, clientMounted, serverMounted);

    const sortedRows = useMemo(
        () =>
            [...rows].sort((a, b) => {
                const week = dateKey(b.weekOf).localeCompare(dateKey(a.weekOf));
                return week || signalScore(b) - signalScore(a);
            }),
        [rows]
    );

    const prioritySignals = useMemo(
        () =>
            sortedRows
                .filter((row) => signalScore(row) >= 3)
                .slice(0, 8),
        [sortedRows]
    );

    const totals = useMemo(() => {
        const impressions = rows.reduce((sum, row) => sum + n(row.impressions), 0);
        const clicks = rows.reduce((sum, row) => sum + n(row.clicks), 0);
        const sessions = rows.reduce((sum, row) => sum + n(row.sessions), 0);
        const engagementRows = rows.filter((row) => row.engagementRate !== null);
        const engagement =
            engagementRows.length > 0
                ? engagementRows.reduce((sum, row) => sum + n(row.engagementRate), 0) /
                  engagementRows.length
                : 0;

        return {
            rows: rows.length,
            impressions,
            clicks,
            sessions,
            ctr: impressions > 0 ? clicks / impressions : 0,
            engagement,
        };
    }, [rows]);

    const weeklyTrend = useMemo(() => {
        const grouped = new Map<string, { week: string; impressions: number; clicks: number; sessions: number }>();
        rows.forEach((row) => {
            const week = dateKey(row.weekOf);
            const current = grouped.get(week) ?? { week, impressions: 0, clicks: 0, sessions: 0 };
            current.impressions += n(row.impressions);
            current.clicks += n(row.clicks);
            current.sessions += n(row.sessions);
            grouped.set(week, current);
        });
        return Array.from(grouped.values()).sort((a, b) => a.week.localeCompare(b.week)).slice(-12);
    }, [rows]);

    const channelMix = useMemo(() => {
        const grouped = new Map<string, { channel: string; signals: number; clicks: number; sessions: number }>();
        rows.forEach((row) => {
            const channel = row.channel || row.source || "Unknown";
            const current = grouped.get(channel) ?? { channel, signals: 0, clicks: 0, sessions: 0 };
            current.signals += 1;
            current.clicks += n(row.clicks);
            current.sessions += n(row.sessions);
            grouped.set(channel, current);
        });
        return Array.from(grouped.values())
            .sort((a, b) => b.clicks + b.sessions - (a.clicks + a.sessions))
            .slice(0, 8);
    }, [rows]);

    async function sendToErnesto(row: PerformanceSnapshotRow) {
        setDispatch((state) => ({ ...state, [row.id]: "sending" }));
        const res = await fetch("/api/notion/content-needs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                need: `Portineria signal: ${row.title}`.slice(0, 180),
                source: sourceForNeed(row),
                details: buildBrief(row),
                successDefinition:
                    "Impact improves on the originating metric, or JJ records no-action after review.",
                impactReviewDate: nextImpactDate(),
            }),
        });
        setDispatch((state) => ({ ...state, [row.id]: res.ok ? "sent" : "error" }));
    }

    return (
        <AppShell>
            <div className={styles.page}>
                <header className={styles.header}>
                    <div>
                        <p className="column-label">La Portineria</p>
                        <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                            La Portineria
                        </h1>
                        <p className={styles.subtitle}>
                            Banco di ingresso dei segnali esterni. Legge il performance snapshot
                            scritto dagli ingester di Ernesto e lo smista nel ciclo operativo senza
                            duplicare il dato analitico.
                        </p>
                    </div>
                    <div className={styles.headerStamp}>Read signal · write work</div>
                </header>

                <HousePulse />

                <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Signals</div>
                        <div className={styles.summaryValue}>{loading ? "..." : totals.rows}</div>
                        <div className={styles.summaryNote}>rows from performance snapshot</div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Impressions</div>
                        <div className={styles.summaryValue}>{loading ? "..." : fmt(totals.impressions)}</div>
                        <div className={styles.summaryNote}>search/social reach</div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Clicks</div>
                        <div className={styles.summaryValue}>{loading ? "..." : fmt(totals.clicks)}</div>
                        <div className={styles.summaryNote}>weighted CTR {fmtPct(totals.ctr)}</div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Sessions</div>
                        <div className={styles.summaryValue}>{loading ? "..." : fmt(totals.sessions)}</div>
                        <div className={styles.summaryNote}>GA4-side traffic</div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>To Smistare</div>
                        <div className={styles.summaryValue}>{loading ? "..." : prioritySignals.length}</div>
                        <div className={styles.summaryNote}>high-signal operational candidates</div>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 border border-seal px-3 py-2 text-xs text-seal-bright">
                        Performance snapshot unavailable: {error}
                    </div>
                )}

                <div className={styles.grid}>
                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h2 className={styles.panelTitle}>Segnali nel tempo</h2>
                            <span className={styles.panelLabel}>Last 12 weeks</span>
                        </div>
                        <div className={styles.chartGrid}>
                            {mounted && (
                                <PortineriaCharts
                                    weeklyTrend={weeklyTrend}
                                    channelMix={channelMix}
                                    chartBoxClassName={styles.chartBox}
                                />
                            )}
                        </div>
                    </section>

                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h2 className={styles.panelTitle}>Da smistare</h2>
                            <span className={styles.panelLabel}>Portineria to Ernesto</span>
                        </div>
                        <div className={styles.signalList}>
                            {!loading && prioritySignals.length === 0 && (
                                <p className={styles.empty}>Nessun segnale prioritario nel snapshot corrente.</p>
                            )}
                            {prioritySignals.map((row) => {
                                const state = dispatch[row.id] ?? "idle";
                                return (
                                    <article key={row.id} className={styles.signalCard}>
                                        <div className={styles.signalTop}>
                                            <div>
                                                <h3 className={styles.signalTitle}>{row.title || "(untitled)"}</h3>
                                                <p className={styles.signalMeta}>
                                                    {dateKey(row.weekOf)} · {[row.source, row.channel].filter(Boolean).join(" / ") || "Unknown"}
                                                </p>
                                            </div>
                                            <span className={styles.sourcePill}>score {signalScore(row).toFixed(1)}</span>
                                        </div>
                                        <div className={styles.signalStats}>
                                            <div className={styles.metric}>
                                                <span className={styles.metaLabel}>Imp.</span>
                                                <strong>{fmt(row.impressions)}</strong>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metaLabel}>Clicks</span>
                                                <strong>{fmt(row.clicks)}</strong>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metaLabel}>CTR</span>
                                                <strong>{fmtPct(row.ctr)}</strong>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metaLabel}>Pos.</span>
                                                <strong>{row.averagePosition ?? "-"}</strong>
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.button}
                                                disabled={state === "sending" || state === "sent"}
                                                onClick={() => sendToErnesto(row)}
                                                type="button"
                                            >
                                                {state === "sending"
                                                    ? "Smisto..."
                                                    : state === "sent"
                                                      ? "Smistato"
                                                      : "Smista a Ernesto"}
                                            </button>
                                            <span className={styles.statusLine}>
                                                {state === "error"
                                                    ? "Scrittura fallita: controlla sessione/permessi."
                                                    : "Crea una Content Need, non una copia analytics."}
                                            </span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <section className={`${styles.panel} mt-5`}>
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>Registro segnali</h2>
                        <span className={styles.panelLabel}>{sortedRows.length} rows</span>
                    </div>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Signal</th>
                                    <th>Week</th>
                                    <th>Source</th>
                                    <th>Imp.</th>
                                    <th>Clicks</th>
                                    <th>CTR</th>
                                    <th>Avg pos.</th>
                                    <th>Sessions</th>
                                    <th>Eng.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.slice(0, 80).map((row) => (
                                    <tr key={row.id}>
                                        <td className={styles.rowTitle}>{row.title || "(untitled)"}</td>
                                        <td>{dateKey(row.weekOf)}</td>
                                        <td>{[row.source, row.channel].filter(Boolean).join(" / ") || "-"}</td>
                                        <td>{fmt(row.impressions)}</td>
                                        <td className={n(row.clicks) === 0 && n(row.impressions) > 0 ? styles.negative : ""}>
                                            {fmt(row.clicks)}
                                        </td>
                                        <td>{fmtPct(row.ctr)}</td>
                                        <td>{row.averagePosition ?? "-"}</td>
                                        <td>{fmt(row.sessions)}</td>
                                        <td>{row.engagementRate === null ? "-" : fmtPct(row.engagementRate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedRows.length > 80 && (
                            <p className={styles.empty}>Showing first 80 signals from the current snapshot.</p>
                        )}
                    </div>
                </section>
            </div>
        </AppShell>
    );
}

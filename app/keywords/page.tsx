"use client";

import { useState } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";
import SearchBar from "../../components/SearchBar";
import FilterBar from "../../components/FilterBar";
import DataTable from "../../components/DataTable";
import { KeywordItem } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";

type FilterView =
  | "All Keywords"
  | "High Volume / Low Coverage"
  | "Local Intent"
  | "Ranking Drops"
  | "By Category";

export default function KeywordsPage() {
  const { data: keywords, loading, error } = useNotionData<KeywordItem>("/api/notion/keywords");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterView>("All Keywords");

  // ----- computed stats -----
  const totalKeywords = keywords.length;
  const lowCoverageCount = keywords.filter(
    (k) => k.contentAssetIds.length === 0
  ).length;
  const rankingDropsCount = keywords.filter(
    (k) => k.positionChange !== null && k.positionChange < 0
  ).length;
  const avgPosition =
    keywords.length > 0
      ? Math.round(
          keywords.reduce((sum, k) => sum + (k.currentRanking ?? 0), 0) /
            keywords.filter((k) => k.currentRanking !== null).length
        ) || 0
      : 0;

  // ----- filter logic -----
  const filters: FilterView[] = [
    "All Keywords",
    "High Volume / Low Coverage",
    "Local Intent",
    "Ranking Drops",
    "By Category",
  ];

  const filteredItems = keywords.filter((item) => {
    const matchesSearch = item.keyword
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    switch (activeFilter) {
      case "High Volume / Low Coverage": {
        const vol = item.volume ?? item.searchVolume ?? 0;
        matchesFilter = vol > 100 && item.contentAssetIds.length === 0;
        break;
      }
      case "Local Intent":
        matchesFilter = item.intent.some((i) => i.includes("Local"));
        break;
      case "Ranking Drops":
        matchesFilter =
          item.positionChange !== null && item.positionChange < 0;
        break;
      case "By Category":
      case "All Keywords":
      default:
        matchesFilter = true;
        break;
    }

    return matchesSearch && matchesFilter;
  });

  // ----- helpers -----
  function getVolume(item: KeywordItem): number | null {
    return item.volume ?? item.searchVolume ?? null;
  }

  function formatVolume(v: number | null): string {
    if (v === null) return "--";
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString();
  }

  function getDifficultyColor(d: number): string {
    if (d < 30) return styles.difficultyGreen;
    if (d <= 60) return styles.difficultyOrange;
    return styles.difficultyRed;
  }

  function getIntentColor(intent: string): string {
    const lower = intent.toLowerCase();
    if (lower.includes("informational")) return "pill-blue";
    if (lower.includes("transactional")) return "pill-green";
    if (lower.includes("local")) return "pill-yellow";
    return "pill-blue";
  }

  const statCards = [
    {
      label: "Total Keywords",
      value: totalKeywords.toString(),
      accent: styles.statBlue,
      icon: <Icons.IconKey className={styles.statIcon} />,
    },
    {
      label: "Low Coverage",
      value: lowCoverageCount.toString(),
      accent: styles.statOrange,
      icon: <Icons.IconShield className={styles.statIcon} />,
    },
    {
      label: "Ranking Drops",
      value: rankingDropsCount.toString(),
      accent: styles.statRed,
      icon: <Icons.IconAnalytics className={styles.statIcon} />,
    },
    {
      label: "Avg Position",
      value: avgPosition > 0 ? `#${avgPosition}` : "--",
      accent: styles.statGreen,
      icon: <Icons.IconExplorer className={styles.statIcon} />,
    },
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        {/* ---------- header ---------- */}
        <header className="page-header">
          <div>
            <h1 className="page-title">Keyword Management</h1>
            <p className="page-subtitle">
              SEO decision support and content coverage analysis
              {!loading && ` \u2014 ${totalKeywords} keywords tracked`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.iconButtons}>
              <button className={styles.iconButton} aria-label="Notifications">
                <Icons.IconBell className={styles.iconSm} />
                <span className={styles.iconBadge}>
                  {rankingDropsCount > 0 ? rankingDropsCount : 0}
                </span>
              </button>
            </div>
            <button className="btn-gradient opacity-50 cursor-not-allowed" disabled title="Coming soon">
              <Icons.IconPlus
                className={styles.iconSm}
                style={{ marginRight: "8px" }}
              />
              Add Keyword
            </button>
          </div>
        </header>

        <section className="page-section">
          {/* ---------- stat cards ---------- */}
          <div className={styles.statsRow}>
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`${styles.statCard} ${card.accent}`}
              >
                <div className={styles.statIconWrap}>{card.icon}</div>
                <div>
                  <div className={styles.statValue}>{loading ? "--" : card.value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ---------- filter bar ---------- */}
          <div className={styles.toolbar}>
            <FilterBar filters={filters} active={activeFilter} onChange={setActiveFilter} />
            <SearchBar placeholder="Search keywords..." value={searchTerm} onChange={setSearchTerm} />
          </div>

          {/* ---------- table ---------- */}
          <DataTable
            title="Keywords"
            subtitle={
              loading
                ? "Loading..."
                : `Showing ${filteredItems.length} of ${totalKeywords} keywords`
            }
            columns={[
              { key: "keyword", label: "Keyword" },
              { key: "intent", label: "Intent" },
              { key: "volume", label: "Volume" },
              { key: "difficulty", label: "Difficulty" },
              { key: "rank", label: "Current Rank" },
              { key: "coverage", label: "Coverage" },
              { key: "actions", label: "" },
            ]}
            loading={loading}
            empty={filteredItems.length === 0}
            emptyMessage="No keywords match the current filters."
          >
            {filteredItems.map((item) => {
              const vol = getVolume(item);
              const difficulty = item.difficulty ?? 0;
              const rank = item.currentRanking;
              const change = item.positionChange;
              const coverage = item.contentAssetIds.length;

              return (
                <tr key={item.id}>
                  {/* ---- Keyword ---- */}
                  <td>
                    <div className={styles.rowTitle}>
                      {item.keyword}
                    </div>
                    <div className={styles.rowMeta}>
                      {item.intent.length > 0 && (
                        <span
                          className={`pill ${getIntentColor(
                            item.intent[0]
                          )}`}
                          style={{ marginRight: "6px" }}
                        >
                          {item.intent[0]}
                        </span>
                      )}
                      <span className={styles.linkedCount}>
                        {coverage} linked asset
                        {coverage !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </td>

                  {/* ---- Intent pills ---- */}
                  <td>
                    <div className={styles.intentPills}>
                      {item.intent.map((intent, idx) => (
                        <span
                          key={idx}
                          className={`pill ${getIntentColor(intent)}`}
                        >
                          {intent}
                        </span>
                      ))}
                      {item.intent.length === 0 && (
                        <span className={styles.muted}>--</span>
                      )}
                    </div>
                  </td>

                  {/* ---- Volume ---- */}
                  <td>
                    <span className={styles.volumeValue}>
                      {formatVolume(vol)}
                    </span>
                  </td>

                  {/* ---- Difficulty ---- */}
                  <td>
                    {item.difficulty !== null ? (
                      <div className={styles.difficultyCell}>
                        <div className={styles.difficultyBarWrap}>
                          <div
                            className={`${styles.difficultyBar} ${getDifficultyColor(difficulty)}`}
                            style={{ width: `${difficulty}%` }}
                          />
                        </div>
                        <span className={styles.difficultyNum}>
                          {difficulty}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.muted}>--</span>
                    )}
                  </td>

                  {/* ---- Current Rank ---- */}
                  <td>
                    {rank !== null ? (
                      <div className={styles.rankCell}>
                        <span className={styles.rankValue}>
                          {rank}
                        </span>
                        {change !== null && change !== 0 && (
                          <span
                            className={
                              change > 0
                                ? styles.rankUp
                                : styles.rankDown
                            }
                          >
                            {change > 0 ? "\u25B2" : "\u25BC"}{" "}
                            {Math.abs(change)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={styles.muted}>--</span>
                    )}
                  </td>

                  {/* ---- Coverage ---- */}
                  <td>
                    <div className={styles.coverageCell}>
                      <div className={styles.coverageBarWrap}>
                        <div
                          className={`${styles.coverageBar} ${
                            coverage > 0
                              ? styles.coverageFilled
                              : styles.coverageEmpty
                          }`}
                          style={{
                            width: coverage > 0 ? "100%" : "0%",
                          }}
                        />
                      </div>
                      <span className={styles.coverageLabel}>
                        {coverage > 0
                          ? `${coverage} asset${coverage !== 1 ? "s" : ""}`
                          : "None"}
                      </span>
                    </div>
                  </td>

                  {/* ---- Actions ---- */}
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionButton}
                        aria-label="View keyword"
                        title="View"
                      >
                        <Icons.IconExternalLink
                          className={styles.iconSm}
                        />
                      </button>
                      <button
                        className={styles.actionButton}
                        aria-label="Edit keyword"
                        title="Edit"
                      >
                        <Icons.IconEdit className={styles.iconSm} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </section>
      </div>
    </AppShell>
  );
}

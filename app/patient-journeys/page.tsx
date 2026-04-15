"use client";

import { useState } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";
import { PatientJourneyItem } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";

type FilterView =
  | "All Journeys"
  | "Coverage Gaps"
  | "High Urgency"
  | "By Stage"
  | "By Pathway";

export default function PatientJourneysPage() {
  const { data: journeys, loading, error } = useNotionData<PatientJourneyItem>("/api/notion/patient-journeys");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterView>("All Journeys");

  const filters: FilterView[] = [
    "All Journeys",
    "Coverage Gaps",
    "High Urgency",
    "By Stage",
    "By Pathway",
  ];

  // Computed stats
  const totalJourneys = journeys.length;
  const coverageGaps = journeys.filter(
    (j) => j.contentAssetIds.length === 0
  ).length;
  const highUrgency = journeys.filter(
    (j) => j.urgency !== null && j.urgency.includes("High")
  ).length;
  const contentMapped =
    totalJourneys > 0
      ? Math.round(
          (journeys.filter((j) => j.contentAssetIds.length > 0).length /
            totalJourneys) *
            100
        )
      : 0;

  // Filtering logic
  const filteredItems = journeys.filter((item) => {
    const searchTarget = `${item.patientLanguage} ${item.exampleQuestion} ${item.medicalTerms}`.toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    switch (activeFilter) {
      case "Coverage Gaps":
        matchesFilter = item.contentAssetIds.length === 0;
        break;
      case "High Urgency":
        matchesFilter =
          item.urgency !== null && item.urgency.includes("High");
        break;
      case "By Stage":
        matchesFilter = item.journeyStage !== null;
        break;
      case "By Pathway":
        matchesFilter = item.pathway !== null;
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  function getStagePillClass(stage: string | null): string {
    if (!stage) return "pill";
    if (stage.includes("Awareness")) return "pill pill-blue";
    if (stage.includes("Consideration")) return "pill pill-blue";
    if (stage.includes("Action")) return "pill pill-green";
    return "pill";
  }

  function getUrgencyPillClass(urgency: string | null): string {
    if (!urgency) return "pill";
    if (urgency.includes("High")) return "pill pill-red";
    if (urgency.includes("Medium")) return "pill pill-yellow";
    if (urgency.includes("Low")) return "pill pill-green";
    return "pill";
  }

  function getStageLabel(stage: string | null): string {
    if (!stage) return "No Stage";
    return stage;
  }

  function getUrgencyLabel(urgency: string | null): string {
    if (!urgency) return "No Urgency";
    return urgency;
  }

  function getPathwayLabel(pathway: string | null): string {
    if (!pathway) return "No Pathway";
    return pathway;
  }

  function getCardTitle(item: PatientJourneyItem): string {
    if (item.exampleQuestion && item.exampleQuestion.trim().length > 0) {
      return item.exampleQuestion;
    }
    return item.patientLanguage || "Untitled Journey";
  }

  const isCoverageGap = (item: PatientJourneyItem): boolean =>
    item.contentAssetIds.length === 0;

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Header */}
        <header className="page-header">
          <div>
            <h1 className="page-title">Patient Journeys</h1>
            <p className="page-subtitle">
              Map patient language to content pathways
              {!loading && ` \u00b7 ${totalJourneys} items`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <Icons.IconBell className={styles.iconSm} />
              {coverageGaps > 0 && (
                <span className={styles.iconBadge}>{coverageGaps}</span>
              )}
            </button>
            <button className="btn-gradient opacity-50 cursor-not-allowed" disabled title="Coming soon">
              <Icons.IconPlus
                className={styles.iconSm}
                style={{ marginRight: "8px" }}
              />
              New Journey
            </button>
          </div>
        </header>

        <section className="page-section">
          {/* Stats row */}
          {!loading && (
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statIcon} data-tone="purple">
                  <Icons.IconJourney className={styles.iconSm} />
                </div>
                <div>
                  <div className={styles.statValue}>{totalJourneys}</div>
                  <div className={styles.statLabel}>Total Journeys</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon} data-tone="red">
                  <Icons.IconShield className={styles.iconSm} />
                </div>
                <div>
                  <div className={styles.statValue}>{coverageGaps}</div>
                  <div className={styles.statLabel}>Coverage Gaps</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon} data-tone="orange">
                  <Icons.IconBell className={styles.iconSm} />
                </div>
                <div>
                  <div className={styles.statValue}>{highUrgency}</div>
                  <div className={styles.statLabel}>High Urgency</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon} data-tone="green">
                  <Icons.IconValidation className={styles.iconSm} />
                </div>
                <div>
                  <div className={styles.statValue}>{contentMapped}%</div>
                  <div className={styles.statLabel}>Content Mapped</div>
                </div>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className={styles.toolbar}>
            <div className={styles.filterRow}>
              {filters.map((filter) => (
                <button
                  key={filter}
                  className={
                    activeFilter === filter
                      ? styles.filterActive
                      : styles.filterPill
                  }
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className={styles.searchBox}>
              <Icons.IconSearch
                className={styles.iconSm}
                style={{ color: "var(--text-muted)" }}
              />
              <input
                placeholder="Search journeys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Card list */}
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner} />
              <p>Loading patient journeys from Notion...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <Icons.IconJourney className={styles.emptyIcon} />
              <h3>No journeys found</h3>
              <p>
                {searchTerm
                  ? `No results for "${searchTerm}"`
                  : activeFilter !== "All Journeys"
                  ? `No items match the "${activeFilter}" filter`
                  : "No patient journeys have been created yet"}
              </p>
            </div>
          ) : (
            <div className={styles.cardList}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.journeyCard} ${
                    isCoverageGap(item) ? styles.journeyCardGap : ""
                  }`}
                >
                  {/* Pills row */}
                  <div className={styles.pillRow}>
                    {isCoverageGap(item) && (
                      <span className={`pill pill-red ${styles.gapPill}`}>
                        Coverage Gap
                      </span>
                    )}
                    {item.journeyStage && (
                      <span className={getStagePillClass(item.journeyStage)}>
                        {getStageLabel(item.journeyStage)}
                      </span>
                    )}
                    {item.urgency && (
                      <span className={getUrgencyPillClass(item.urgency)}>
                        {getUrgencyLabel(item.urgency)}
                      </span>
                    )}
                  </div>

                  {/* Title + subtitle */}
                  <h3 className={styles.cardTitle}>{getCardTitle(item)}</h3>
                  <p className={styles.cardSubtitle}>
                    Patient language: {item.patientLanguage || "N/A"}
                  </p>

                  {/* Metadata row */}
                  <div className={styles.metaRow}>
                    {item.pathway && (
                      <span className={styles.metaItem}>
                        <Icons.IconJourney className={styles.iconXs} />
                        {getPathwayLabel(item.pathway)}
                      </span>
                    )}
                    {item.medicalTerms && (
                      <span className={styles.metaItem}>
                        <Icons.IconFileText className={styles.iconXs} />
                        {item.medicalTerms.length > 40
                          ? item.medicalTerms.substring(0, 40) + "..."
                          : item.medicalTerms}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className={styles.cardFooter}>
                    <span
                      className={
                        item.contentAssetIds.length > 0
                          ? styles.linkedGreen
                          : styles.linkedRed
                      }
                    >
                      <Icons.IconLink className={styles.iconXs} />
                      Linked Content: {item.contentAssetIds.length} asset
                      {item.contentAssetIds.length !== 1 ? "s" : ""}
                    </span>
                    <button className={styles.viewButton}>View Details</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

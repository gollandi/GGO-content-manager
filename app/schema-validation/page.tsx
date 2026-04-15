"use client";

import React, { useState, Fragment } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";
import { SchemaValidationItem } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";

type FilterView = "All" | "Errors First" | "Warnings" | "Missing FAQ" | "Not Validated" | "Fixes Needed";

export default function SchemaValidationPage() {
  const { data: items, loading, error } = useNotionData<SchemaValidationItem>("/api/notion/validation");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterView>("All");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Computed stats
  const totalPages = items.length;
  const totalErrors = items.reduce((sum, item) => sum + (item.validationErrors ?? 0), 0);
  const totalWarnings = items.reduce((sum, item) => sum + (item.validationWarnings ?? 0), 0);
  const missingFaqCount = items.filter((item) => !item.hasFaq).length;
  const fullyValidatedCount = items.filter((item) => item.validated).length;

  const stats = [
    { label: "Total Pages", value: totalPages, icon: <Icons.IconFileText className={styles.iconSm} />, tone: "blue" as const },
    { label: "Schema Errors", value: totalErrors, icon: <Icons.IconShield className={styles.iconSm} />, tone: "red" as const },
    { label: "Warnings", value: totalWarnings, icon: <Icons.IconBell className={styles.iconSm} />, tone: "orange" as const },
    { label: "Missing FAQ", value: missingFaqCount, icon: <Icons.IconRequests className={styles.iconSm} />, tone: "yellow" as const },
    { label: "Fully Validated", value: fullyValidatedCount, icon: <Icons.IconValidation className={styles.iconSm} />, tone: "green" as const },
  ];

  const filters: FilterView[] = ["All", "Errors First", "Warnings", "Missing FAQ", "Not Validated", "Fixes Needed"];

  // Filter and sort logic
  const getFilteredItems = (): SchemaValidationItem[] => {
    let filtered = items.filter((item) => {
      const name = (item.name || item.slug || "").toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    });

    switch (activeFilter) {
      case "Errors First":
        return [...filtered].sort((a, b) => (b.validationErrors ?? 0) - (a.validationErrors ?? 0));
      case "Warnings":
        return filtered.filter((item) => (item.validationWarnings ?? 0) > 0);
      case "Missing FAQ":
        return filtered.filter((item) => !item.hasFaq);
      case "Not Validated":
        return filtered.filter((item) => !item.validated);
      case "Fixes Needed":
        return filtered.filter((item) => (item.validationErrors ?? 0) > 0 || (item.validationWarnings ?? 0) > 0);
      default:
        return filtered;
    }
  };

  const filteredItems = getFilteredItems();

  const getRowStatus = (item: SchemaValidationItem) => {
    if ((item.validationErrors ?? 0) > 0) return "error";
    if ((item.validationWarnings ?? 0) > 0) return "warning";
    return "valid";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "error": return "Critical Error";
      case "warning": return "Warning";
      default: return "Valid";
    }
  };

  const getPageTypeTone = (pageType: string | null): string => {
    if (!pageType) return "blue";
    const lower = pageType.toLowerCase();
    if (lower.includes("condition")) return "blue";
    if (lower.includes("procedure") || lower.includes("surgery")) return "green";
    if (lower.includes("test") || lower.includes("diagnostic")) return "yellow";
    if (lower.includes("treatment")) return "red";
    return "blue";
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "Never";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Header */}
        <header className="page-header">
          <div>
            <h1 className="page-title">Schema Validation</h1>
            <p className="page-subtitle">
              Structured data QA for schema correctness and completeness
              {!loading && ` \u2014 ${totalPages} pages`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.iconButtons}>
              <button className={styles.iconButton} aria-label="Notifications">
                <Icons.IconBell className={styles.iconSm} />
                {totalErrors > 0 && <span className={styles.iconBadge}>{totalErrors > 99 ? "99+" : totalErrors}</span>}
              </button>
            </div>
            <button className="btn-gradient opacity-50 cursor-not-allowed" disabled title="Coming soon">
              <Icons.IconSync className={styles.iconSm} style={{ marginRight: "8px" }} />
              Run Validation
            </button>
          </div>
        </header>

        <section className="page-section">
          {/* Stats row */}
          <div className={styles.statsRow}>
            {stats.map((stat) => (
              <div key={stat.label} className={`${styles.statCard} ${styles[`stat_${stat.tone}`]}`}>
                <div className={styles.statIcon}>{stat.icon}</div>
                <div>
                  <div className={styles.statValue}>{loading ? "\u2014" : stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className={styles.toolbar}>
            <div className={styles.filterRow}>
              {filters.map((filter) => (
                <button
                  key={filter}
                  className={activeFilter === filter ? styles.filterActive : styles.filterPill}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className={styles.searchBox}>
              <Icons.IconSearch className={styles.iconSm} style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="Search pages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table card */}
          <div className={`card ${styles.tableCard}`}>
            <div className={styles.tableHeader}>
              <div>
                <h3 className="card-title">Validation Results</h3>
                <p className="card-subtitle">
                  {loading ? "Loading..." : `Showing ${filteredItems.length} of ${totalPages} pages`}
                </p>
              </div>
              <button className="btn-pill opacity-50 cursor-not-allowed" disabled title="Coming soon">Export</button>
            </div>

            <div className={styles.tableWrap}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Page URL / Name</th>
                    <th>Page Type</th>
                    <th>Schema Types</th>
                    <th>Status</th>
                    <th>Issues</th>
                    <th>FAQ</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                        <div className={styles.loadingState}>
                          <Icons.IconSync className={styles.loadingSpinner} />
                          <span>Loading schema validation data from Notion...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        No items match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const status = getRowStatus(item);
                      const isExpanded = expandedRow === item.id;

                      return (
                        <Fragment key={item.id}>
                          <tr
                            className={
                              status === "error"
                                ? styles.rowError
                                : status === "warning"
                                ? styles.rowWarning
                                : undefined
                            }
                          >
                            {/* Page URL / Name */}
                            <td>
                              <div className={styles.pageCell}>
                                <span
                                  className={`${styles.statusIndicator} ${styles[`indicator_${status}`]}`}
                                />
                                <div>
                                  <div className={styles.rowTitle}>
                                    {item.slug || item.name}
                                  </div>
                                  <div className={styles.rowMeta}>
                                    Last validated: {formatDate(item.lastReviewed)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Page Type */}
                            <td>
                              {item.pageType ? (
                                <span className={`pill pill-${getPageTypeTone(item.pageType)}`}>
                                  {item.pageType}
                                </span>
                              ) : (
                                <span className={styles.rowMeta}>--</span>
                              )}
                            </td>

                            {/* Schema Types */}
                            <td>
                              <div className={styles.schemaTypesWrap}>
                                {item.schemaType.length > 0 ? (
                                  item.schemaType.map((type) => (
                                    <span key={type} className={styles.schemaTypePill}>
                                      {type}
                                    </span>
                                  ))
                                ) : (
                                  <span className={styles.rowMeta}>None</span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td>
                              <div className={styles.statusCell}>
                                <span className={`${styles.statusDot} ${styles[`dot_${status}`]}`} />
                                <span className={styles[`statusText_${status}`]}>
                                  {getStatusLabel(status)}
                                </span>
                              </div>
                            </td>

                            {/* Issues */}
                            <td>
                              <div className={styles.issuesCell}>
                                {(item.validationErrors ?? 0) > 0 && (
                                  <span className={styles.issueError}>
                                    <Icons.IconShield className={styles.iconXs} />
                                    {item.validationErrors} {item.validationErrors === 1 ? "error" : "errors"}
                                  </span>
                                )}
                                {(item.validationWarnings ?? 0) > 0 && (
                                  <span className={styles.issueWarning}>
                                    <Icons.IconBell className={styles.iconXs} />
                                    {item.validationWarnings} {item.validationWarnings === 1 ? "warning" : "warnings"}
                                  </span>
                                )}
                                {(item.validationErrors ?? 0) === 0 && (item.validationWarnings ?? 0) === 0 && (
                                  <span className={styles.issueClean}>No issues</span>
                                )}
                              </div>
                            </td>

                            {/* FAQ */}
                            <td>
                              <div className={styles.faqCell}>
                                {item.hasFaq ? (
                                  <>
                                    <Icons.IconValidation className={`${styles.iconXs} ${styles.faqCheck}`} />
                                    {item.faqCount !== null && (
                                      <span className={styles.faqCount}>{item.faqCount}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className={styles.faqMissing}>
                                    <Icons.IconPlus className={styles.iconXs} style={{ transform: "rotate(45deg)" }} />
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td>
                              <div className={styles.actionsCell}>
                                <button
                                  className={styles.actionButton}
                                  aria-label="View JSON-LD"
                                  title="View JSON-LD"
                                  onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                                >
                                  <Icons.IconCode className={styles.iconXs} />
                                </button>
                                {item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.actionButton}
                                    aria-label="Open page"
                                    title="Open page"
                                  >
                                    <Icons.IconExternalLink className={styles.iconXs} />
                                  </a>
                                )}
                                <button
                                  className={styles.actionButton}
                                  aria-label="Edit"
                                  title="Edit"
                                >
                                  <Icons.IconEdit className={styles.iconXs} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable JSON-LD row */}
                          {isExpanded && (
                            <tr className={styles.expandedRow}>
                              <td colSpan={7}>
                                <div className={styles.jsonLdSection}>
                                  <div className={styles.jsonLdHeader}>
                                    <h4>JSON-LD Structured Data</h4>
                                    <button
                                      className={styles.closeExpanded}
                                      onClick={() => setExpandedRow(null)}
                                    >
                                      Close
                                    </button>
                                  </div>
                                  <pre className={styles.jsonLdCode}>
                                    <code>
                                      {item.jsonLdRaw
                                        ? (() => {
                                            try {
                                              return JSON.stringify(JSON.parse(item.jsonLdRaw), null, 2);
                                            } catch {
                                              return item.jsonLdRaw;
                                            }
                                          })()
                                        : "No JSON-LD data available."}
                                    </code>
                                  </pre>
                                  {item.faqsSchemaTypes.length > 0 && (
                                    <div className={styles.jsonLdMeta}>
                                      <span className={styles.jsonLdMetaLabel}>FAQ Schema Types:</span>
                                      {item.faqsSchemaTypes.map((fst) => (
                                        <span key={fst} className={styles.schemaTypePill}>{fst}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

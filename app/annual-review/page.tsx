"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import { IconBell, IconCheck, IconAlertCircle } from "../../components/Icons";
import { AnnualReviewLogItem, PifCriterion, PifCycle } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";
import { canWrite } from "../../lib/auth/roles";

const ALL_CRITERIA: PifCriterion[] = [
  "1.1", "1.2", "1.3", "1.4",
  "2.1", "3.1",
  "4.1", "4.2", "4.3", "4.4",
  "5.1", "5.2",
  "6.1", "6.2", "6.3",
  "7.1", "7.2", "7.3",
  "8.1", "9.1", "10.1",
];

const AVAILABLE_CYCLES: PifCycle[] = ["FY2026", "FY2027", "FY2028", "FY2029", "FY2030"];

type ViewFilter = "All" | "Needs Discussion" | "Pending Carryover" | "Not Yet Reviewed";

const VIEW_FILTERS: ViewFilter[] = [
  "All",
  "Needs Discussion",
  "Pending Carryover",
  "Not Yet Reviewed",
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AnnualReviewPage() {
  const { data: session } = useSession();
  const canUserWrite = canWrite(session?.user?.role ?? "viewer");

  const { data: entries, loading, error } = useNotionData<AnnualReviewLogItem>(
    "/api/notion/annual-review"
  );

  const [cycle, setCycle] = useState<PifCycle>("FY2026");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [formEntry, setFormEntry] = useState("");
  const [formStructural, setFormStructural] = useState("");
  const [formPending, setFormPending] = useState("");
  const [formNeedsDiscussion, setFormNeedsDiscussion] = useState(false);

  const cycleEntries = useMemo(
    () => entries.filter((e) => e.cycle === cycle),
    [entries, cycle]
  );

  // Build a criterion→entry map for the current cycle (21 expected, but handle missing)
  const byCriterion = useMemo(() => {
    const map = new Map<PifCriterion, AnnualReviewLogItem>();
    cycleEntries.forEach((e) => {
      if (e.criterion) map.set(e.criterion, e);
    });
    return map;
  }, [cycleEntries]);

  // Apply view filter
  const filteredCriteria = useMemo(() => {
    return ALL_CRITERIA.filter((crit) => {
      const entry = byCriterion.get(crit);
      if (viewFilter === "All") return true;
      if (!entry) {
        // Missing row — show under "Not Yet Reviewed"
        return viewFilter === "Not Yet Reviewed";
      }
      if (viewFilter === "Needs Discussion") return entry.needsDiscussion;
      if (viewFilter === "Pending Carryover") return !!entry.pendingFromPreviousCycle.trim();
      if (viewFilter === "Not Yet Reviewed") return !entry.reviewDate;
      return true;
    });
  }, [byCriterion, viewFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = ALL_CRITERIA.length;
    const reviewed = cycleEntries.filter((e) => !!e.reviewDate).length;
    const needsDiscussion = cycleEntries.filter((e) => e.needsDiscussion).length;
    const pending = cycleEntries.filter((e) => !!e.pendingFromPreviousCycle.trim()).length;
    return {
      total,
      reviewed,
      needsDiscussion,
      pending,
      progress: Math.round((reviewed / total) * 100),
    };
  }, [cycleEntries]);

  const openEdit = (entry: AnnualReviewLogItem) => {
    setEditingId(entry.id);
    setFormEntry(entry.entry);
    setFormStructural(entry.structuralChange);
    setFormPending(entry.pendingFromPreviousCycle);
    setFormNeedsDiscussion(entry.needsDiscussion);
  };

  const handleSignOff = async (entry: AnnualReviewLogItem) => {
    if (!confirm(`Sign off criterion ${entry.criterion} for ${entry.cycle}?\nThis sets Review Date to today.`)) return;
    await patchEntry(entry.id, { signOff: true });
  };

  const handleToggleDiscussion = async (entry: AnnualReviewLogItem) => {
    await patchEntry(entry.id, { needsDiscussion: !entry.needsDiscussion });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await patchEntry(editingId, {
        entry: formEntry,
        structuralChange: formStructural,
        pendingFromPreviousCycle: formPending,
        needsDiscussion: formNeedsDiscussion,
      });
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const patchEntry = async (pageId: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/notion/annual-review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, ...body }),
    });
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    window.location.reload();
  };

  const editingEntry = entries.find((e) => e.id === editingId);

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">PIF TICK Annual Review Log</h1>
            <p className="page-subtitle">
              {loading
                ? "Loading review log..."
                : `${stats.reviewed} of ${stats.total} criteria reviewed for ${cycle} (${stats.progress}%)`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              {stats.needsDiscussion > 0 && (
                <span className={styles.iconBadge}>{stats.needsDiscussion}</span>
              )}
            </button>
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as PifCycle)}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid var(--border-soft, #e5e7eb)",
                fontSize: "14px",
                fontWeight: 600,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {AVAILABLE_CYCLES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </header>

        <section className="page-section">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-800">
              Error loading annual review log: {error}
            </div>
          )}

          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.reviewed}/{stats.total}</div>
              <div className={styles.statLabel}>Criteria Reviewed</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.progress}%</div>
              <div className={styles.statLabel}>Cycle Progress</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.needsDiscussion}</div>
              <div className={styles.statLabel}>Needs Discussion</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.pending}</div>
              <div className={styles.statLabel}>Pending Carryover</div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="filter-row">
            {VIEW_FILTERS.map((filter) => (
              <button
                key={filter}
                className={viewFilter === filter ? "filter-pill filter-active" : "filter-pill"}
                onClick={() => setViewFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Criteria table */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div>
                <h3 className="card-title">Criteria for {cycle}</h3>
                <p className="card-subtitle">
                  {filteredCriteria.length} of 21 criteria shown
                  {!canUserWrite && " · Read-only (viewer role)"}
                </p>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th>Entry</th>
                    <th>Review Date</th>
                    <th>Pending</th>
                    <th>Structural Change</th>
                    <th>Flags</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                        Loading...
                      </td>
                    </tr>
                  ) : filteredCriteria.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        No criteria match this filter
                      </td>
                    </tr>
                  ) : filteredCriteria.map((crit) => {
                    const entry = byCriterion.get(crit);
                    return (
                      <tr key={crit}>
                        <td>
                          <strong style={{ fontSize: "14px" }}>{crit}</strong>
                        </td>
                        <td>
                          {entry?.entry || (
                            <em style={{ color: "var(--text-muted)" }}>
                              {entry ? "No entry yet" : "Row missing in Notion"}
                            </em>
                          )}
                        </td>
                        <td>
                          {entry?.reviewDate ? (
                            <span style={{ color: "var(--green-dark, #047857)", fontWeight: 600 }}>
                              {formatDate(entry.reviewDate)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>Not reviewed</span>
                          )}
                        </td>
                        <td>
                          {entry?.pendingFromPreviousCycle ? (
                            <span style={{ fontSize: "12px" }}>
                              {entry.pendingFromPreviousCycle.slice(0, 60)}
                              {entry.pendingFromPreviousCycle.length > 60 && "…"}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          {entry?.structuralChange ? (
                            <span style={{ fontSize: "12px" }}>
                              {entry.structuralChange.slice(0, 60)}
                              {entry.structuralChange.length > 60 && "…"}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          {entry?.needsDiscussion && (
                            <span className="status-badge status-badge-warning">
                              <IconAlertCircle style={{ width: "12px", marginRight: "4px" }} />
                              Discuss
                            </span>
                          )}
                        </td>
                        <td>
                          {entry ? (
                            <div style={{ display: "flex", gap: "6px" }}>
                              {canUserWrite && !entry.reviewDate && (
                                <button
                                  className="btn-pill"
                                  style={{ padding: "4px 10px", fontSize: "12px", background: "var(--green, #10b981)", color: "#fff", border: "none" }}
                                  onClick={() => handleSignOff(entry)}
                                  title="Mark reviewed with today's date"
                                >
                                  <IconCheck style={{ width: "12px", marginRight: "4px" }} />
                                  Sign off
                                </button>
                              )}
                              {canUserWrite && (
                                <>
                                  <button
                                    className="btn-pill"
                                    style={{ padding: "4px 10px", fontSize: "12px" }}
                                    onClick={() => openEdit(entry)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn-pill"
                                    style={{ padding: "4px 10px", fontSize: "12px" }}
                                    onClick={() => handleToggleDiscussion(entry)}
                                    title={entry.needsDiscussion ? "Unflag discussion" : "Flag for discussion"}
                                  >
                                    {entry.needsDiscussion ? "Unflag" : "Flag"}
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                              Create in Notion
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit modal */}
          {editingEntry && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: "20px",
              }}
              onClick={() => setEditingId(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#fff",
                  borderRadius: "16px",
                  padding: "32px",
                  maxWidth: "600px",
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                  Edit criterion {editingEntry.criterion}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
                  {editingEntry.cycle} · Last reviewed: {formatDate(editingEntry.reviewDate)}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={labelStyle}>Entry (how this criterion is met)</label>
                    <textarea
                      value={formEntry}
                      onChange={(e) => setFormEntry(e.target.value)}
                      rows={4}
                      style={textareaStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Structural Change This Cycle</label>
                    <textarea
                      value={formStructural}
                      onChange={(e) => setFormStructural(e.target.value)}
                      rows={3}
                      style={textareaStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Pending from Previous Cycle</label>
                    <textarea
                      value={formPending}
                      onChange={(e) => setFormPending(e.target.value)}
                      rows={3}
                      style={textareaStyle}
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={formNeedsDiscussion}
                      onChange={(e) => setFormNeedsDiscussion(e.target.checked)}
                    />
                    Flag for discussion in review session
                  </label>

                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      className="btn-gradient"
                      style={{ flex: 1 }}
                      onClick={handleSaveEdit}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      className="btn-pill"
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
  color: "var(--text, #111)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border-soft, #e5e7eb)",
  fontSize: "14px",
  outline: "none",
  fontFamily: "inherit",
  resize: "vertical",
  boxSizing: "border-box",
};

"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import { IconBell, IconPlus, IconSearch } from "../../components/Icons";
import { FeedbackItem, FeedbackType, FeedbackActionStatus, ContentItem } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";
import { canWrite } from "../../lib/auth/roles";

type StatusFilter = "All" | FeedbackActionStatus;

const STATUS_FILTERS: StatusFilter[] = ["All", "Not Started", "In Progress", "Completed"];

const TYPE_COLORS: Record<FeedbackType, string> = {
  Patient: "status-info",
  Expert: "status-danger",
  Clinician: "status-warning",
  Public: "status-badge-secondary",
};

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default function FeedbackQueuePage() {
  const { data: session } = useSession();
  const canUserWrite = canWrite(session?.user?.role ?? "viewer");

  const { data: items, loading, error } = useNotionData<FeedbackItem>("/api/notion/feedback");
  const { data: contentAssets } = useNotionData<ContentItem>("/api/notion/content");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formId, setFormId] = useState("");
  const [formType, setFormType] = useState<FeedbackType>("Patient");
  const [formSummary, setFormSummary] = useState("");
  const [formContentId, setFormContentId] = useState("");
  const [formActionRequired, setFormActionRequired] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.feedbackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.feedbackSummary.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === "All" || item.actionStatus === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter]);

  // Derive selected item
  const selectedItem = items.find((i) => i.id === selectedId) ?? filteredItems[0] ?? null;

  const counts = useMemo(() => {
    const base = {
      All: items.length,
      "Not Started": 0,
      "In Progress": 0,
      Completed: 0,
    } as Record<StatusFilter, number>;
    items.forEach((i) => {
      if (i.actionStatus) base[i.actionStatus]++;
    });
    return base;
  }, [items]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formSummary.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/notion/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackId: formId.trim(),
          feedbackType: formType,
          feedbackSummary: formSummary.trim(),
          feedbackDate: new Date().toISOString().slice(0, 10),
          relatedContentIds: formContentId ? [formContentId] : [],
          actionRequired: formActionRequired,
        }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);

      // Reset form and refresh
      setFormId("");
      setFormSummary("");
      setFormContentId("");
      setFormActionRequired(false);
      setShowNewForm(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: FeedbackActionStatus) => {
    if (!selectedItem) return;
    try {
      const res = await fetch("/api/notion/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedItem.id, actionStatus: status }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Stakeholder Feedback Queue</h1>
            <p className="page-subtitle">
              {loading ? "Loading..." : `${items.length} feedback items · ${counts["Not Started"]} unaddressed`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              {counts["Not Started"] > 0 && (
                <span className={styles.iconBadge}>{counts["Not Started"]}</span>
              )}
            </button>
            <button
              className={canUserWrite ? "btn-gradient" : "btn-gradient opacity-50 cursor-not-allowed"}
              disabled={!canUserWrite}
              title={canUserWrite ? "Log new feedback" : "Write access required"}
              onClick={() => setShowNewForm(true)}
            >
              <IconPlus style={{ marginRight: "8px" }} />
              Log Feedback
            </button>
          </div>
        </header>

        <section className="page-section">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-800">
              Error loading feedback: {error}
            </div>
          )}

          {showNewForm && (
            <div className={styles.itemCard} style={{ marginBottom: "24px", padding: "24px" }}>
              <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>
                Log new feedback
              </h3>
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  type="text"
                  placeholder="Feedback ID / title"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  required
                  style={formInputStyle}
                />
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as FeedbackType)}
                  style={formInputStyle}
                >
                  <option value="Patient">Patient</option>
                  <option value="Clinician">Clinician</option>
                  <option value="Expert">Expert</option>
                  <option value="Public">Public</option>
                </select>
                <textarea
                  placeholder="Feedback summary"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  required
                  rows={3}
                  style={{ ...formInputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
                <select
                  value={formContentId}
                  onChange={(e) => setFormContentId(e.target.value)}
                  style={formInputStyle}
                >
                  <option value="">— No related content —</option>
                  {contentAssets.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={formActionRequired}
                    onChange={(e) => setFormActionRequired(e.target.checked)}
                  />
                  Action required
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" disabled={submitting} className="btn-gradient" style={{ flex: 1 }}>
                    {submitting ? "Saving..." : "Save feedback"}
                  </button>
                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => setShowNewForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <IconSearch style={{ width: "18px", color: "var(--text-subtle)" }} />
              <input
                placeholder="Search feedback items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.filterRow}>
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                className={activeFilter === filter ? styles.filterActive : styles.filterPill}
                onClick={() => setActiveFilter(filter)}
              >
                {filter} ({counts[filter]})
              </button>
            ))}
          </div>

          <div className={styles.grid}>
            <div className={styles.list}>
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  Loading feedback...
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No feedback items match your filters
                </div>
              ) : filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={styles.itemCard}
                    style={{ cursor: "pointer", borderColor: isSelected ? "var(--primary)" : undefined }}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className={styles.itemHeader}>
                      <div>
                        <div className={styles.itemTitle}>{item.feedbackId}</div>
                        <div className={styles.itemMeta}>
                          {item.feedbackType ?? "Unknown"}
                          {item.actionOwner.length > 0 && ` · ${item.actionOwner.join(", ")}`}
                        </div>
                      </div>
                      {item.feedbackType && (
                        <span className={`status-badge ${TYPE_COLORS[item.feedbackType]}`}>
                          {item.feedbackType}
                        </span>
                      )}
                    </div>
                    <div className={styles.tagRow}>
                      {(item.relatedContentTitles ?? []).map((title) => (
                        <span key={title} className={styles.tag}>{title}</span>
                      ))}
                      {item.actionRequired && (
                        <span className={styles.tag} style={{ background: "#fee2e2", color: "#b91c1c" }}>
                          Action needed
                        </span>
                      )}
                      <span className={styles.time}>{formatRelative(item.feedbackDate ?? item.createdTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedItem && (
              <aside className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelStatus}>
                    {selectedItem.actionStatus ?? "Not Started"}
                  </span>
                  <h3>{selectedItem.feedbackId}</h3>
                </div>

                <div className={styles.panelSection}>
                  <h4>Feedback Source</h4>
                  <p>{selectedItem.feedbackType ?? "Unknown"}</p>
                  {selectedItem.actionOwner.length > 0 && (
                    <div className={styles.tagRow} style={{ border: "none", marginTop: "8px", paddingTop: 0 }}>
                      {selectedItem.actionOwner.map((o) => (
                        <span key={o} className={styles.tag}>{o}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.panelSection}>
                  <h4>Feedback Summary</h4>
                  <p>{selectedItem.feedbackSummary || <em style={{ color: "var(--text-muted)" }}>No summary provided</em>}</p>
                </div>

                {(selectedItem.relatedContentTitles ?? []).length > 0 && (
                  <div className={styles.panelSection}>
                    <h4>Linked Content</h4>
                    {(selectedItem.relatedContentTitles ?? []).map((title) => (
                      <div key={title} className={styles.linkedCard}>
                        <div>
                          <div className={styles.linkedTitle}>{title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedItem.actionTaken && (
                  <div className={styles.panelSection}>
                    <h4>Action Taken</h4>
                    <p>{selectedItem.actionTaken}</p>
                  </div>
                )}

                {canUserWrite && (
                  <div className={styles.panelButtons}>
                    {selectedItem.actionStatus !== "Completed" && (
                      <button
                        className="btn-gradient"
                        style={{ flex: 1 }}
                        onClick={() => handleUpdateStatus("Completed")}
                      >
                        Mark Resolved
                      </button>
                    )}
                    {selectedItem.actionStatus === "Not Started" && (
                      <button
                        className="btn-pill"
                        onClick={() => handleUpdateStatus("In Progress")}
                      >
                        Start
                      </button>
                    )}
                  </div>
                )}
              </aside>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const formInputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border-soft, #e5e7eb)",
  fontSize: "14px",
  outline: "none",
  fontFamily: "inherit",
};

"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import { IconBell, IconPlus, IconFilter } from "../../components/Icons";
import {
  ContentRequestItem,
  ContentRequestStatus,
  ContentRequestPriority,
  ContentRequestSource,
  ContentRequestFormat,
  ContentRequestAudience,
} from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";
import { canWrite } from "../../lib/auth/roles";

// Kanban columns in workflow order
const COLUMNS: { status: ContentRequestStatus; color: string }[] = [
  { status: "Not Started", color: "red" },
  { status: "Planning", color: "yellow" },
  { status: "Creating", color: "orange" },
  { status: "Review", color: "blue" },
  { status: "Published", color: "green" },
];

const PRIORITIES: ContentRequestPriority[] = ["High", "Medium", "Low"];
const SOURCES: ContentRequestSource[] = ["Patient", "Clinician", "Analytics", "Team"];
const FORMATS: ContentRequestFormat[] = ["Blog", "Video", "Guide", "Infographic"];
const AUDIENCES: ContentRequestAudience[] = ["Patient", "Caregiver", "Healthcare Professional"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function daysUntil(dateStr: string | null): { days: number; overdue: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return { days: Math.abs(days), overdue: days < 0 };
}

export default function ContentRequestsPage() {
  const { data: session } = useSession();
  const canUserWrite = canWrite(session?.user?.role ?? "viewer");

  const { data: requests, loading, error } = useNotionData<ContentRequestItem>("/api/notion/content-requests");

  const [priorityFilter, setPriorityFilter] = useState<ContentRequestPriority | "All">("All");
  const [showNewForm, setShowNewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSource, setFormSource] = useState<ContentRequestSource>("Team");
  const [formPriority, setFormPriority] = useState<ContentRequestPriority>("Medium");
  const [formFormat, setFormFormat] = useState<ContentRequestFormat>("Guide");
  const [formAudience, setFormAudience] = useState<ContentRequestAudience[]>(["Patient"]);
  const [formWhyNeeded, setFormWhyNeeded] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  // Group by status, apply priority filter
  const columnData = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      items: requests.filter((r) => {
        if (r.status !== col.status) return false;
        if (priorityFilter !== "All" && r.priority !== priorityFilter) return false;
        return true;
      }),
    }));
  }, [requests, priorityFilter]);

  const totalVisible = columnData.reduce((sum, c) => sum + c.items.length, 0);

  const handleStatusChange = async (pageId: string, newStatus: ContentRequestStatus) => {
    try {
      const res = await fetch("/api/notion/content-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, status: newStatus }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/notion/content-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestTitle: formTitle.trim(),
          requestSource: formSource,
          priority: formPriority,
          formatRequested: formFormat,
          targetAudience: formAudience,
          whyNeeded: formWhyNeeded.trim() || undefined,
          dueDate: formDueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);

      // Reset
      setFormTitle("");
      setFormWhyNeeded("");
      setFormDueDate("");
      setFormAudience(["Patient"]);
      setShowNewForm(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAudience = (aud: ContentRequestAudience) => {
    setFormAudience((prev) =>
      prev.includes(aud) ? prev.filter((a) => a !== aud) : [...prev, aud]
    );
  };

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Content Request Pipeline</h1>
            <p className="page-subtitle">
              {loading ? "Loading requests..." : `${requests.length} total · ${totalVisible} visible`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
            </button>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as ContentRequestPriority | "All")}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid var(--border-soft, #e5e7eb)",
                fontSize: "13px",
                fontWeight: 600,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="All">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              className={canUserWrite ? "btn-gradient" : "btn-gradient opacity-50 cursor-not-allowed"}
              disabled={!canUserWrite}
              title={canUserWrite ? "Open new request" : "Write access required"}
              onClick={() => setShowNewForm(true)}
            >
              <IconPlus style={{ marginRight: "8px" }} />
              New Request
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-800" style={{ margin: "0 32px 16px" }}>
            Error loading requests: {error}
          </div>
        )}

        {showNewForm && (
          <div style={{ margin: "0 32px 24px", padding: "24px", background: "#fff", borderRadius: "16px", border: "1px solid var(--border-soft, #e5e7eb)" }}>
            <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>
              New content request
            </h3>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="text"
                placeholder="Request title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                style={inputStyle}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <select value={formSource} onChange={(e) => setFormSource(e.target.value as ContentRequestSource)} style={inputStyle}>
                  {SOURCES.map((s) => <option key={s} value={s}>Source: {s}</option>)}
                </select>
                <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as ContentRequestPriority)} style={inputStyle}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>Priority: {p}</option>)}
                </select>
                <select value={formFormat} onChange={(e) => setFormFormat(e.target.value as ContentRequestFormat)} style={inputStyle}>
                  {FORMATS.map((f) => <option key={f} value={f}>Format: {f}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", alignSelf: "center", fontWeight: 600 }}>Audience:</span>
                {AUDIENCES.map((aud) => (
                  <label key={aud} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                    <input
                      type="checkbox"
                      checked={formAudience.includes(aud)}
                      onChange={() => toggleAudience(aud)}
                    />
                    {aud}
                  </label>
                ))}
              </div>
              <textarea
                placeholder="Why is this content needed?"
                value={formWhyNeeded}
                onChange={(e) => setFormWhyNeeded(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" disabled={submitting} className="btn-gradient" style={{ flex: 1 }}>
                  {submitting ? "Saving..." : "Create request"}
                </button>
                <button type="button" className="btn-pill" onClick={() => setShowNewForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <section className={styles.board}>
          {columnData.map((column) => (
            <div key={column.status} className={styles.column}>
              <div className={styles.columnHeader}>
                <span>{column.status}</span>
                <span className={styles.count}>{column.items.length}</span>
              </div>
              {loading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  Loading...
                </div>
              ) : column.items.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                  No items
                </div>
              ) : column.items.map((item) => {
                const due = daysUntil(item.dueDate);
                return (
                  <div key={item.id} className={styles.card}>
                    {item.priority && (
                      <span className={`${styles.priority} ${styles[`priority${item.priority}`] ?? ""}`}>
                        {item.priority} Priority
                      </span>
                    )}
                    <div className={styles.cardTitle}>{item.requestTitle}</div>
                    {item.whyNeeded && (
                      <div className={styles.cardDesc}>
                        {item.whyNeeded.slice(0, 100)}{item.whyNeeded.length > 100 && "…"}
                      </div>
                    )}
                    <div className={styles.tagRow}>
                      {item.requestSource && <span className={styles.tag}>{item.requestSource}</span>}
                      {item.formatRequested && <span className={styles.tag}>{item.formatRequested}</span>}
                      {item.targetAudience.slice(0, 2).map((aud) => (
                        <span key={aud} className={styles.tag}>{aud}</span>
                      ))}
                    </div>
                    <div className={styles.meta}>
                      {item.assignedTo.length > 0 ? item.assignedTo.join(", ") : "Unassigned"}
                      {due && (
                        <span style={{ marginLeft: "8px", color: due.overdue ? "var(--accent-red, #ef4444)" : "var(--text-muted)", fontWeight: due.overdue ? 700 : 500 }}>
                          {due.overdue ? `${due.days}d overdue` : `Due in ${due.days}d · ${formatDate(item.dueDate)}`}
                        </span>
                      )}
                    </div>
                    {canUserWrite && (
                      <select
                        value={item.status ?? "Not Started"}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as ContentRequestStatus)}
                        style={{
                          marginTop: "8px",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-soft, #e5e7eb)",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: "#fff",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>
                            Move to: {c.status}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border-soft, #e5e7eb)",
  fontSize: "14px",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

"use client";

import { useState, useEffect, useMemo } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import {
  IconBell,
  IconCalendar,
  IconExternalLink,
} from "../../components/Icons";
import { ContentItem, PifValidationItem, EvidenceItem, KeywordItem } from "../../lib/notion/types";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

const COLORS = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  blue: "#3208f5",
  purple: "#a855f7",
  teal: "#14b8a6",
};

export default function AnalyticsPage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [compliance, setCompliance] = useState<PifValidationItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllData() {
      try {
        const [contentRes, complianceRes, evidenceRes, keywordsRes] = await Promise.all([
          fetch("/api/notion/content"),
          fetch("/api/notion/compliance"),
          fetch("/api/notion/evidence"),
          fetch("/api/notion/keywords"),
        ]);

        const [contentData, complianceData, evidenceData, keywordsData] = await Promise.all([
          contentRes.json(),
          complianceRes.json(),
          evidenceRes.json(),
          keywordsRes.json(),
        ]);

        if (Array.isArray(contentData)) setContent(contentData);
        if (Array.isArray(complianceData)) setCompliance(complianceData);
        if (Array.isArray(evidenceData)) setEvidence(evidenceData);
        if (Array.isArray(keywordsData)) setKeywords(keywordsData);
      } catch {
        // Error handling delegated to error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, []);

  // ── Derived stats ──

  const compliantCount = compliance.filter((c) => c.status === "✅ YES").length;
  const nonCompliantCount = compliance.length - compliantCount;
  const avgCompliance = compliance.length > 0 ? Math.round((compliantCount / compliance.length) * 100) : 0;
  const pendingReviews = content.filter((c) => c.status === "👁️ Review" || c.status === "⚠️ Needs Update").length;

  // B.2 — Compliance donut
  const complianceDonut = useMemo(() => [
    { name: "Compliant", value: compliantCount, color: COLORS.green },
    { name: "Non-compliant", value: nonCompliantCount, color: COLORS.red },
  ], [compliantCount, nonCompliantCount]);

  // B.3 — Content coverage by medical category
  const coverageByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    content.forEach((c) => {
      const cat = c.contentType || "Uncategorised";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [content]);

  // B.4 — Keyword ranking distribution
  const keywordRanking = useMemo(() => {
    const buckets = [
      { name: "Top 3", min: 1, max: 3, count: 0, color: COLORS.green },
      { name: "4–10", min: 4, max: 10, count: 0, color: COLORS.teal },
      { name: "11–20", min: 11, max: 20, count: 0, color: COLORS.yellow },
      { name: "21–50", min: 21, max: 50, count: 0, color: COLORS.purple },
      { name: "50+", min: 51, max: Infinity, count: 0, color: COLORS.red },
      { name: "Unranked", min: 0, max: 0, count: 0, color: "#9ca3af" },
    ];
    keywords.forEach((k) => {
      const rank = k.currentRanking;
      if (!rank || rank <= 0) {
        buckets[5].count++;
      } else {
        const bucket = buckets.find((b) => rank >= b.min && rank <= b.max);
        if (bucket) bucket.count++;
      }
    });
    return buckets.filter((b) => b.count > 0);
  }, [keywords]);

  // B.5 — Evidence freshness
  const evidenceFreshness = useMemo(() => {
    const now = Date.now();
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const buckets = { fresh: 0, moderate: 0, aging: 0, unknown: 0 };

    evidence.forEach((e) => {
      const dateStr = e.datePublished || e.lastUpdated;
      if (!dateStr) { buckets.unknown++; return; }
      const age = now - new Date(dateStr).getTime();
      if (age < ONE_YEAR) buckets.fresh++;
      else if (age < 3 * ONE_YEAR) buckets.moderate++;
      else buckets.aging++;
    });

    const avgAge = evidence.reduce((sum, e) => {
      const dateStr = e.datePublished || e.lastUpdated;
      if (!dateStr) return sum;
      return sum + (now - new Date(dateStr).getTime());
    }, 0);
    const validCount = evidence.filter((e) => e.datePublished || e.lastUpdated).length;
    const avgYears = validCount > 0 ? (avgAge / validCount / ONE_YEAR).toFixed(1) : "N/A";

    return { buckets, avgYears };
  }, [evidence]);

  // B.6 — Review calendar (next 6 months)
  const reviewCalendar = useMemo(() => {
    const SIX_MONTHS = 6;
    const now = new Date();
    const months: { name: string; due: number }[] = [];

    for (let i = 0; i < SIX_MONTHS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        name: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        due: 0,
      });
    }

    content.forEach((c) => {
      if (!c.lastReviewed) return;
      // Review due 12 months after last review
      const dueDate = new Date(c.lastReviewed);
      dueDate.setFullYear(dueDate.getFullYear() + 1);

      for (let i = 0; i < SIX_MONTHS; i++) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
        if (dueDate >= monthStart && dueDate <= monthEnd) {
          months[i].due++;
        }
      }
    });

    return months;
  }, [content]);

  // PIF Tick principle scores
  const calculateAvg = (key: keyof PifValidationItem) => {
    if (compliance.length === 0) return 0;
    const passed = compliance.filter((c) => c[key] === true).length;
    return Math.round((passed / compliance.length) * 100);
  };

  const getTone = (val: number) => {
    if (val >= 85) return "green";
    if (val >= 70) return "yellow";
    return "red";
  };

  const principles = [
    { label: "Accuracy (Peer Review)", value: calculateAvg("expertPeerReview"), tone: getTone(calculateAvg("expertPeerReview")) },
    { label: "Evidence Base", value: calculateAvg("evidenceBasedReview"), tone: getTone(calculateAvg("evidenceBasedReview")) },
    { label: "Content Need", value: calculateAvg("contentNeedDocumented"), tone: getTone(calculateAvg("contentNeedDocumented")) },
    { label: "Patient Readability", value: calculateAvg("patientReadability"), tone: getTone(calculateAvg("patientReadability")) },
    { label: "Accessibility", value: calculateAvg("inclusivityAssessment"), tone: getTone(calculateAvg("inclusivityAssessment")) },
    { label: "Transparency", value: calculateAvg("pifTickDeclaration"), tone: getTone(calculateAvg("pifTickDeclaration")) },
  ];

  const summaryCards = [
    { label: "Total Content", value: content.length.toString(), accent: "blue" },
    { label: "Avg Compliance", value: `${avgCompliance}%`, accent: "green" },
    { label: "Pending Reviews", value: pendingReviews.toString(), accent: "orange" },
    { label: "Evidence Sources", value: evidence.length.toString(), accent: "purple" },
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Analytics & Insights</h1>
            <p className="page-subtitle">
              {loading ? "Loading data..." : "Comprehensive performance metrics from Notion"}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              {pendingReviews > 0 && <span className={styles.iconBadge}>{pendingReviews}</span>}
            </button>
            <button className="btn-pill opacity-50 cursor-not-allowed" disabled title="Coming soon">
              <IconExternalLink style={{ width: "14px", marginRight: "6px" }} />
              Export Report
            </button>
          </div>
        </header>

        <section className="page-section">
          {/* Summary cards */}
          <div className={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <div key={card.label} className={`${styles.summaryCard} ${styles[card.accent]}`}>
                <div className={styles.summaryLabel}>{card.label}</div>
                <div className={styles.summaryValue}>{loading ? "..." : card.value}</div>
                <div className={styles.summaryMeta}>Active items</div>
              </div>
            ))}
          </div>

          {/* Chart grid */}
          <div className={styles.chartGrid}>
            {/* B.2 — Compliance donut */}
            <div className={styles.chartCard}>
              <h3 className="card-title">Validation Coverage</h3>
              {compliance.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={complianceDonut}
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      stroke="none"
                    >
                      {complianceDonut.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  No compliance data
                </div>
              )}
              <div className={styles.coverageList}>
                <div>
                  <span><span className={styles.dotGreen} /> Compliant</span>
                  <strong>{compliantCount}</strong>
                </div>
                <div>
                  <span><span className={styles.dotRed} /> Non-compliant</span>
                  <strong>{nonCompliantCount}</strong>
                </div>
              </div>
            </div>

            {/* B.3 — Content coverage by category */}
            <div className={styles.chartCard}>
              <h3 className="card-title">Content by Medical Category</h3>
              {coverageByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={coverageByCategory} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  No content data
                </div>
              )}
            </div>

            {/* B.4 — Keyword ranking distribution */}
            <div className={styles.chartCard}>
              <h3 className="card-title">Keyword Ranking Distribution</h3>
              {keywordRanking.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={keywordRanking}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {keywordRanking.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  No keyword data
                </div>
              )}
            </div>

            {/* B.6 — Review calendar */}
            <div className={styles.chartCard}>
              <h3 className="card-title">Reviews Due (Next 6 Months)</h3>
              {content.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={reviewCalendar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="due"
                      stroke={COLORS.blue}
                      strokeWidth={2}
                      dot={{ fill: COLORS.blue, r: 4 }}
                      name="Reviews due"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  No content data
                </div>
              )}
            </div>
          </div>

          {/* Lower grid */}
          <div className={styles.lowerGrid}>
            {/* B.5 — Evidence freshness */}
            <div className={styles.widgetCard}>
              <h3 className="card-title">Evidence Currency</h3>
              <div className={styles.circleStat}>
                <div className={styles.circleValue}>{evidenceFreshness.avgYears}</div>
                <div className={styles.circleLabel}>Avg Years</div>
              </div>
              <div className={styles.miniList}>
                <div>
                  <span><span className={styles.badgeGreen} /> Fresh (0–1 year)</span>
                  <strong>{evidenceFreshness.buckets.fresh}</strong>
                </div>
                <div>
                  <span><span className={styles.badgeYellow} /> Moderate (1–3 years)</span>
                  <strong>{evidenceFreshness.buckets.moderate}</strong>
                </div>
                <div>
                  <span><span className={styles.badgeRed} /> Aging (3+ years)</span>
                  <strong>{evidenceFreshness.buckets.aging}</strong>
                </div>
              </div>
            </div>

            {/* PIF Tick principles */}
            <div className={styles.widgetCard}>
              <h3 className="card-title">PIF Tick Principles</h3>
              <div className={styles.principleList}>
                {principles.map((item) => (
                  <div key={item.label} className={styles.principleRow}>
                    <span>{item.label}</span>
                    <span className={styles[`tone-${item.tone}`]}>{item.value}%</span>
                    <div className={styles.principleBar}>
                      <div style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

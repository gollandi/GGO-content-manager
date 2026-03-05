"use client";

import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import {
  IconBell,
  IconCalendar,
  IconExternalLink,
  IconPlus
} from "../../components/Icons";
import { ContentItem, PifValidationItem, EvidenceItem } from "../../lib/notion/types";

export default function AnalyticsPage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [compliance, setCompliance] = useState<PifValidationItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [contentRes, complianceRes, evidenceRes] = await Promise.all([
          fetch("/api/notion/content"),
          fetch("/api/notion/compliance"),
          fetch("/api/notion/evidence")
        ]);

        const [contentData, complianceData, evidenceData] = await Promise.all([
          contentRes.json(),
          complianceRes.json(),
          evidenceRes.json()
        ]);

        setContent(contentData);
        setCompliance(complianceData);
        setEvidence(evidenceData);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const totalContent = content.length || 228; // Fallback to mock if empty during dev
  const pendingReviews = content.filter(item => item.status === "👁️ Review").length || 47;
  const totalEvidence = evidence.length || 265;

  const compliantCount = compliance.filter(item => item.status === "✅ YES").length;
  const partiallyCompliant = compliance.length - compliantCount; // Simplified calculation for now
  const avgCompliance = compliance.length > 0 ? Math.round((compliantCount / compliance.length) * 100) : 84;

  const summaryCards = [
    { label: "Total Content", value: totalContent.toString(), accent: "blue" },
    { label: "Avg Compliance", value: `${avgCompliance}%`, accent: "green" },
    { label: "Pending Reviews", value: pendingReviews.toString(), accent: "orange" },
    { label: "Evidence Items", value: totalEvidence.toString(), accent: "purple" }
  ];

  const principles = [
    { label: "Accuracy", value: 91, tone: "green" },
    { label: "Evidence Base", value: 89, tone: "green" },
    { label: "Balance", value: 76, tone: "yellow" },
    { label: "Clarity", value: 91, tone: "green" },
    { label: "Transparency", value: 82, tone: "yellow" },
    { label: "Accessibility", value: 88, tone: "green" },
    { label: "Relevance", value: 68, tone: "red" }
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Analytics & Insights</h1>
            <p className="page-subtitle">Comprehensive performance metrics and trends from Notion</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-pill">
              <IconCalendar style={{ width: '14px', marginRight: '6px' }} />
              Last 30 Days
            </button>
            <button className="btn-pill">
              <IconExternalLink style={{ width: '14px', marginRight: '6px' }} />
              Export Report
            </button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.chartGrid}>
            <div className={styles.chartCard}>
              <h3 className="card-title">Validation Coverage</h3>
              <div className={styles.donut} />
              <div className={styles.coverageList}>
                <div>
                  <span><span className={styles.dotGreen}></span> Compliant Content</span>
                  <strong>{compliantCount || 156}</strong>
                </div>
                <div>
                  <span><span className={styles.dotYellow}></span> Partial Compliance</span>
                  <strong>{partiallyCompliant || 52}</strong>
                </div>
                <div>
                  <span><span className={styles.dotRed}></span> Failed Validation</span>
                  <strong>{20}</strong>
                </div>
              </div>
            </div>
            <div className={styles.chartCard}>
              <h3 className="card-title">Risk Distribution</h3>
              <div className={styles.barChart} />
              <button className={styles.linkButton}>View details</button>
            </div>
            <div className={styles.chartCard}>
              <h3 className="card-title">Content by Topic</h3>
              <div className={styles.horizontalBars} />
            </div>
            <div className={styles.chartCard}>
              <h3 className="card-title">Upcoming Work Distribution</h3>
              <div className={styles.lineChart} />
            </div>
          </div>

          <div className={styles.lowerGrid}>
            <div className={styles.widgetCard}>
              <h3 className="card-title">Evidence Currency</h3>
              <div className={styles.circleStat}>
                <div className={styles.circleValue}>2.4</div>
                <div className={styles.circleLabel}>Years</div>
              </div>
              <div className={styles.miniList}>
                <div>
                  <span><span className={styles.badgeGreen}></span> Fresh (0-1 year)</span>
                  <strong>142</strong>
                </div>
                <div>
                  <span><span className={styles.badgeYellow}></span> Moderate (1-3 years)</span>
                  <strong>89</strong>
                </div>
                <div>
                  <span><span className={styles.badgeRed}></span> Aging (3+ years)</span>
                  <strong>34</strong>
                </div>
              </div>
            </div>
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

          <div className={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <div key={card.label} className={`${styles.summaryCard} ${styles[card.accent]}`}>
                <div className={styles.summaryLabel}>{card.label}</div>
                <div className={styles.summaryValue}>{card.value}</div>
                <div className={styles.summaryMeta}>Active items</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";
import { PifValidationItem } from "../../lib/notion/types";

export default function ValidationHubPage() {
  const [allValidations, setAllValidations] = useState<PifValidationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchValidations() {
      try {
        const res = await fetch("/api/notion/compliance");
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllValidations(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching PIF validations:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchValidations();
  }, []);

  const filteredValidations = useMemo(() => {
    return allValidations.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      const isPass = v.status === "✅ YES";
      if (activeTab === "pass") return isPass;
      if (activeTab === "fail") return !isPass;
      return true;
    });
  }, [allValidations, searchQuery, activeTab]);

  const selectedItem = useMemo(() => {
    return allValidations.find(v => v.id === selectedId) || filteredValidations[0] || null;
  }, [allValidations, selectedId, filteredValidations]);

  const counts = useMemo(() => ({
    all: allValidations.length,
    pass: allValidations.filter(v => v.status === "✅ YES").length,
    fail: allValidations.filter(v => v.status !== "✅ YES").length,
  }), [allValidations]);

  const tabs = [
    { label: `All (${counts.all})`, id: "all" },
    { label: `Compliant (${counts.pass})`, id: "pass" },
    { label: `Issues (${counts.fail})`, id: "fail" }
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const principles = selectedItem ? [
    { label: "Evidence-Based Review", passed: selectedItem.evidenceBasedReview, note: selectedItem.evidenceNotes },
    { label: "Content Need Documented", passed: selectedItem.contentNeedDocumented, note: selectedItem.contentNeedNotes },
    { label: "Patient Readability", passed: selectedItem.patientReadability, note: `Reading Level: ${selectedItem.readingLevel || 'N/A'}` },
    { label: "Inclusivity Assessment", passed: selectedItem.inclusivityAssessment, note: selectedItem.inclusivityNotes },
    { label: "Expert Peer Review", passed: selectedItem.expertPeerReview, note: selectedItem.peerReviewerName ? `Reviewer: ${selectedItem.peerReviewerName}` : 'No reviewer assigned' },
    { label: "PIF TICK Declaration", passed: selectedItem.pifTickDeclaration, note: selectedItem.pifTickDeclaration ? 'Declaration signed' : 'Pending declaration' },
  ] : [];

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Header with PIF Tick logo */}
        <header className="page-header">
          <div className={styles.pifHeader}>
            <div className={styles.pifLogo}>
              <Image src="/pif-tick-logo.svg" alt="PIF Tick" width={48} height={48} />
            </div>
            <div>
              <h1 className="page-title">PIF Tick Validation</h1>
              <p className="page-subtitle">Content compliance & quality evaluation</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.iconButtons}>
              <button className={styles.iconButton} aria-label="Notifications">
                <Icons.IconBell className={styles.iconSm} />
                {counts.fail > 0 && <span className={styles.iconBadge}>{counts.fail}</span>}
              </button>
            </div>
            <button className="btn-gradient" onClick={() => window.location.reload()}>
              <Icons.IconSync className={styles.iconSm} style={{ marginRight: '8px' }} />
              Refresh
            </button>
          </div>
        </header>

        <section className="page-section">
          {/* Stats Overview */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
                <Icons.IconFileText style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.statValue}>{counts.all}</div>
                <div className={styles.statLabel}>Total Reviews</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconPass}`}>
                <Icons.IconCheckCircleFilled style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.statValue}>{counts.pass}</div>
                <div className={styles.statLabel}>PIF Tick Valid</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconFail}`}>
                <Icons.IconXCircleFilled style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.statValue}>{counts.fail}</div>
                <div className={styles.statLabel}>Issues Found</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconPending}`}>
                <Icons.IconClock style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className={styles.statValue}>
                  {counts.all > 0 ? Math.round((counts.pass / counts.all) * 100) : 0}%
                </div>
                <div className={styles.statLabel}>Compliance Rate</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Icons.IconSearch className={styles.iconSm} style={{ color: 'var(--text-muted)' }} />
              <input
                placeholder="Search content by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn-pill">
              <Icons.IconFilter className={styles.iconSm} style={{ marginRight: '6px' }} />
              Filters
            </button>
            <div className={styles.toolbarMeta}>Showing {filteredValidations.length} items</div>
          </div>

          {/* Tabs */}
          <div className={styles.tabRow}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? styles.tabActive : styles.tabButton}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Grid: List + Detail Panel */}
          <div className={styles.grid}>
            {/* Left: Validation Queue */}
            <div className={styles.list}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderTitle}>
                  Validation Queue
                  <span className={styles.listBadge}>{filteredValidations.length} items</span>
                </div>
              </div>
              <div className={styles.listBody}>
                {loading ? (
                  <div className={styles.loadingState}>Loading PIF reviews from Notion...</div>
                ) : filteredValidations.length === 0 ? (
                  <div className={styles.emptyState}>No validation items found</div>
                ) : filteredValidations.map((item) => {
                  const isCompliant = item.status === "✅ YES";
                  const isSelected = selectedItem?.id === item.id;
                  const passCount = [item.evidenceBasedReview, item.contentNeedDocumented, item.patientReadability, item.inclusivityAssessment, item.expertPeerReview, item.pifTickDeclaration].filter(Boolean).length;

                  return (
                    <div
                      key={item.id}
                      className={`${styles.validationCard} ${isSelected ? styles.validationCardActive : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className={styles.validationHeader}>
                        <div className={styles.validationHeaderLeft}>
                          <div
                            className={styles.validationIcon}
                            style={{
                              background: isCompliant ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                              color: isCompliant ? '#059669' : '#dc2626'
                            }}
                          >
                            {isCompliant
                              ? <Icons.IconCheckCircleFilled style={{ width: 22, height: 22 }} />
                              : <Icons.IconXCircleFilled style={{ width: 22, height: 22 }} />
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={styles.validationTitle}>{item.title}</div>
                            <div className={styles.validationMeta}>
                              <span>Review: {formatDate(item.reviewDate)}</span>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db', display: 'inline-block' }} />
                              <span>{item.reviewer?.[0] || 'Unassigned'}</span>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db', display: 'inline-block' }} />
                              <span>{passCount}/6 checks</span>
                            </div>
                          </div>
                        </div>
                        <div className={`${styles.statusPill} ${isCompliant ? styles.statusPass : styles.statusFail}`}>
                          <span className={`${styles.statusDot} ${isCompliant ? styles.statusDotPass : styles.statusDotFail}`} />
                          {isCompliant ? 'Valid' : 'Issues'}
                        </div>
                      </div>

                      {/* Color-coded metric pills */}
                      <div className={styles.metricRow}>
                        {[
                          { label: "Evidence", passed: item.evidenceBasedReview },
                          { label: "Readability", passed: item.patientReadability },
                          { label: "Inclusivity", passed: item.inclusivityAssessment },
                          { label: "Peer Review", passed: item.expertPeerReview },
                          { label: "Content Need", passed: item.contentNeedDocumented },
                          { label: "Declaration", passed: item.pifTickDeclaration },
                        ].map((metric) => (
                          <div
                            key={metric.label}
                            className={`${styles.metricPill} ${metric.passed ? styles.metricPass : styles.metricFail}`}
                          >
                            {metric.passed
                              ? <Icons.IconCheckCircleFilled className={styles.metricIcon} />
                              : <Icons.IconXCircleFilled className={styles.metricIcon} />
                            }
                            <span className={styles.metricLabel}>{metric.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Detail Panel */}
            <aside className={styles.panel}>
              {selectedItem ? (
                <>
                  {/* Selected Item Header */}
                  <div className={styles.panelCard}>
                    <div className={styles.panelCardBody}>
                      <div className={styles.detailHeader}>
                        <div className={`${styles.detailIcon} ${selectedItem.status === "✅ YES" ? styles.detailIconPass : styles.detailIconFail}`}>
                          {selectedItem.status === "✅ YES"
                            ? <Icons.IconCheckCircleFilled style={{ width: 28, height: 28 }} />
                            : <Icons.IconXCircleFilled style={{ width: 28, height: 28 }} />
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className={`${styles.statusPill} ${selectedItem.status === "✅ YES" ? styles.statusPass : styles.statusFail}`} style={{ marginBottom: 8 }}>
                            <span className={`${styles.statusDot} ${selectedItem.status === "✅ YES" ? styles.statusDotPass : styles.statusDotFail}`} />
                            {selectedItem.status === "✅ YES" ? 'PIF Tick Valid' : 'Incomplete / Failed'}
                          </div>
                          <div className={styles.detailTitle}>{selectedItem.title}</div>
                          <div className={styles.detailMeta}>
                            <span>Version: {selectedItem.version || 'N/A'}</span>
                            <span>Reviewed: {formatDate(selectedItem.reviewDate)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Readability metrics */}
                      <div className={styles.readabilityGrid}>
                        <div className={styles.readabilityItem}>
                          <div className={styles.readabilityValue}>{selectedItem.readabilityScore || '—'}</div>
                          <div className={styles.readabilityLabel}>Readability</div>
                        </div>
                        <div className={styles.readabilityItem}>
                          <div className={styles.readabilityValue}>{selectedItem.readingLevel || '—'}</div>
                          <div className={styles.readabilityLabel}>Reading Level</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PIF Tick Principles */}
                  <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                      <div className={styles.panelCardTitle}>
                        <span className={styles.panelCardTitleIcon} />
                        PIF Tick Principles
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                        {principles.filter(p => p.passed).length}/{principles.length} Passed
                      </span>
                    </div>
                    <div className={styles.panelCardBody}>
                      <div className={styles.principleList}>
                        {principles.map((p, idx) => {
                          const statusClass = p.passed === true
                            ? styles.principlePass
                            : p.passed === false
                              ? styles.principleFail
                              : styles.principlePending;
                          const iconClass = p.passed === true
                            ? styles.principleIconPass
                            : p.passed === false
                              ? styles.principleIconFail
                              : styles.principleIconPending;
                          const statusPillClass = p.passed === true
                            ? styles.principleStatusPass
                            : p.passed === false
                              ? styles.principleStatusFail
                              : styles.principleStatusPending;

                          return (
                            <div key={idx} className={`${styles.principleItem} ${statusClass}`}>
                              <div className={`${styles.principleIcon} ${iconClass}`}>
                                {p.passed === true
                                  ? <Icons.IconCheck style={{ width: 14, height: 14 }} />
                                  : p.passed === false
                                    ? <Icons.IconAlertCircle style={{ width: 14, height: 14 }} />
                                    : <Icons.IconClock style={{ width: 14, height: 14 }} />
                                }
                              </div>
                              <div className={styles.principleContent}>
                                <div className={styles.principleName}>{p.label}</div>
                                <div className={styles.principleNote}>
                                  {p.note || 'No notes available'}
                                </div>
                              </div>
                              <span className={`${styles.principleStatus} ${statusPillClass}`}>
                                {p.passed === true ? 'Pass' : p.passed === false ? 'Fail' : 'Pending'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Compliance Notes */}
                  <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                      <div className={styles.panelCardTitle}>
                        <span className={styles.panelCardTitleIcon} />
                        Compliance Notes
                      </div>
                    </div>
                    <div className={styles.panelCardBody}>
                      <div className={styles.complianceBox}>
                        <div className={styles.complianceText}>
                          {selectedItem.complianceNotes || "No specific compliance notes recorded for this item."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reviewer */}
                  <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                      <div className={styles.panelCardTitle}>
                        <span className={styles.panelCardTitleIcon} />
                        Reviewer
                      </div>
                    </div>
                    <div className={styles.panelCardBody}>
                      <div className={styles.reviewerRow}>
                        <div className={styles.reviewerAvatar}>
                          {selectedItem.reviewer?.[0]
                            ? getInitials(selectedItem.reviewer[0])
                            : '?'}
                        </div>
                        <div className={styles.reviewerInfo}>
                          <div className={styles.reviewerName}>
                            {selectedItem.reviewer?.[0] || "No reviewer assigned"}
                          </div>
                          <div className={styles.reviewerDetail}>
                            {selectedItem.peerReviewerName
                              ? `Peer reviewer: ${selectedItem.peerReviewerName}`
                              : selectedItem.expertPeerReview
                                ? "Review completed"
                                : "Review pending"
                            }
                          </div>
                        </div>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: selectedItem.expertPeerReview ? '#10b981' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.panelCard}>
                  <div className={styles.panelCardBody}>
                    <div className={styles.emptyState}>
                      Select an item to view compliance details
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

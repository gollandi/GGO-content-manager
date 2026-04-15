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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [modalData, setModalData] = useState<{
    principle: string;
    notes: string;
    itemId: string;
    type: "readability" | "inclusivity" | "default" | "online-status";
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

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

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const runSelectiveAI = async (type: string, itemId: string) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const item = allValidations.find(v => v.id === itemId);
      const res = await fetch("/api/ai/validate", {
        method: "POST",
        body: JSON.stringify({
          text: item?.contentAssetNotes || "",
          url: item?.contentAssetUrl || "",
          mode: type
        })
      });
      const data = await res.json();
      setAiResult(data.analysis || data.summary || "No specific findings returned.");
    } catch (error) {
      setAiResult("Error running AI analysis.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredValidations = useMemo(() => {
    return allValidations.filter(v => {
      const titleMatch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const assetMatch = v.contentAssetTitle?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      if (!titleMatch && !assetMatch) return false;

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
    { label: "Evidence-Based Review", passed: selectedItem.evidenceBasedReview, note: selectedItem.automationLog, notesField: 'automationLog', type: 'default' },
    { label: "Content Need Documented", passed: selectedItem.contentNeedDocumented, note: selectedItem.contentNeedNotes, notesField: 'contentNeedNotes', type: 'default' },
    { label: "Patient Readability", passed: selectedItem.patientReadability, note: `Tier 1: ${selectedItem.readabilityTier1 || 'N/A'} - Tier 2: ${selectedItem.readabilityTier2 || 'N/A'}`, notesField: 'automationLog', type: 'readability' },
    { label: "Inclusivity Assessment", passed: selectedItem.inclusivityAssessment, note: selectedItem.inclusivityNotes, notesField: 'inclusivityNotes', type: 'inclusivity' },
    { label: "Expert Peer Review", passed: selectedItem.expertPeerReview, note: selectedItem.expertPeerReview ? 'Peer reviewed' : 'Pending', notesField: 'automationLog', type: 'default' },
    { label: "PIF Tick Online Status", passed: selectedItem.pifTickDeclaration, note: selectedItem.pifTickDeclaration ? 'Certification visible on website' : 'Certification NOT visible online', notesField: 'complianceNotes', type: 'online-status' },
  ] : [];

  return (
    <AppShell>
      <div className={styles.page}>
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

          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Icons.IconSearch className={styles.iconSm} style={{ color: 'var(--text-muted)' }} />
              <input
                placeholder="Search content or assets..."
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

          <div className={styles.grid}>
            <div className={styles.list}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderTitle}>
                  Validation Queue
                  <span className={styles.listBadge}>{filteredValidations.length} items</span>
                </div>
              </div>
              <div className={styles.listBody}>
                {loading ? (
                  <div className={styles.loadingState}>Loading PIF reviews...</div>
                ) : filteredValidations.length === 0 ? (
                  <div className={styles.emptyState}>No items found</div>
                ) : filteredValidations.map((item) => {
                  const isCompliant = item.status === "✅ YES";
                  const isSelected = selectedId === item.id;
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
                            {item.contentAssetTitle && (
                              <div className={styles.contentTitle}>{item.contentAssetTitle}</div>
                            )}
                            {item.contentAssetUrl && (
                              <a
                                href={item.contentAssetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.assetUrl}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.contentAssetUrl}
                                <Icons.IconExternalLink style={{ width: 10, height: 10 }} />
                              </a>
                            )}
                            <div className={styles.validationMeta}>
                              <span>Review: {formatDate(item.reviewDate)}</span>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db', display: 'inline-block' }} />
                              <span>{passCount}/6 checks</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <div className={`${styles.statusPill} ${isCompliant ? styles.statusPass : styles.statusFail}`}>
                            <span className={`${styles.statusDot} ${isCompliant ? styles.statusDotPass : styles.statusDotFail}`} />
                            {isCompliant ? 'Valid' : 'Issues'}
                          </div>
                          <button
                            className={`${styles.expandButton} ${expandedIds.has(item.id) ? styles.expandButtonActive : ''}`}
                            onClick={(e) => toggleExpand(e, item.id)}
                          >
                            <Icons.IconChevronDown style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      </div>

                      {expandedIds.has(item.id) && (
                        <div className={styles.cardExpandedContent}>
                          <div className={styles.expandedSummary}>
                            {item.contentAssetNotes || "No summary available."}
                          </div>
                        </div>
                      )}

                      <div className={styles.metricRow}>
                        {[
                          { label: "Evidence", passed: item.evidenceBasedReview, val: item.automationLog, type: 'default' as const },
                          { label: "Readability", passed: item.patientReadability, val: item.automationLog, type: 'readability' as const },
                          { label: "Inclusivity", passed: item.inclusivityAssessment, val: item.inclusivityNotes, type: 'inclusivity' as const },
                          { label: "Peer Review", passed: item.expertPeerReview, val: item.automationLog, type: 'default' as const },
                          { label: "Content Need", passed: item.contentNeedDocumented, val: item.contentNeedNotes, type: 'default' as const },
                          { label: "Online Status", passed: item.pifTickDeclaration, val: item.pifTickDeclaration ? "Active" : "Disabled", type: 'online-status' as const },
                        ].map((metric) => {
                          const isMismatch = metric.label === "Online Status" && metric.passed !== isCompliant;
                          const pillClass = isMismatch
                            ? styles.metricWarning
                            : metric.passed ? styles.metricPass : styles.metricFail;

                          return (
                            <div
                              key={metric.label}
                              className={`${styles.metricPill} ${pillClass}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAiResult(null);
                                setModalData({
                                  principle: metric.label,
                                  notes: metric.label === "Online Status"
                                    ? (isMismatch ? "⚠️ WARNING: Online certification status does not match internal compliance result." : "Online certification status matches internal compliance.")
                                    : (metric.val || "No specific notes available."),
                                  itemId: item.id,
                                  type: metric.type
                                });
                              }}
                            >
                              {isMismatch ? <Icons.IconAlertCircle className={styles.metricIcon} /> : (
                                metric.passed
                                  ? <Icons.IconCheckCircleFilled className={styles.metricIcon} />
                                  : <Icons.IconXCircleFilled className={styles.metricIcon} />
                              )}
                              <span className={styles.metricLabel}>{metric.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className={styles.panel}>
              {selectedItem ? (
                <>
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
                            {selectedItem.status === "✅ YES" ? 'PIF Tick Valid' : 'Issues Found'}
                          </div>
                          <div className={styles.detailTitle}>{selectedItem.title}</div>
                          <div className={styles.detailMeta}>
                            <span>Reviewed: {formatDate(selectedItem.reviewDate)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.readabilityGrid}>
                        <div className={styles.readabilityItem}>
                          <div className={styles.readabilityValue}>{selectedItem.readabilityTier1 || '—'}</div>
                          <div className={styles.readabilityLabel}>Tier 1</div>
                        </div>
                        <div className={styles.readabilityItem}>
                          <div className={styles.readabilityValue}>{selectedItem.readabilityTier2 || '—'}</div>
                          <div className={styles.readabilityLabel}>Tier 2</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                      <div className={styles.panelCardTitle}>
                        <span className={styles.panelCardTitleIcon} />
                        PIF Tick Principles
                      </div>
                    </div>
                    <div className={styles.panelCardBody}>
                      <div className={styles.principleList}>
                        {principles.map((p, idx) => (
                          <div key={idx} className={`${styles.principleItem} ${p.passed ? styles.principlePass : styles.principleFail}`}>
                            <div className={`${styles.principleIcon} ${p.passed ? styles.principleIconPass : styles.principleIconFail}`}>
                              {p.passed ? <Icons.IconCheck style={{ width: 14, height: 14 }} /> : <Icons.IconAlertCircle style={{ width: 14, height: 14 }} />}
                            </div>
                            <div className={styles.principleContent}>
                              <div className={styles.principleName}>{p.label}</div>
                              <div className={styles.principleNote}>{p.note || 'No notes available'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.panelCard}>
                  <div className={styles.panelCardBody}>
                    <div className={styles.emptyState}>Select an item to view details</div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>

      {modalData && (
        <div className={styles.modalOverlay} onClick={() => setModalData(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{modalData.principle} Details</h3>
              <button className={styles.modalClose} onClick={() => setModalData(null)}>
                <Icons.IconX style={{ width: 24, height: 24 }} />
              </button>
            </header>
            <div className={styles.modalBody}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', marginBottom: 8, textTransform: 'uppercase' }}>
                Status Details
              </div>
              <div className={styles.notesBox}>{modalData.notes}</div>

              {(modalData.type === 'readability' || modalData.type === 'inclusivity') && (
                <div className={styles.aiSection}>
                  <button
                    className={styles.aiTriggerBtn}
                    onClick={() => runSelectiveAI(modalData.type, modalData.itemId)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <>
                        <Icons.IconSync className="animate-spin" style={{ width: 16, height: 16 }} />
                        Analyzing with Gemini...
                      </>
                    ) : (
                      <>
                        <Icons.IconSparkles style={{ width: 16, height: 16 }} />
                        Run Selective AI {modalData.type === 'readability' ? 'Reading' : 'Inclusivity'} Check
                      </>
                    )}
                  </button>

                  {aiResult && (
                    <div className={styles.aiResult}>
                      <div className={styles.aiResultHeader}>
                        <Icons.IconSparkles style={{ width: 14, height: 14 }} />
                        Gemini Analysis Result
                      </div>
                      <div className={styles.aiResultText}>{aiResult}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <footer className={styles.modalFooter}>
              <button className="btn-pill" onClick={() => setModalData(null)}>Close</button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

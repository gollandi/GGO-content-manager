"use client";

import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import {
  IconBell as BellIcon,
  IconSearch as SearchIcon,
  IconFilter as FilterIcon,
  IconChevronRight as ChevronRightIcon,
  IconPlus as PlusIcon,
  IconEdit as EditIcon,
  IconExternalLink as ExternalLinkIcon,
  IconFileText as IconFileText, // Placeholder for missing icons
  IconShield as IconShield // Placeholder for missing icons
} from "../../components/Icons";
import { EvidenceItem } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";

// Mocking missing icons for now to fix build
const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => <span {...props as React.HTMLAttributes<HTMLSpanElement>}>✕</span>;
const FlagIcon = (props: React.SVGProps<SVGSVGElement>) => <IconShield {...props} />;
const ArchiveIcon = (props: React.SVGProps<SVGSVGElement>) => <IconFileText {...props} />;

export default function EvidenceRepositoryPage() {
  const { data: evidenceItems, loading, error } = useNotionData<EvidenceItem>("/api/notion/evidence");
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);

  // Select first item once data loads
  useEffect(() => {
    if (evidenceItems.length > 0 && !selectedItem) {
      setSelectedItem(evidenceItems[0]);
    }
  }, [evidenceItems, selectedItem]);

  const filters = [
    { label: "Evidence Type", value: "All Types" },
    { label: "Topic Area", value: "All Topics" },
    { label: "Evidence Age", value: "All Ages" },
    { label: "Status", value: "All Status" }
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Evidence Repository</h1>
            <p className="page-subtitle">Manage and track {evidenceItems.length} evidence sources from Notion</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <BellIcon />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">
              <PlusIcon style={{ marginRight: '8px', width: '20px' }} />
              Add Evidence
            </button>
          </div>
        </header>

        <section className={styles.content}>
          <div className={styles.listColumn}>
            <div className={styles.filters}>
              <div className={styles.filterHeader}>
                <span>Advanced Filters</span>
                <button className={styles.clearButton}>Clear all filters</button>
              </div>
              <div className={styles.filterGrid}>
                {filters.map((filter) => (
                  <div key={filter.label} className={styles.filterItem}>
                    <span>{filter.label}</span>
                    <button>
                      {filter.value}
                      <FilterIcon style={{ width: '14px', height: '14px', opacity: 0.5 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.evidenceList}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>Loading evidence from Notion...</div>
              ) : evidenceItems.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.evidenceCard} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className={styles.evidenceHeader}>
                    <div className={styles.evidenceTitle}>{item.title}</div>
                    <span className={styles[`status-${item.currencyStatus === 'Current' ? 'success' : 'warning'}`]}>
                      {item.currencyStatus || 'N/A'}
                    </span>
                  </div>
                  <div className={styles.evidenceDesc}>{item.notes || 'No description available.'}</div>
                  <div className={styles.tagRow}>
                    {item.organisation && (
                      <span className={styles.tag}>
                        {item.organisation}
                      </span>
                    )}
                    {item.topicsCovered && item.topicsCovered.map(topic => (
                      <span key={topic} className={styles.tag}>
                        {topic}
                      </span>
                    ))}
                    <span className={styles.meta}>Added: {new Date(item.createdTime).toLocaleDateString()}</span>
                  </div>
                  <div className={styles.reviewRow}>
                    <span>Last updated: {item.lastUpdated || 'N/A'}</span>
                    <span>Published: {item.datePublished || 'N/A'}</span>
                    <button className={styles.viewLink}>
                      View details
                      <ChevronRightIcon style={{ marginLeft: '4px', width: '16px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.detailPanel}>
            {selectedItem ? (
              <>
                <div className={styles.panelHeader}>
                  <h3>Evidence Details</h3>
                  <button className={styles.closeButton} onClick={() => setSelectedItem(null)}>
                    <CloseIcon />
                  </button>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.detailTitle}>{selectedItem.title}</div>
                  <div className={styles.tagRow}>
                    {selectedItem.organisation && (
                      <span className={styles.tag}>
                        {selectedItem.organisation}
                      </span>
                    )}
                    {selectedItem.topicsCovered && selectedItem.topicsCovered.map(topic => (
                      <span key={topic} className={styles.tag}>
                        {topic}
                      </span>
                    ))}
                  </div>
                  <div className={styles.panelSection}>
                    <h4>Source URL</h4>
                    <div className={styles.citationBox}>
                      {selectedItem.url ? (
                        <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          {selectedItem.url}
                        </a>
                      ) : 'No URL provided'}
                    </div>
                    {selectedItem.url && (
                      <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" className={styles.linkButton} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <ExternalLinkIcon style={{ width: '14px', height: '14px' }} />
                        View full source
                      </a>
                    )}
                  </div>
                  <div className={styles.panelSection}>
                    <h4>Relevance Notes</h4>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                      {selectedItem.notes || 'No notes provided for this evidence source.'}
                    </p>
                  </div>
                  <div className={styles.panelSection}>
                    <h4>Evidence Tracking</h4>
                    <div className={styles.agingBar}>
                      <div style={{ width: `75%` }} />
                    </div>
                    <div className={styles.agingMeta}>
                      Last updated: {selectedItem.lastUpdated || 'N/A'} | Published: {selectedItem.datePublished || 'N/A'}
                    </div>
                  </div>
                  <div className={styles.panelActions}>
                    <button className="btn-gradient">
                      <EditIcon style={{ marginRight: '8px' }} />
                      Edit in Notion
                    </button>
                    <button className={styles.dangerButton}>
                      <FlagIcon style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                      Flag as Outdated
                    </button>
                    <button className={styles.outlineButton}>
                      <ArchiveIcon style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                      Archive Evidence
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Select an item to view details
              </div>
            )}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

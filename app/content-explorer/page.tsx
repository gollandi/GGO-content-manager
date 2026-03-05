"use client";

import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";
import { ContentItem } from "../../lib/notion/types";

export default function ContentExplorerPage() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/notion/content");
        const data = await res.json();

        if (Array.isArray(data)) {
          setContentItems(data);
        } else {
          console.error("Notion API returned non-array data:", data);
          setContentItems([]); // Fallback to empty array
        }
      } catch (error) {
        console.error("Error fetching content items:", error);
        setContentItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filters = ["All", "Draft", "Review", "Live", "Update"];

  const filteredItems = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "All" || item.status.includes(activeFilter);
    return matchesSearch && matchesFilter;
  });

  const getStatusTone = (status: string) => {
    if (status.includes("Live")) return "success";
    if (status.includes("Review")) return "info";
    if (status.includes("Update") || status.includes("Draft")) return "warning";
    if (status.includes("Archived")) return "danger";
    return "secondary";
  };

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Content Explorer</h1>
            <p className="page-subtitle">Browse and manage {contentItems.length} content items from Notion</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.iconButtons}>
              <button className={styles.iconButton} aria-label="Notifications">
                <Icons.IconBell className={styles.iconSm} />
                <span className={styles.iconBadge}>3</span>
              </button>
            </div>
            <button className="btn-gradient">
              <Icons.IconPlus className={styles.iconSm} style={{ marginRight: '8px' }} />
              New Content
            </button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Icons.IconSearch className={styles.iconSm} style={{ color: 'var(--text-muted)' }} />
              <input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-pill">
              <Icons.IconFilter className={styles.iconSm} style={{ marginRight: '8px' }} />
              Filters
            </button>
          </div>

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

          <div className={`card ${styles.tableCard}`}>
            <div className={styles.tableHeader}>
              <div>
                <h3 className="card-title">Content Items</h3>
                <p className="card-subtitle">
                  {loading ? 'Loading...' : `Showing ${filteredItems.length} items`}
                </p>
              </div>
              <button className="btn-pill">Export</button>
            </div>
            <div className={styles.tableWrap}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Status</th>
                    <th>Evidence</th>
                    <th>Last Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                        Loading content from Notion...
                      </td>
                    </tr>
                  ) : filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.rowTitle}>{item.title}</div>
                        <div className={styles.rowMeta}>{item.contentType} - {item.platform.join(', ')}</div>
                      </td>
                      <td>
                        <span className={styles[`status-${getStatusTone(item.status)}`]}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.evidenceSourceIds.length} linked items</td>
                      <td className="muted">{new Date(item.lastEditedTime).toLocaleDateString()}</td>
                      <td>
                        <button className={styles.viewButton}>View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredItems.length > 20 && (
              <div className={styles.pagination}>
                <button className="btn-pill">Previous</button>
                <div className={styles.pageNumbers}>
                  <button className={styles.pageActive}>1</button>
                  <button className={styles.pageNumber}>2</button>
                  <button className={styles.pageNumber}>3</button>
                </div>
                <button className="btn-pill">Next</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

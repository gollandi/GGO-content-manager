"use client";

import { useState } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";
import { ContentItem } from "../../lib/notion/types";
import { useNotionData } from "../../lib/hooks/useNotionData";
import SearchBar from "../../components/SearchBar";
import FilterBar from "../../components/FilterBar";
import StatusBadge, { getStatusTone } from "../../components/StatusBadge";
import DataTable from "../../components/DataTable";

export default function ContentExplorerPage() {
  const { data: contentItems, loading, error } = useNotionData<ContentItem>("/api/notion/content");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Draft", "Review", "Live", "Update"];

  const filteredItems = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "All" || item.status.includes(activeFilter);
    return matchesSearch && matchesFilter;
  });


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
            <button className="btn-gradient opacity-50 cursor-not-allowed" disabled title="Coming soon">
              <Icons.IconPlus className={styles.iconSm} style={{ marginRight: '8px' }} />
              New Content
            </button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.toolbar}>
            <SearchBar
              placeholder="Search content..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>

          <FilterBar
            filters={filters}
            active={activeFilter}
            onChange={setActiveFilter}
          />

          <DataTable
            title="Content Items"
            subtitle={loading ? "Loading..." : `Showing ${filteredItems.length} items`}
            columns={[
              { key: "content", label: "Content" },
              { key: "status", label: "Status" },
              { key: "evidence", label: "Evidence" },
              { key: "updated", label: "Last Updated" },
              { key: "actions", label: "" },
            ]}
            loading={loading}
            empty={filteredItems.length === 0}
            emptyMessage="No content items match your filters"
          >
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className={styles.rowTitle}>{item.title}</div>
                  <div className={styles.rowMeta}>{item.contentType} - {item.platform.join(", ")}</div>
                </td>
                <td>
                  <StatusBadge tone={getStatusTone(item.status)} label={item.status} />
                </td>
                <td>{item.evidenceSourceIds.length} linked items</td>
                <td className="muted">{new Date(item.lastEditedTime).toLocaleDateString()}</td>
                <td>
                  <button className={styles.viewButton}>View Details</button>
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      </div>
    </AppShell>
  );
}

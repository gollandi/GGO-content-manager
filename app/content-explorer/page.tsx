import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";
const imgSearch = "https://www.figma.com/api/mcp/asset/d0b94e03-5de8-461f-9203-926143213efd";
const imgFilter = "https://www.figma.com/api/mcp/asset/4dfb9bd3-b0f6-4f00-b8a4-b3845cebc248";

const filters = ["All", "Draft", "Under Review", "Published", "Flagged"];

const rows = [
  {
    title: "Erectile Dysfunction Treatment Guide",
    meta: "Urology - Patient Guide",
    status: "Compliant",
    statusTone: "success",
    evidence: "8 evidence items",
    updated: "2 days ago"
  },
  {
    title: "Male Fertility Preservation Options",
    meta: "Fertility - Patient Guide",
    status: "Needs Changes",
    statusTone: "warning",
    evidence: "6 evidence items",
    updated: "5 days ago"
  },
  {
    title: "Prostate Cancer Screening Guidelines",
    meta: "Urology - Clinical",
    status: "Under Review",
    statusTone: "info",
    evidence: "12 evidence items",
    updated: "1 week ago"
  },
  {
    title: "Vasectomy Patient Information",
    meta: "Andrology - Patient",
    status: "Flagged",
    statusTone: "danger",
    evidence: "4 evidence items",
    updated: "3 weeks ago"
  }
];

export default function ContentExplorerPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Content Explorer</h1>
            <p className="page-subtitle">Browse and manage all content items</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">+ New Content</button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <img src={imgSearch} alt="" />
              <input placeholder="Search content..." />
            </div>
            <button className="btn-pill">
              <img src={imgFilter} alt="" />
              Filters
            </button>
          </div>

          <div className={styles.filterRow}>
            {filters.map((filter, index) => (
              <button
                key={filter}
                className={index === 0 ? styles.filterActive : styles.filterPill}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className={`card ${styles.tableCard}`}>
            <div className={styles.tableHeader}>
              <div>
                <h3 className="card-title">Content Items</h3>
                <p className="card-subtitle">Showing 1-4 of 47 items</p>
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
                  {rows.map((row) => (
                    <tr key={row.title}>
                      <td>
                        <div className={styles.rowTitle}>{row.title}</div>
                        <div className={styles.rowMeta}>{row.meta}</div>
                      </td>
                      <td>
                        <span className={styles[`status-${row.statusTone}`]}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.evidence}</td>
                      <td className="muted">{row.updated}</td>
                      <td>
                        <button className={styles.viewButton}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <button className="btn-pill">Previous</button>
              <div className={styles.pageNumbers}>
                <button className={styles.pageActive}>1</button>
                <button className={styles.pageNumber}>2</button>
                <button className={styles.pageNumber}>3</button>
              </div>
              <button className="btn-pill">Next</button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

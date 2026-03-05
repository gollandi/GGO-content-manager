import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import {
  IconBell,
  IconPlus,
  IconSearch,
  IconFilter,
  IconChevronRight,
  IconExternalLink
} from "../../components/Icons";

const stats = [
  { label: "Completed Reviews", value: "142" },
  { label: "Due This Quarter", value: "38" },
  { label: "Overdue", value: "12" },
  { label: "Annual Progress", value: "68%" }
];

const rows = [
  {
    title: "Erectile Dysfunction Treatment Guide",
    meta: "Urology - Patient Guide",
    lastReview: "15 Jan 2024",
    reviewer: "Dr. James Wilson",
    outcome: "Approved",
    action: "Update Evidence",
    nextReview: "15 Jan 2025"
  },
  {
    title: "Male Fertility Assessment Protocol",
    meta: "Andrology - Clinical Protocol",
    lastReview: "08 Feb 2024",
    reviewer: "Dr. Sarah Chen",
    outcome: "Needs Changes",
    action: "Revise Content",
    nextReview: "08 Feb 2025"
  },
  {
    title: "Vasectomy Patient Information",
    meta: "Surgery - Patient Guide",
    lastReview: "10 Apr 2024",
    reviewer: "Dr. Michael Brown",
    outcome: "Overdue",
    action: "Urgent Review",
    nextReview: "28 Nov 2024"
  }
];

const getOutcomeClass = (outcome: string) => {
  switch (outcome) {
    case 'Approved': return styles['outcome-approved'];
    case 'Needs Changes': return styles['outcome-needs-changes'];
    case 'Overdue': return styles['outcome-overdue'];
    default: return styles.outcome;
  }
};

export default function AnnualReviewPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Annual Review Log</h1>
            <p className="page-subtitle">Track and manage yearly content reviews</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">
              <IconPlus style={{ marginRight: '8px' }} />
              Generate Review Pack
            </button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.heatmapCard}>
            <div className={styles.heatmapHeader}>
              <div>
                <h3 className="card-title">Review Load Distribution</h3>
                <p className="card-subtitle">Yearly review activity heatmap</p>
              </div>
              <div className={styles.yearToggle}>
                <button className={styles.yearActive}>2024</button>
                <button>2023</button>
              </div>
            </div>
            <div className={styles.heatmap} />
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div>
                <h3 className="card-title">Past Reviews & Actions</h3>
                <p className="card-subtitle">Complete review history and required actions</p>
              </div>
              <div className={styles.tableActions}>
                <button className="btn-pill">
                  <IconSearch style={{ width: '14px', marginRight: '6px' }} />
                  Search reviews...
                </button>
                <button className="btn-pill">
                  <IconFilter style={{ width: '14px', marginRight: '6px' }} />
                  Filter
                </button>
                <button className="btn-pill">
                  <IconExternalLink style={{ width: '14px', marginRight: '6px' }} />
                  Export
                </button>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Content Item</th>
                    <th>Last Review</th>
                    <th>Reviewer</th>
                    <th>Outcome</th>
                    <th>Required Actions</th>
                    <th>Next Review</th>
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
                      <td>{row.lastReview}</td>
                      <td>{row.reviewer}</td>
                      <td>
                        <span className={getOutcomeClass(row.outcome)}>{row.outcome}</span>
                      </td>
                      <td>
                        <span className={styles.action}>{row.action}</span>
                      </td>
                      <td>{row.nextReview}</td>
                      <td>
                        <button className="icon-btn">
                          <IconChevronRight />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <span>Showing 1-6 of 192 reviews</span>
              <div className={styles.pageNumbers}>
                <button className="btn-pill">Previous</button>
                <button className={styles.pageActive}>1</button>
                <button className={styles.pageNumber}>2</button>
                <button className={styles.pageNumber}>3</button>
                <button className="btn-pill">Next</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

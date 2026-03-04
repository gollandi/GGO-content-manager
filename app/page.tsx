import AppShell from "../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";

const stats = [
  { label: "Total Content", value: "228", meta: "Active items", accent: "blue" },
  { label: "Avg Compliance", value: "84%", meta: "+3.2% vs last month", accent: "green" },
  { label: "Pending Reviews", value: "47", meta: "Due this week", accent: "orange" },
  { label: "Evidence Items", value: "265", meta: "Updated today", accent: "purple" }
];

const activity = [
  {
    title: "Evidence updated",
    detail: "EAU Guidelines on Male Sexual and Reproductive Health",
    time: "2 hours ago"
  },
  {
    title: "Validation passed",
    detail: "Erectile Dysfunction Treatment Guide",
    time: "Yesterday"
  },
  {
    title: "Review overdue",
    detail: "Vasectomy Patient Information",
    time: "3 days ago"
  }
];

const categories = [
  { label: "Urology", percent: 92 },
  { label: "Fertility", percent: 86 },
  { label: "Oncology", percent: 74 },
  { label: "Andrology", percent: 88 }
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Content Compliance Dashboard</h1>
            <p className="page-subtitle">
              Monitor and manage content accuracy across all medical guidelines
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">+ New Review</button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={`${styles.statCard} ${styles[stat.accent]}`}>
                <div className={styles.statHeader}>
                  <div className={styles.statIcon} />
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statMeta}>{stat.meta}</div>
              </div>
            ))}
          </div>

          <div className={styles.mainGrid}>
            <div className={styles.leftColumn}>
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Compliance Overview</h3>
                    <p className="card-subtitle">Last 30 days</p>
                  </div>
                  <button className="btn-pill">This Month</button>
                </div>
                <div className={styles.chartPlaceholder} />
              </div>

              <div className={`card ${styles.activityCard}`}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Recent Activity</h3>
                    <p className="card-subtitle">Latest system events</p>
                  </div>
                  <button className="btn-soft">View All</button>
                </div>
                <div className={styles.activityList}>
                  {activity.map((item) => (
                    <div key={item.title} className={styles.activityItem}>
                      <div className={styles.activityDot} />
                      <div className={styles.activityContent}>
                        <div className={styles.activityTitle}>{item.title}</div>
                        <div className={styles.activityDetail}>{item.detail}</div>
                      </div>
                      <div className={styles.activityTime}>{item.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.rightColumn}>
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Compliance by Category</h3>
                    <p className="card-subtitle">Principle coverage</p>
                  </div>
                </div>
                <div className={styles.categoryList}>
                  {categories.map((item) => (
                    <div key={item.label} className={styles.categoryRow}>
                      <div className={styles.categoryLabel}>{item.label}</div>
                      <div className={styles.categoryBar}>
                        <div
                          className={styles.categoryFill}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <div className={styles.categoryValue}>{item.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`card ${styles.riskCard}`}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Risk Alerts</h3>
                    <p className="card-subtitle">Items needing attention</p>
                  </div>
                </div>
                <ul className={styles.riskList}>
                  <li>
                    <span className="badge badge-danger">Critical</span>
                    Outdated fertility success rates
                  </li>
                  <li>
                    <span className="badge badge-warning">Medium</span>
                    Missing citations in oncology content
                  </li>
                  <li>
                    <span className="badge badge-info">Review</span>
                    Evidence aging for prostate guidelines
                  </li>
                </ul>
                <button className={styles.linkButton}>View risk dashboard</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

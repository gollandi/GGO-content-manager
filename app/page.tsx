import AppShell from "../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../components/Icons";

export default function DashboardPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">Operational Dashboard</h1>
          <p className="page-subtitle">PIF Tick Compliance & Content Governance Overview</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn-pill">
            <Icons.IconSync className={styles.btnIcon} />
            Fetch Updates
          </button>
          <button className="btn-gradient">View Reports</button>

          <div className={styles.iconButtons}>
            <button className={styles.iconButton}>
              <Icons.IconBell className={styles.iconSm} />
              <span className={styles.badge}>3</span>
            </button>
          </div>
        </div>
      </header>

      <div className="page-section">
        {/* Statistics Grid */}
        <div className={styles.statsGrid}>
          <div className="card">
            <div className={styles.statHeader}>
              <div className={`${styles.statIcon} ${styles.blue}`}>
                <Icons.IconValidation className={styles.iconSm} />
              </div>
              <span className="pill pill-green">+12%</span>
            </div>
            <div className={styles.statValue}>1,284</div>
            <div className="card-subtitle">Active Content Items</div>
          </div>

          <div className="card">
            <div className={styles.statHeader}>
              <div className={`${styles.statIcon} ${styles.purple}`}>
                <Icons.IconEvidence className={styles.iconSm} />
              </div>
              <span className="pill pill-blue">+3%</span>
            </div>
            <div className={styles.statValue}>94.2%</div>
            <div className="card-subtitle">Compliance Score</div>
          </div>

          <div className="card">
            <div className={styles.statHeader}>
              <div className={`${styles.statIcon} ${styles.teal}`}>
                <Icons.IconRequests className={styles.iconSm} />
              </div>
              <span className="pill pill-yellow">8 Pending</span>
            </div>
            <div className={styles.statValue}>42</div>
            <div className="card-subtitle">Validation Requests</div>
          </div>

          <div className="card">
            <div className={styles.statHeader}>
              <div className={`${styles.statIcon} ${styles.red}`}>
                <Icons.IconBell className={styles.iconSm} />
              </div>
              <span className="pill pill-red">Critical</span>
            </div>
            <div className={styles.statValue}>12</div>
            <div className="card-subtitle">Risk Alerts</div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* Left Column: Compliance Chart */}
          <div className={`${styles.chartColumn} card`}>
            <div className={styles.cardHeader}>
              <h2 className="card-title">Compliance Overview</h2>
              <select className={styles.chartSelect}>
                <option>Last 30 Days</option>
                <option>Last 3 Months</option>
              </select>
            </div>
            <div className={styles.chartPlaceholder}>
              {/* This would be a real chart component in production */}
              <div className={styles.mockChart}>
                <div className={styles.bar} style={{ height: "60%" }}></div>
                <div className={styles.bar} style={{ height: "80%" }}></div>
                <div className={styles.bar} style={{ height: "45%" }}></div>
                <div className={styles.bar} style={{ height: "90%" }}></div>
                <div className={styles.bar} style={{ height: "70%" }}></div>
                <div className={styles.bar} style={{ height: "85%" }}></div>
                <div className={styles.bar} style={{ height: "100%" }}></div>
              </div>
            </div>
          </div>

          {/* Right Column: Recent Activity & Risk */}
          <div className={styles.activityColumn}>
            <div className="card">
              <h2 className="card-title">Recent Activity</h2>
              <div className={styles.activityList}>
                {[
                  { user: "Sarah M.", action: "validated content", target: "Prostate Surgery", time: "2m ago" },
                  { user: "James K.", action: "added evidence", target: "PSA Testing", time: "15m ago" },
                  { user: "System", action: "flagged discrepancy", target: "MRI Guidelines", time: "1h ago" }
                ].map((item, i) => (
                  <div key={i} className={styles.activityItem}>
                    <div className={styles.activityAvatar}>
                      {item.user.charAt(0)}
                    </div>
                    <div className={styles.activityText}>
                      <strong>{item.user}</strong> {item.action} <span>{item.target}</span>
                      <div className={styles.activityTime}>{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: "24px" }}>
              <h2 className="card-title">Compliance by Category</h2>
              <div className={styles.categoryList}>
                {[
                  { name: "Clinical Accuracy", score: 98, color: "var(--accent-blue)" },
                  { name: "Source Credibility", score: 85, color: "var(--accent-purple)" },
                  { name: "Content Freshness", score: 72, color: "var(--accent-green)" }
                ].map((cat, i) => (
                  <div key={i} className={styles.categoryItem}>
                    <div className={styles.categoryMeta}>
                      <span>{cat.name}</span>
                      <span>{cat.score}%</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${cat.score}%`, backgroundColor: cat.color }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell >
  );
}

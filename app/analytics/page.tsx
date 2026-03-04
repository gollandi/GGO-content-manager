import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";

const summaryCards = [
  { label: "Total Content", value: "228", accent: "blue" },
  { label: "Avg Compliance", value: "84%", accent: "green" },
  { label: "Pending Reviews", value: "47", accent: "orange" },
  { label: "Evidence Items", value: "265", accent: "purple" }
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

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Analytics & Insights</h1>
            <p className="page-subtitle">Comprehensive performance metrics and trends</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-pill">Last 30 Days</button>
            <button className="btn-pill">Export Report</button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.chartGrid}>
            <div className={styles.chartCard}>
              <h3 className="card-title">Validation Coverage</h3>
              <div className={styles.donut} />
              <div className={styles.coverageList}>
                <div><span className={styles.dotGreen}></span> Compliant Content <strong>156</strong></div>
                <div><span className={styles.dotYellow}></span> Partial Compliance <strong>52</strong></div>
                <div><span className={styles.dotRed}></span> Failed Validation <strong>20</strong></div>
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
                <div><span className={styles.badgeGreen}></span> Fresh (0-1 year) <strong>142</strong></div>
                <div><span className={styles.badgeYellow}></span> Moderate (1-3 years) <strong>89</strong></div>
                <div><span className={styles.badgeRed}></span> Aging (3+ years) <strong>34</strong></div>
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

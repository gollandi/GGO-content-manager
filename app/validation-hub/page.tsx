import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";

const tabs = [
  { label: "Pass (28)", tone: "success" },
  { label: "Fail (12)", tone: "danger" },
  { label: "Needs Changes (7)", tone: "warning" }
];

const validations = [
  {
    title: "Erectile Dysfunction Treatment Guide",
    status: "Compliant",
    statusTone: "success",
    updated: "Last validated: 2 days ago",
    topic: "Urology",
    type: "Patient-facing",
    evidence: "8 evidence items",
    risk: "Low risk",
    metrics: [
      { label: "Accuracy", value: "100%" },
      { label: "Evidence", value: "100%" },
      { label: "Balance", value: "100%" },
      { label: "Clarity", value: "100%" },
      { label: "Transparency", value: "100%" },
      { label: "Accessibility", value: "100%" },
      { label: "Relevance", value: "100%" }
    ],
    action: "View Details"
  },
  {
    title: "Male Fertility Preservation Options",
    status: "Failed",
    statusTone: "danger",
    updated: "Last validated: 5 days ago",
    topic: "Fertility",
    type: "Patient-facing",
    evidence: "3 evidence items",
    risk: "High risk",
    metrics: [
      { label: "Accuracy", value: "45%" },
      { label: "Evidence", value: "30%" },
      { label: "Balance", value: "68%" },
      { label: "Clarity", value: "92%" },
      { label: "Transparency", value: "55%" },
      { label: "Accessibility", value: "88%" },
      { label: "Relevance", value: "72%" }
    ],
    action: "View Issues"
  },
  {
    title: "Prostate Cancer Screening Guidelines",
    status: "Needs Changes",
    statusTone: "warning",
    updated: "Last validated: 1 week ago",
    topic: "Urology",
    type: "Clinical",
    evidence: "12 evidence items",
    risk: "Medium risk",
    metrics: [
      { label: "Accuracy", value: "95%" },
      { label: "Evidence", value: "75%" },
      { label: "Balance", value: "90%" },
      { label: "Clarity", value: "88%" },
      { label: "Transparency", value: "70%" },
      { label: "Accessibility", value: "92%" },
      { label: "Relevance", value: "85%" }
    ],
    action: "Review Changes"
  }
];

const issues = [
  {
    title: "Accuracy",
    severity: "Critical",
    description:
      "Success rates stated are outdated and not supported by current evidence. Claims need updating with 2023 guidelines.",
    tone: "danger"
  },
  {
    title: "Evidence Base",
    severity: "Critical",
    description: "Missing citations for key recommendations. Only 3 of 8 evidence sources linked.",
    tone: "danger"
  },
  {
    title: "Balance",
    severity: "Medium",
    description: "Content lacks discussion of limitations and potential risks.",
    tone: "warning"
  },
  {
    title: "Transparency",
    severity: "High",
    description: "No disclosure of cost ranges or insurance coverage information.",
    tone: "danger"
  }
];

const actions = [
  "Update success rate statistics with 2023 ASRM guidelines",
  "Add 5 missing evidence citations (RCTs preferred)",
  "Include section on risks, limitations and failure rates",
  "Add cost information and insurance coverage details"
];

const history = [
  { title: "Failed validation", detail: "4 critical issues identified", time: "5 days ago" },
  { title: "Partial pass", detail: "2 issues requiring attention", time: "2 weeks ago" },
  { title: "Passed validation", detail: "All principles met", time: "1 month ago" }
];

export default function ValidationHubPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Validation Hub</h1>
            <p className="page-subtitle">PIF Tick principle-by-principle evaluation</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.iconButtons}>
              <button className={styles.iconButton} aria-label="Notifications">
                <Icons.IconBell className={styles.iconSm} />
                <span className={styles.iconBadge}>3</span>
              </button>
            </div>
            <button className="btn-gradient">
              <Icons.IconSync className={styles.iconSm} style={{ marginRight: '8px' }} />
              Run Validation
            </button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Icons.IconSearch className={styles.iconSm} style={{ color: 'var(--text-muted)' }} />
              <input placeholder="Search content..." />
            </div>
            <button className="btn-pill">
              <Icons.IconFilter className={styles.iconSm} style={{ marginRight: '8px' }} />
              Filters
            </button>
            <div className={styles.toolbarMeta}>Showing 47 validations</div>
          </div>

          <div className={styles.tabRow}>
            {tabs.map((tab, index) => (
              <button
                key={tab.label}
                className={index === 0 ? styles.tabActive : styles.tabButton}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.grid}>
            <div className={styles.list}>
              {validations.map((item) => (
                <div key={item.title} className={styles.validationCard}>
                  <div className={styles.validationHeader}>
                    <div>
                      <div className={styles.validationTitle}>{item.title}</div>
                      <div className={styles.validationMeta}>
                        <span className={`pill pill-${item.statusTone}`}>
                          {item.status}
                        </span>
                        <span>{item.updated}</span>
                        <span>• {item.topic}</span>
                        <span>• {item.type}</span>
                      </div>
                      <div className={styles.validationMeta}>
                        <span>{item.evidence}</span>
                        <span>• {item.risk}</span>
                      </div>
                    </div>
                    <button className={styles.detailButton}>{item.action}</button>
                  </div>
                  <div className={styles.metricRow}>
                    {item.metrics.map((metric) => (
                      <div key={metric.label} className={styles.metricPill}>
                        <div className={styles.metricValue}>{metric.value}</div>
                        <div className={styles.metricLabel}>{metric.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <aside className={styles.panel}>
              <div className={styles.panelSection}>
                <h4>Content Excerpt</h4>
                <div className={styles.excerptBox}>
                  <p>
                    Male fertility preservation involves various techniques to store
                    sperm or testicular tissue for future use. This is particularly
                    important for men facing cancer treatment or other procedures that
                    may affect fertility.
                  </p>
                  <p className={styles.excerptTitle}>Common methods include:</p>
                  <ul>
                    <li>Sperm banking</li>
                    <li>Testicular tissue freezing</li>
                    <li>Sperm extraction procedures</li>
                  </ul>
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4>Validation Issues (4)</h4>
                <div className={styles.issueList}>
                  {issues.map((issue) => (
                    <div
                      key={issue.title}
                      className={`${styles.issueCard} ${styles[issue.tone]}`}
                    >
                      <div className={styles.issueHeader}>
                        <div className={styles.issueTitle}>{issue.title}</div>
                        <span className={styles.issueSeverity}>{issue.severity}</span>
                      </div>
                      <p>{issue.description}</p>
                      <button className={styles.issueLink}>View required action</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4>Required Actions</h4>
                <div className={styles.actionList}>
                  {actions.map((action) => (
                    <label key={action} className={styles.actionItem}>
                      <input type="checkbox" style={{ marginTop: '2px' }} />
                      <span>{action}</span>
                    </label>
                  ))}
                </div>
                <div className={styles.panelButtons}>
                  <button className="btn-gradient">Apply Changes</button>
                  <button className={styles.iconGhost}>Review Full Guide</button>
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4>Validation History</h4>
                <div className={styles.historyList}>
                  {history.map((item) => (
                    <div key={item.title} className={styles.historyItem}>
                      <div>
                        <div className={styles.historyTitle}>{item.title}</div>
                        <div className={styles.historyDetail}>{item.detail}</div>
                      </div>
                      <div className={styles.historyTime}>{item.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

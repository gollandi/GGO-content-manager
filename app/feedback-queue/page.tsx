import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";
const imgSearch = "https://www.figma.com/api/mcp/asset/d0b94e03-5de8-461f-9203-926143213efd";

const filters = ["All (21)", "Critical (3)", "High (5)", "Medium (8)", "Low (5)"];

const feedbackItems = [
  {
    title: "Outdated fertility success rates cited",
    meta: "Dr. James Patterson (Clinician)",
    tags: ["Fertility Treatment Guide"],
    tone: "danger",
    status: "Critical",
    time: "2 hours ago"
  },
  {
    title: "Medical terminology too complex",
    meta: "Patient Advisory Group",
    tags: ["Prostate Screening Guide"],
    tone: "warning",
    status: "High",
    time: "6 hours ago"
  },
  {
    title: "Missing contraindication information",
    meta: "Dr. Emily Chen (Internal)",
    tags: ["ED Treatment Options"],
    tone: "danger",
    status: "Critical",
    time: "1 day ago"
  }
];

const requiredActions = [
  "Update statistics with 2023 HFEA data",
  "Update evidence repository",
  "Trigger revalidation review"
];

export default function FeedbackQueuePage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Stakeholder Feedback Queue</h1>
            <p className="page-subtitle">
              Review and action feedback from patients, clinicians, and internal teams
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">+ Log Feedback</button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <img src={imgSearch} alt="" />
              <input placeholder="Search feedback..." />
            </div>
            <button className="btn-pill">Filters</button>
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

          <div className={styles.grid}>
            <div className={styles.list}>
              {feedbackItems.map((item) => (
                <div key={item.title} className={styles.itemCard}>
                  <div className={styles.itemHeader}>
                    <div>
                      <div className={styles.itemTitle}>{item.title}</div>
                      <div className={styles.itemMeta}>{item.meta}</div>
                    </div>
                    <span className={styles[`status-${item.tone}`]}>{item.status}</span>
                  </div>
                  <div className={styles.tagRow}>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                    <span className={styles.time}>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <aside className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Outdated fertility success rates cited</h3>
                <span className={styles.panelStatus}>Critical</span>
              </div>
              <div className={styles.panelSection}>
                <h4>Feedback Source</h4>
                <p>Dr. James Patterson - Fertility Consultant</p>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>Clinician</span>
                  <span className={styles.tag}>External</span>
                </div>
              </div>
              <div className={styles.panelSection}>
                <h4>Feedback Summary</h4>
                <p>
                  The IVF success rates mentioned in the fertility guide are from 2019.
                  Updated HFEA data from 2023 shows significantly different outcomes for
                  women over 40.
                </p>
              </div>
              <div className={styles.panelSection}>
                <h4>Impact Assessment</h4>
                <div className={styles.impactList}>
                  <span className={styles.impactChip}>Severity Level: Critical</span>
                  <span className={styles.impactChip}>Patient Safety Impact</span>
                  <span className={styles.impactChip}>Revalidation Required</span>
                </div>
              </div>
              <div className={styles.panelSection}>
                <h4>Linked Content</h4>
                <div className={styles.linkedCard}>
                  <div>
                    <div className={styles.linkedTitle}>Fertility Treatment Guide</div>
                    <div className={styles.linkedMeta}>Published - Last updated Jan 2023</div>
                  </div>
                  <button className={styles.viewLink}>View</button>
                </div>
              </div>
              <div className={styles.panelSection}>
                <h4>Required Actions</h4>
                <ul className={styles.actionList}>
                  {requiredActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.panelButtons}>
                <button className="btn-gradient">Mark as Resolved</button>
                <button className="btn-pill">Add Note</button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

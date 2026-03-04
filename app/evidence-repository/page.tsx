import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";

const filters = [
  { label: "Evidence Type", value: "All Types" },
  { label: "Topic Area", value: "All Topics" },
  { label: "Evidence Age", value: "All Ages" },
  { label: "Status", value: "All Status" }
];

const evidenceItems = [
  {
    title: "EAU Guidelines on Male Sexual and Reproductive Health 2023",
    description:
      "Comprehensive clinical practice guidelines covering erectile dysfunction, ejaculatory disorders, and Peyronie's disease management.",
    tags: ["Guidelines", "Current"],
    meta: "Published: Jan 2023",
    status: "Active",
    statusTone: "success",
    linked: "15 linked items",
    review: "Last reviewed: 2 months ago",
    next: "Next review: Oct 2024"
  },
  {
    title: "Efficacy of PDE5 Inhibitors: Systematic Review and Meta-analysis",
    description:
      "Meta-analysis of 82 RCTs examining comparative effectiveness of sildenafil, tadalafil, and vardenafil in ED treatment.",
    tags: ["Meta-analysis", "Aging"],
    meta: "Published: Mar 2019",
    status: "Under Review",
    statusTone: "warning",
    linked: "8 linked items",
    review: "Last reviewed: 8 months ago",
    next: "Next review: Due now"
  },
  {
    title: "Testosterone Replacement Therapy in Hypogonadal Men: RCT Results",
    description:
      "Randomized controlled trial evaluating safety and efficacy of TRT in 400 men with hypogonadism.",
    tags: ["RCT", "Current"],
    meta: "Published: Aug 2022",
    status: "Active",
    statusTone: "success",
    linked: "12 linked items",
    review: "Last reviewed: 1 month ago",
    next: "Next review: Jan 2025"
  },
  {
    title: "Surgical Management of Varicocele: Clinical Guidelines 2015",
    description:
      "Clinical practice guidelines for varicocele diagnosis and surgical intervention strategies in male infertility cases.",
    tags: ["Guidelines", "Outdated"],
    meta: "Published: Jun 2015",
    status: "Flagged",
    statusTone: "danger",
    linked: "4 linked items",
    review: "Last reviewed: 18 months ago",
    next: "Review overdue"
  }
];

const details = {
  title: "EAU Guidelines on Male Sexual and Reproductive Health 2023",
  tags: ["Guidelines", "Current"],
  citation:
    "Salonia A, Bettocchi C, Boeri L, et al. European Association of Urology Guidelines on Sexual and Reproductive Health - 2023 Update: Male Sexual Dysfunction. Eur Urol. 2023;84(1):80-101.",
  notes:
    "Provides comprehensive, evidence-based recommendations for diagnosis and management of erectile dysfunction, ejaculatory disorders, and Peyronie's disease. Directly supports clinical content accuracy and treatment pathway guidance.",
  aging: 85,
  agingMeta: "Published 20 months ago - Expected lifespan: 5 years",
  linked: ["ED Treatment Guidelines", "PDE5 Inhibitor Overview", "Peyronie's Disease Guide"],
  history: [
    "Last reviewed: August 15, 2024 by Dr. James Wilson",
    "Next review due: October 2024"
  ]
};

export default function EvidenceRepositoryPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Evidence Repository</h1>
            <p className="page-subtitle">Manage and track all evidence sources</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">+ Add Evidence</button>
          </div>
        </header>

        <section className={styles.content}>
          <div className={styles.listColumn}>
            <div className={styles.filters}>
              <div className={styles.filterHeader}>
                <span>Filters</span>
                <button className={styles.clearButton}>Clear all</button>
              </div>
              <div className={styles.filterGrid}>
                {filters.map((filter) => (
                  <div key={filter.label} className={styles.filterItem}>
                    <span>{filter.label}</span>
                    <button>{filter.value}</button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.evidenceList}>
              {evidenceItems.map((item) => (
                <div key={item.title} className={styles.evidenceCard}>
                  <div className={styles.evidenceHeader}>
                    <div className={styles.evidenceTitle}>{item.title}</div>
                    <span className={styles[`status-${item.statusTone}`]}>
                      {item.status}
                    </span>
                  </div>
                  <div className={styles.evidenceDesc}>{item.description}</div>
                  <div className={styles.tagRow}>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                    <span className={styles.meta}>{item.meta}</span>
                    <span className={styles.meta}>{item.linked}</span>
                  </div>
                  <div className={styles.reviewRow}>
                    <span>{item.review}</span>
                    <span>{item.next}</span>
                    <button className={styles.viewLink}>View details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.detailPanel}>
            <div className={styles.panelHeader}>
              <h3>Evidence Details</h3>
              <button className={styles.closeButton}>X</button>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.detailTitle}>{details.title}</div>
              <div className={styles.tagRow}>
                {details.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className={styles.panelSection}>
                <h4>Citation</h4>
                <div className={styles.citationBox}>{details.citation}</div>
                <button className={styles.linkButton}>View full source</button>
              </div>
              <div className={styles.panelSection}>
                <h4>Relevance Notes</h4>
                <p>{details.notes}</p>
              </div>
              <div className={styles.panelSection}>
                <h4>Evidence Aging Indicator</h4>
                <div className={styles.agingBar}>
                  <div style={{ width: `${details.aging}%` }} />
                </div>
                <div className={styles.agingMeta}>{details.agingMeta}</div>
              </div>
              <div className={styles.panelSection}>
                <h4>Linked Content</h4>
                <div className={styles.linkedList}>
                  {details.linked.map((item) => (
                    <div key={item} className={styles.linkedItem}>
                      {item}
                      <span>&gt;</span>
                    </div>
                  ))}
                </div>
                <button className={styles.linkButton}>View all 15 linked items</button>
              </div>
              <div className={styles.panelSection}>
                <h4>Review History</h4>
                <ul className={styles.historyList}>
                  {details.history.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.panelActions}>
                <button className="btn-gradient">Edit Evidence</button>
                <button className={styles.dangerButton}>Flag as Outdated</button>
                <button className={styles.outlineButton}>Archive Evidence</button>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

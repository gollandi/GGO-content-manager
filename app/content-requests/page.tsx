import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";

const columns = [
  {
    title: "Requested",
    count: 8,
    color: "blue",
    items: [
      {
        priority: "High Priority",
        title: "Vasectomy Reversal Guide",
        desc: "New patient information on reversal procedures and success rates",
        tags: ["Urology", "Patient"],
        progress: null,
        meta: "Dr. James Wilson - 2 days ago"
      },
      {
        priority: "Medium Priority",
        title: "IVF Success Factors",
        desc: "Content explaining factors affecting IVF outcomes",
        tags: ["Fertility", "Web"],
        progress: null,
        meta: "Sarah Mitchell - 3 days ago"
      }
    ]
  },
  {
    title: "Scoping",
    count: 5,
    color: "purple",
    items: [
      {
        priority: "High Priority",
        title: "Prostate Cancer Screening",
        desc: "Updated guidelines on PSA testing and screening protocols",
        tags: ["Urology", "Print"],
        progress: "60%",
        meta: "Dr. Emily Chen - 5 days ago"
      },
      {
        priority: "Medium Priority",
        title: "Male Infertility Testing",
        desc: "Comprehensive guide on diagnostic procedures",
        tags: ["Fertility", "Web"],
        progress: "35%",
        meta: "Sarah Mitchell - 1 week ago"
      }
    ]
  },
  {
    title: "Drafting",
    count: 6,
    color: "orange",
    items: [
      {
        priority: "High Priority",
        title: "ED Treatment Options",
        desc: "Comprehensive overview of medical and surgical treatments",
        tags: ["Andrology", "Patient"],
        progress: "75%",
        meta: "Mark Thompson - 1 week ago"
      },
      {
        priority: "Low Priority",
        title: "Kidney Stone Prevention",
        desc: "Dietary and lifestyle recommendations",
        tags: ["Urology", "Video"],
        progress: "45%",
        meta: "Lisa Anderson - 2 weeks ago"
      }
    ]
  },
  {
    title: "In Review",
    count: 4,
    color: "yellow",
    items: [
      {
        priority: "Medium Priority",
        title: "Testosterone Therapy Risks",
        desc: "Benefits and contraindications of TRT",
        tags: ["Andrology", "Web"],
        progress: null,
        meta: "Dr. Michael Brown - 2 days ago"
      }
    ]
  }
];

export default function ContentRequestsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Content Request Pipeline</h1>
            <p className="page-subtitle">
              Track and manage content requests through workflow stages
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-pill">All Priorities</button>
            <button className="btn-gradient">+ New Request</button>
          </div>
        </header>

        <section className={styles.board}>
          {columns.map((column) => (
            <div key={column.title} className={`${styles.column} ${styles[column.color]}`}>
              <div className={styles.columnHeader}>
                <span>{column.title}</span>
                <span className={styles.count}>{column.count}</span>
              </div>
              {column.items.map((item) => (
                <div key={item.title} className={styles.card}>
                  <span className={styles.priority}>{item.priority}</span>
                  <div className={styles.cardTitle}>{item.title}</div>
                  <div className={styles.cardDesc}>{item.desc}</div>
                  <div className={styles.tagRow}>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {item.progress && (
                    <div className={styles.progressRow}>
                      <span>Draft progress</span>
                      <span>{item.progress}</span>
                      <div className={styles.progressBar}>
                        <div style={{ width: item.progress }} />
                      </div>
                    </div>
                  )}
                  <div className={styles.meta}>{item.meta}</div>
                </div>
              ))}
              <button className={styles.addCard}>+ Add Card</button>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

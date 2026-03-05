import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import {
  IconBell,
  IconPlus,
  IconFilter,
  IconChevronRight
} from "../../components/Icons";

const columns = [
  {
    title: "Requested",
    count: 8,
    color: "blue",
    items: [
      {
        priority: "High",
        title: "Vasectomy Reversal Guide",
        desc: "New patient information on reversal procedures and success rates",
        tags: ["Urology", "Patient"],
        progress: null,
        meta: "Dr. James Wilson - 2 days ago"
      },
      {
        priority: "Medium",
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
        priority: "High",
        title: "Prostate Cancer Screening",
        desc: "Updated guidelines on PSA testing and screening protocols",
        tags: ["Urology", "Print"],
        progress: "60%",
        meta: "Dr. Emily Chen - 5 days ago"
      },
      {
        priority: "Medium",
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
        priority: "High",
        title: "ED Treatment Options",
        desc: "Comprehensive overview of medical and surgical treatments",
        tags: ["Andrology", "Patient"],
        progress: "75%",
        meta: "Mark Thompson - 1 week ago"
      },
      {
        priority: "Low",
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
        priority: "Medium",
        title: "Testosterone Therapy Risks",
        desc: "Benefits and contraindications of TRT",
        tags: ["Andrology", "Web"],
        progress: null,
        meta: "Dr. Michael Brown - 2 days ago"
      }
    ]
  }
];

const getPriorityClass = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high': return styles.priorityHigh;
    case 'medium': return styles.priorityMedium;
    case 'low': return styles.priorityLow;
    default: return '';
  }
};

export default function ContentRequestsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Content Request Pipeline</h1>
            <p className="page-subtitle">
              Effectively track and manage content workflow stages
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-pill">
              <IconFilter style={{ marginRight: '8px', width: '14px' }} />
              All Priorities
            </button>
            <button className="btn-gradient">
              <IconPlus style={{ marginRight: '8px' }} />
              New Request
            </button>
          </div>
        </header>

        <section className={styles.board}>
          {columns.map((column) => (
            <div key={column.title} className={styles.column}>
              <div className={styles.columnHeader}>
                <span>{column.title}</span>
                <span className={styles.count}>{column.count}</span>
              </div>
              {column.items.map((item) => (
                <div key={item.title} className={styles.card}>
                  <span className={`${styles.priority} ${getPriorityClass(item.priority)}`}>
                    {item.priority} Priority
                  </span>
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
                      <div className={styles.progressInfo}>
                        <span>Draft progress</span>
                        <span>{item.progress}</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div style={{ width: item.progress }} />
                      </div>
                    </div>
                  )}
                  <div className={styles.meta}>{item.meta}</div>
                </div>
              ))}
              <button className={styles.addCard}>
                <IconPlus style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Add Card
              </button>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

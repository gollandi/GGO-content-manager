import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";

const steps = [
  { title: "1. Submit content", desc: "Provide URL, text, or upload files" },
  { title: "2. Validate", desc: "Gemini AI checks against PIF Tick principles" },
  { title: "3. Review", desc: "Get recommendations and required actions" }
];

export default function AssistantPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Gemini AI Compliance Assistant</h1>
            <p className="page-subtitle">Automated content checks and recommendations</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">New Review</button>
          </div>
        </header>

        <section className="page-section">
          <div className={styles.stepRow}>
            {steps.map((step) => (
              <div key={step.title} className={styles.stepCard}>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepDesc}>{step.desc}</div>
              </div>
            ))}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formCard}>
              <h3>URL Input</h3>
              <p>Paste a content URL to validate</p>
              <input placeholder="https://..." />
            </div>
            <div className={styles.formCard}>
              <h3>Text Snippet</h3>
              <p>Provide a text excerpt for quick analysis</p>
              <textarea placeholder="Paste text here..." rows={6} />
            </div>
            <div className={styles.formCard}>
              <h3>Upload Files</h3>
              <p>Drag and drop PDFs, docs, or images</p>
              <div className={styles.uploadBox}>Drop files here</div>
            </div>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <h4>Metadata</h4>
              <div className={styles.metaRow}>
                <label>Topic Area</label>
                <button>Urology</button>
              </div>
              <div className={styles.metaRow}>
                <label>Audience</label>
                <button>Patient-facing</button>
              </div>
              <div className={styles.metaRow}>
                <label>Content Type</label>
                <button>Guidelines</button>
              </div>
            </div>
            <div className={styles.metaCard}>
              <h4>Validation Scope</h4>
              <div className={styles.scopeList}>
                <label><input type="checkbox" defaultChecked /> Accuracy</label>
                <label><input type="checkbox" defaultChecked /> Evidence Base</label>
                <label><input type="checkbox" defaultChecked /> Balance</label>
                <label><input type="checkbox" defaultChecked /> Transparency</label>
                <label><input type="checkbox" defaultChecked /> Accessibility</label>
                <label><input type="checkbox" defaultChecked /> Relevance</label>
              </div>
            </div>
          </div>

          <div className={styles.footerActions}>
            <button className="btn-pill">Save Draft</button>
            <button className="btn-gradient">Run Validation</button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

import AppShell from "../../components/AppShell";
import styles from "./page.module.css";

const imgBell = "https://www.figma.com/api/mcp/asset/7af2e5ae-3cff-4293-831a-80775c434da8";

const navItems = [
  "API Keys",
  "Review Schedules",
  "User Permissions",
  "Customization",
  "Notifications",
  "Security"
];

export default function SettingsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage API keys, review schedules, and user permissions</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <img src={imgBell} alt="" />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient">Save Changes</button>
          </div>
        </header>

        <section className={styles.settingsLayout}>
          <aside className={styles.settingsNav}>
            {navItems.map((item, index) => (
              <button
                key={item}
                className={index === 0 ? styles.navActive : styles.navItem}
              >
                {item}
              </button>
            ))}
          </aside>

          <div className={styles.settingsContent}>
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>API Keys</h3>
                  <p>Manage your Notion and Gemini API keys</p>
                </div>
                <button className="btn-gradient">Add New Key</button>
              </div>
              <div className={styles.notice}>
                <strong>API Key Security</strong>
                <p>
                  Never share your API keys. Store them securely and rotate them
                  regularly. Keys are encrypted at rest.
                </p>
              </div>
              <div className={styles.keyCard}>
                <div>
                  <div className={styles.keyTitle}>Notion API Key</div>
                  <div className={styles.keySubtitle}>Production environment</div>
                </div>
                <span className={styles.keyStatus}>Active</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

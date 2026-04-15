import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import {
  IconBell,
  IconPlus,
  IconKey,
  IconCalendar,
  IconUsers,
  IconEdit,
  IconShield,
  IconSettings,
  IconSave
} from "../../components/Icons";

const navItems = [
  { label: "API Keys", icon: <IconKey style={{ width: '16px' }} /> },
  { label: "Review Schedules", icon: <IconCalendar style={{ width: '16px' }} /> },
  { label: "User Permissions", icon: <IconUsers style={{ width: '16px' }} /> },
  { label: "Customization", icon: <IconEdit style={{ width: '16px' }} /> },
  { label: "Notifications", icon: <IconBell style={{ width: '16px' }} /> },
  { label: "Security", icon: <IconShield style={{ width: '16px' }} /> }
];

export default function SettingsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-800">
          This page is in development. Data shown is placeholder only.
        </div>
        <header className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage API keys, review schedules, and user permissions</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <IconBell />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient opacity-50 cursor-not-allowed" disabled title="Coming soon">
              <IconSave style={{ width: '16px', marginRight: '8px' }} />
              Save Changes
            </button>
          </div>
        </header>

        <section className={styles.settingsLayout}>
          <aside className={styles.settingsNav}>
            {navItems.map((item, index) => (
              <button
                key={item.label}
                className={index === 0 ? styles.navActive : styles.navItem}
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                {item.icon}
                {item.label}
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
                <button className="btn-gradient">
                  <IconPlus style={{ width: '14px', marginRight: '6px' }} />
                  Add New Key
                </button>
              </div>
              <div className={styles.notice}>
                <strong>
                  <IconShield style={{ width: '16px' }} />
                  API Key Security
                </strong>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span className={styles.keyStatus}>Active</span>
                  <button className="btn-ghost" style={{ padding: '8px' }}>
                    <IconSettings style={{ width: '16px' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

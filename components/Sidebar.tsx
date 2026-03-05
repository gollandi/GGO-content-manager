"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import * as Icons from "./Icons";

const navItems = [
  { href: "/", label: "Dashboard", Icon: Icons.IconDashboard },
  { href: "/content-explorer", label: "Content Explorer", Icon: Icons.IconExplorer },
  { href: "/validation-hub", label: "Validation Hub", Icon: Icons.IconValidation },
  { href: "/evidence-repository", label: "Evidence Repository", Icon: Icons.IconEvidence },
  { href: "/content-requests", label: "Content Requests", Icon: Icons.IconRequests },
  { href: "/feedback-queue", label: "Feedback Queue", Icon: Icons.IconFeedback },
  { href: "/annual-review", label: "Annual Review", Icon: Icons.IconAnnual },
  { href: "/analytics", label: "Analytics", Icon: Icons.IconAnalytics },
  { href: "/assistant", label: "AI Assistant", Icon: Icons.IconAssistant }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topSection}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            <span>G</span>
          </Link>
          <div className={styles.brand}>
            <div className={styles.brandTitle}>GGO Med</div>
            <div className={styles.brandSubtitle}>Content Manager</div>
          </div>
          <button className={styles.collapseButton} aria-label="Collapse sidebar">
            <Icons.IconMenu className={styles.iconSm} />
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? styles.navItemActive : styles.navItem}
                aria-current={isActive ? "page" : undefined}
              >
                <item.Icon className={styles.navIcon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.footer}>
        <button className={styles.syncButton}>
          <Icons.IconSync className={styles.iconSxs} />
          <span>Sync Notion</span>
        </button>
        <div className={styles.syncMeta}>Last synced: 2 min ago</div>

        <div className={styles.userSection}>
          <div className={styles.userRow}>
            <div className={styles.avatarPlaceholder}>SM</div>
            <div className={styles.userMeta}>
              <div className={styles.userName}>Sarah Mitchell</div>
              <div className={styles.userRole}>Content Admin</div>
            </div>
          </div>

          <div className={styles.footerLinks}>
            <Link href="/settings" className={styles.footerLink}>
              <Icons.IconSettings className={styles.iconSxs} />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

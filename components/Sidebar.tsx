"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const imgUser = "https://www.figma.com/api/mcp/asset/8bdc4987-242a-430e-91cd-063be7f2557b";
const imgCollapse = "https://www.figma.com/api/mcp/asset/4c49e583-c8f1-4faf-b4b4-7e70f7da4840";
const imgDashboard = "https://www.figma.com/api/mcp/asset/5f22f498-d093-4bc3-9725-7eabd537acfb";
const imgExplorer = "https://www.figma.com/api/mcp/asset/bd9a301c-4d2e-4e78-8350-9c4ac41271a0";
const imgValidation = "https://www.figma.com/api/mcp/asset/7587f981-ea2e-4381-8c63-1f2144c9fe54";
const imgEvidence = "https://www.figma.com/api/mcp/asset/17c6d9bb-5091-4935-b521-e8d1769c5ad6";
const imgRequests = "https://www.figma.com/api/mcp/asset/4a3d0ba4-ac36-4510-b574-b7a1cb754eaf";
const imgFeedback = "https://www.figma.com/api/mcp/asset/819ec7c6-80d9-4480-9588-edfa06260027";
const imgAnnual = "https://www.figma.com/api/mcp/asset/453a632f-2a0f-4c59-87b9-d5ae82ef23f7";
const imgAnalytics = "https://www.figma.com/api/mcp/asset/5c60ab4b-69ff-4aff-8ce8-65683fbe2408";
const imgAssistant = "https://www.figma.com/api/mcp/asset/d36edef1-9c80-4261-bd44-70e5510519ad";
const imgSync = "https://www.figma.com/api/mcp/asset/27265ce6-efbf-49ad-b91a-3d4f6811786d";
const imgUserMenu = "https://www.figma.com/api/mcp/asset/7845903e-0889-45fc-9fa4-c17f3f89e66e";

const navItems = [
  { href: "/", label: "Dashboard", icon: imgDashboard },
  { href: "/content-explorer", label: "Content Explorer", icon: imgExplorer },
  { href: "/validation-hub", label: "Validation Hub", icon: imgValidation },
  { href: "/evidence-repository", label: "Evidence Repository", icon: imgEvidence },
  { href: "/content-requests", label: "Content Requests", icon: imgRequests },
  { href: "/feedback-queue", label: "Feedback Queue", icon: imgFeedback },
  { href: "/annual-review", label: "Annual Review", icon: imgAnnual },
  { href: "/analytics", label: "Analytics", icon: imgAnalytics },
  { href: "/assistant", label: "AI Assistant", icon: imgAssistant }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <span>G</span>
        </div>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>GGO Med</div>
          <div className={styles.brandSubtitle}>Compliance Tracker</div>
        </div>
        <button className={styles.collapseButton} aria-label="Collapse sidebar">
          <img src={imgCollapse} alt="" />
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
              <img src={item.icon} alt="" className={styles.navIcon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <button className={styles.syncButton}>
          <img src={imgSync} alt="" />
          <span>Sync Notion</span>
        </button>
        <div className={styles.syncMeta}>Last synced: 2 min ago</div>
        <div className={styles.userRow}>
          <img src={imgUser} alt="Sarah Mitchell" className={styles.avatar} />
          <div className={styles.userMeta}>
            <div className={styles.userName}>Sarah Mitchell</div>
            <div className={styles.userRole}>Content Manager</div>
          </div>
          <img src={imgUserMenu} alt="" className={styles.userMenu} />
        </div>
        <Link href="/settings" className={styles.settingsLink}>
          Settings
        </Link>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "./Icons";

const navItems = [
  { href: "/", label: "Dashboard", Icon: Icons.IconDashboard },
  { href: "/content-explorer", label: "Content Explorer", Icon: Icons.IconExplorer },
  { href: "/validation-hub", label: "PIF Tick Validation", Icon: Icons.IconPifTick },
  { href: "/evidence-repository", label: "Evidence Repository", Icon: Icons.IconEvidence },
  { href: "/content-requests", label: "Content Requests", Icon: Icons.IconRequests },
  { href: "/feedback-queue", label: "Feedback Queue", Icon: Icons.IconFeedback },
  { href: "/annual-review", label: "Annual Review", Icon: Icons.IconAnnual },
  { href: "/analytics", label: "Analytics", Icon: Icons.IconAnalytics },
  { href: "/assistant", label: "AI Assistant", Icon: Icons.IconAssistant },
  { href: "/patient-journeys", label: "Patient Journeys", Icon: Icons.IconJourney },
  { href: "/keywords", label: "Keywords", Icon: Icons.IconKey },
  { href: "/schema-validation", label: "Schema Validation", Icon: Icons.IconCode },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-white border-r border-border-default flex flex-col justify-between min-h-screen sticky top-0 max-lg:min-h-auto max-lg:relative max-lg:border-r-0 max-lg:border-b max-lg:border-border-default">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3.5 px-6 py-8">
          <Link
            href="/"
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-ggo-purple to-ggo-teal flex items-center justify-center text-white font-extrabold text-[22px] shadow-glow-purple transition-transform hover:scale-105"
          >
            G
          </Link>
          <div className="flex-1">
            <div className="text-[15px] font-bold tracking-tight">GGO Med</div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Content Manager</div>
          </div>
          <button className="text-subtle p-1 rounded-md hover:bg-surface-muted hover:text-ggo-purple transition-colors">
            <Icons.IconMenu className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-4 max-lg:flex-row max-lg:overflow-x-auto max-lg:pb-3">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "flex items-center gap-3 px-4 py-2.5 rounded-2xl text-white bg-gradient-to-r from-ggo-purple to-ggo-teal font-semibold text-sm shadow-glow-purple transition-all duration-300 max-lg:whitespace-nowrap"
                    : "flex items-center gap-3 px-4 py-2.5 rounded-2xl text-charcoal text-sm font-medium hover:bg-surface-muted hover:text-ggo-purple transition-all duration-200 max-lg:whitespace-nowrap"
                }
                aria-current={isActive ? "page" : undefined}
              >
                <item.Icon className={`w-[18px] h-[18px] ${isActive ? "opacity-100" : "text-ggo-teal opacity-70"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border-default flex flex-col gap-5 max-lg:hidden">
        <button className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-mint text-foreground text-[13px] font-semibold hover:shadow-glow-teal transition-all duration-200">
          <Icons.IconSync className="w-3.5 h-3.5 text-ggo-teal" />
          <span>Sync Notion</span>
        </button>
        <div className="text-[11px] text-subtle text-center -mt-3">Last synced: 2 min ago</div>

        <div className="bg-surface-base p-3 rounded-xl border border-border-soft">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ggo-purple to-ggo-teal text-white flex items-center justify-center text-xs font-bold">
              SM
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Sarah Mitchell</div>
              <div className="text-[11px] text-muted-foreground">Content Admin</div>
            </div>
          </div>

          <div className="flex flex-col">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 p-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-ggo-purple transition-colors"
            >
              <Icons.IconSettings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

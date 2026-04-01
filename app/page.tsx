"use client";

import { useState, useEffect } from "react";
import AppShell from "../components/AppShell";
import * as Icons from "../components/Icons";
import { ContentItem, PifValidationItem } from "../lib/notion/types";

export default function DashboardPage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [compliance, setCompliance] = useState<PifValidationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [contentRes, complianceRes] = await Promise.all([
          fetch("/api/notion/content"),
          fetch("/api/notion/compliance")
        ]);

        const contentData = await contentRes.json();
        const complianceData = await complianceRes.json();

        if (Array.isArray(contentData)) setContent(contentData);
        if (Array.isArray(complianceData)) setCompliance(complianceData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Derived Operational Stats
  const now = new Date();
  const SIX_MONTHS_AGO = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));

  const upcomingReviews = content
    .filter(c => {
      if (c.status === "👁️ Review" || c.status === "⚠️ Needs Update") return true;
      if (!c.lastReviewed) return true;
      return new Date(c.lastReviewed) < SIX_MONTHS_AGO;
    })
    .sort((a, b) => {
      if (!a.lastReviewed) return -1;
      if (!b.lastReviewed) return 1;
      return new Date(a.lastReviewed).getTime() - new Date(b.lastReviewed).getTime();
    })
    .slice(0, 5);

  const hasWebsite = (c: ContentItem) => c.platform?.some(p => p.includes("Website"));
  const hasYouTube = (c: ContentItem) => c.platform?.some(p => p.includes("YouTube"));

  const inventoryBreakdown = {
    website: content.filter(c => hasWebsite(c)).length,
    video: content.filter(c => hasYouTube(c)).length,
    other: content.filter(c => !hasWebsite(c) && !hasYouTube(c)).length
  };

  const activeContentCount = content.length;
  const compliantCount = compliance.filter(c => c.status === "✅ YES").length;
  const complianceScore = compliance.length > 0 ? Math.round((compliantCount / compliance.length) * 100) : 0;
  const overdueCount = upcomingReviews.length;
  const riskAlerts = compliance.filter(c => c.status === "❌ NO").length;

  // Recent Activity (Existing)
  const recentItems = [...content]
    .sort((a, b) => new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime())
    .slice(0, 3);

  const formatDistance = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">Operational Dashboard</h1>
          <p className="page-subtitle">PIF Tick Compliance & Content Governance Overview</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-pill" onClick={() => window.location.reload()}>
            <Icons.IconSync className="w-4 h-4" />
            Fetch Updates
          </button>
          <button className="btn-gradient">View Reports</button>

          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-border-default">
            <button className="w-10 h-10 rounded-full border border-border-default bg-white flex items-center justify-center text-charcoal relative hover:bg-surface-base hover:text-ggo-purple hover:border-ggo-purple transition-colors">
              <Icons.IconBell className="w-[18px] h-[18px]" />
              {overdueCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white">
                  {overdueCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="page-section">
        {/* Statistics Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8 max-xl:grid-cols-2 max-md:grid-cols-1">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-ggo-purple/10 text-ggo-purple">
                <Icons.IconValidation className="w-[18px] h-[18px]" />
              </div>
              <span className="pill pill-green">+Live</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">
              {isLoading ? "..." : activeContentCount}
            </div>
            <div className="card-subtitle">Active Content Items</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-ggo-teal/10 text-ggo-teal">
                <Icons.IconEvidence className="w-[18px] h-[18px]" />
              </div>
              <span className={`pill ${complianceScore > 90 ? 'pill-green' : 'pill-blue'}`}>
                {complianceScore}%
              </span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">
              {isLoading ? "..." : `${complianceScore}%`}
            </div>
            <div className="card-subtitle">Compliance Score</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-mint/30 text-emerald-700">
                <Icons.IconRequests className="w-[18px] h-[18px]" />
              </div>
              <span className="pill pill-yellow">{overdueCount} Pending</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">
              {isLoading ? "..." : overdueCount}
            </div>
            <div className="card-subtitle">Items Due for Review</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500/10 text-red-700">
                <Icons.IconBell className="w-[18px] h-[18px]" />
              </div>
              <span className={`pill ${riskAlerts > 0 ? 'pill-red' : 'pill-green'}`}>
                {riskAlerts > 0 ? "Critical" : "Stable"}
              </span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">
              {isLoading ? "..." : riskAlerts}
            </div>
            <div className="card-subtitle">Risk Alerts</div>
          </div>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-8 max-xl:grid-cols-1">
          {/* Left Column: Compliance Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="card-title">Content Inventory</h2>
                <p className="text-[11px] text-subtle mt-1">Breakdown by publishing platform</p>
              </div>
            </div>

            <div className="h-[340px] flex items-center justify-center gap-12 px-8">
              {[
                { label: "Website", count: inventoryBreakdown.website, color: "bg-ggo-purple", icon: <Icons.IconFilter /> },
                { label: "YouTube Video", count: inventoryBreakdown.video, color: "bg-red-500", icon: <Icons.IconSync /> },
                { label: "Other", count: inventoryBreakdown.other, color: "bg-ggo-teal", icon: <Icons.IconSearch /> },
              ].map((type) => {
                const percent = activeContentCount > 0 ? Math.round((type.count / activeContentCount) * 100) : 0;
                return (
                  <div key={type.label} className="flex-1 flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-2xl ${type.color}/10 flex items-center justify-center mb-4 text-charcoal`}>
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold">{percent}%</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">Total</span>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-near-black mb-1">{type.label}</div>
                    <div className="text-[11px] text-subtle">{type.count} Assets</div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className={`h-full ${type.color}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Recent Activity & Compliance by Category */}
          <div className="flex flex-col gap-6">
            <div className="card">
              <h2 className="card-title">Recent Activity</h2>
              <div className="flex flex-col gap-4 mt-5">
                {isLoading ? (
                  <div className="text-sm text-subtle">Loading activity...</div>
                ) : recentItems.map((item, i) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b border-border-soft last:border-b-0 last:pb-0">
                    <div className="w-8 h-8 rounded-full bg-surface-base flex items-center justify-center text-[11px] font-bold text-ggo-purple border border-border-default">
                      {item.reviewedBy[0]?.charAt(0) || "S"}
                    </div>
                    <div className="text-[13px] leading-relaxed text-charcoal">
                      <strong className="text-near-black font-semibold">{item.reviewedBy[0] || "System"}</strong> edited{" "}
                      <span className="text-ggo-purple font-medium">{item.title}</span>
                      <div className="text-[11px] text-subtle mt-0.5">{formatDistance(item.lastEditedTime)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="card-title text-red-600 flex items-center gap-2">
                <Icons.IconAlertCircle className="w-4 h-4" />
                Upcoming Reviews
              </h2>
              <div className="flex flex-col gap-3 mt-5">
                {isLoading ? (
                  <div className="text-sm text-subtle">Checking deadlines...</div>
                ) : upcomingReviews.length > 0 ? upcomingReviews.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-border-soft bg-surface-base hover:border-red-200 transition-colors">
                    <div className="text-[13px] font-semibold text-near-black truncate mb-1" title={item.title}>
                      {item.title}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-subtle px-1.5 py-0.5 bg-white rounded border border-border-default uppercase">
                        {item.status.replace(/^[^a-zA-Z0-9]+/, '')}
                      </span>
                      <span className="text-[11px] font-medium text-red-500">
                        {item.lastReviewed ? `Due: ${new Date(new Date(item.lastReviewed).getTime() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : 'Missing Review'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="py-4 text-center">
                    <Icons.IconCheck className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-subtle">No pending reviews</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}


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

  // Derived Stats
  const activeContentCount = content.length;
  const compliantCount = compliance.filter(c => c.status === "✅ YES").length;
  const complianceScore = compliance.length > 0 ? Math.round((compliantCount / compliance.length) * 100) : 0;
  const validationRequests = content.filter(c => c.status === "👁️ Review").length;
  const riskAlerts = compliance.filter(c => c.status === "❌ NO").length;

  // Recent Activity
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
              {validationRequests > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white">
                  {validationRequests}
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
              <span className="pill pill-yellow">{validationRequests} Pending</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">
              {isLoading ? "..." : validationRequests}
            </div>
            <div className="card-subtitle">Validation Requests</div>
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
                <h2 className="card-title">Compliance by Principle</h2>
                <p className="text-[11px] text-subtle mt-1">Average 'YES' status across all reviewed assets</p>
              </div>
              <select className="py-1.5 px-3 rounded-lg border border-border-default bg-surface-base text-xs font-medium text-charcoal">
                <option>All Assets</option>
              </select>
            </div>

            <div className="h-[340px] flex items-end py-10">
              <div className="flex-1 h-full flex items-end justify-around gap-6 border-b-2 border-border-soft pb-2 px-4">
                {[
                  { label: "Evidence", key: "evidenceBasedReview" },
                  { label: "Need", key: "contentNeedDocumented" },
                  { label: "Readability", key: "patientReadability" },
                  { label: "Inclusivity", key: "inclusivityAssessment" },
                  { label: "Peer Review", key: "expertPeerReview" },
                ].map((principle) => {
                  const total = compliance.length;
                  const passed = compliance.filter(c => (c as any)[principle.key] === true).length;
                  const percent = total > 0 ? Math.round((passed / total) * 100) : 0;

                  return (
                    <div key={principle.key} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                      {/* Tooltip */}
                      <div className="absolute -top-12 bg-charcoal text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {principle.label}: {percent}%
                      </div>

                      <div
                        className="w-full max-w-[60px] rounded-t-lg bg-gradient-to-t from-ggo-purple/80 to-ggo-teal/80 hover:from-ggo-purple hover:to-ggo-teal transition-all relative overflow-hidden"
                        style={{ height: `${Math.max(percent, 5)}%` }}
                      >
                        <div className="absolute top-2 left-0 right-0 text-center text-[10px] font-bold text-white">
                          {percent}%
                        </div>
                      </div>
                      <div className="absolute -bottom-10 text-[10px] font-medium text-subtle text-center whitespace-nowrap rotate-[-25deg] origin-top">
                        {principle.label}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              <h2 className="card-title">Compliance Metrics</h2>
              <div className="flex flex-col gap-4 mt-5">
                {[
                  { name: "Clinical Accuracy", score: 98, color: "bg-ggo-purple" },
                  { name: "Source Credibility", score: 85, color: "bg-ggo-teal" },
                  { name: "Content Freshness", score: 72, color: "bg-mint" }
                ].map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5 text-[13px]">
                      <span className="text-charcoal">{cat.name}</span>
                      <span className="font-semibold text-near-black">{cat.score}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.color}`}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}


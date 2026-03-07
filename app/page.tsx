import AppShell from "../components/AppShell";
import * as Icons from "../components/Icons";

export default function DashboardPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">Operational Dashboard</h1>
          <p className="page-subtitle">PIF Tick Compliance & Content Governance Overview</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="btn-pill">
            <Icons.IconSync className="w-4 h-4" />
            Fetch Updates
          </button>
          <button className="btn-gradient">View Reports</button>

          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-border-default">
            <button className="w-10 h-10 rounded-full border border-border-default bg-white flex items-center justify-center text-charcoal relative hover:bg-surface-base hover:text-ggo-purple hover:border-ggo-purple transition-colors">
              <Icons.IconBell className="w-[18px] h-[18px]" />
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white">3</span>
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
              <span className="pill pill-green">+12%</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">1,284</div>
            <div className="card-subtitle">Active Content Items</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-ggo-teal/10 text-ggo-teal">
                <Icons.IconEvidence className="w-[18px] h-[18px]" />
              </div>
              <span className="pill pill-blue">+3%</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">94.2%</div>
            <div className="card-subtitle">Compliance Score</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-mint/30 text-emerald-700">
                <Icons.IconRequests className="w-[18px] h-[18px]" />
              </div>
              <span className="pill pill-yellow">8 Pending</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">42</div>
            <div className="card-subtitle">Validation Requests</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500/10 text-red-700">
                <Icons.IconBell className="w-[18px] h-[18px]" />
              </div>
              <span className="pill pill-red">Critical</span>
            </div>
            <div className="text-[28px] font-bold tracking-tighter">12</div>
            <div className="card-subtitle">Risk Alerts</div>
          </div>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-8 max-xl:grid-cols-1">
          {/* Left Column: Compliance Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="card-title">Compliance Overview</h2>
              <select className="py-1.5 px-3 rounded-lg border border-border-default bg-surface-base text-xs font-medium text-charcoal">
                <option>Last 30 Days</option>
                <option>Last 3 Months</option>
              </select>
            </div>
            <div className="h-[340px] flex items-end py-5">
              <div className="flex-1 h-full flex items-end justify-between gap-3 border-b-2 border-border-soft pb-2">
                {[60, 80, 45, 90, 70, 85, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-6 rounded-t bg-gradient-to-t from-ggo-purple to-ggo-teal opacity-80 hover:opacity-100 transition-all"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Recent Activity & Compliance by Category */}
          <div className="flex flex-col gap-6">
            <div className="card">
              <h2 className="card-title">Recent Activity</h2>
              <div className="flex flex-col gap-4 mt-5">
                {[
                  { user: "Sarah M.", action: "validated content", target: "Prostate Surgery", time: "2m ago" },
                  { user: "James K.", action: "added evidence", target: "PSA Testing", time: "15m ago" },
                  { user: "System", action: "flagged discrepancy", target: "MRI Guidelines", time: "1h ago" }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 pb-4 border-b border-border-soft last:border-b-0 last:pb-0">
                    <div className="w-8 h-8 rounded-full bg-surface-base flex items-center justify-center text-[11px] font-bold text-ggo-purple border border-border-default">
                      {item.user.charAt(0)}
                    </div>
                    <div className="text-[13px] leading-relaxed text-charcoal">
                      <strong className="text-near-black font-semibold">{item.user}</strong> {item.action}{" "}
                      <span className="text-ggo-purple font-medium">{item.target}</span>
                      <div className="text-[11px] text-subtle mt-0.5">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Compliance by Category</h2>
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

import {
    getAmbrogioAudits,
    getAmbrogioProposals,
    getAgentsActivityLog,
} from "../../lib/notion/editorial";
import { settle } from "../../lib/settle";
import StatusBadge from "../../components/StatusBadge";

/**
 * Module 4 — Lo Studio di Ambrogio (spec §3). READ-ONLY oversight tower:
 * Audits, Proposals and the Agents Activity Log (the observability spine).
 *
 * Independence by construction: the ambrogio-il-maggiordomo SKILL is the
 * sole writer of the two Ambrogio DBs. This page — and this whole app —
 * holds no write path to them (asserted by __tests__/ambrogio-no-write).
 */
export const dynamic = "force-dynamic";

const decisionTone = (d: string | null) =>
    d === "Approved" || d === "Implemented" ? "success"
    : d === "Rejected" ? "danger"
    : d === "Pending" ? "warning"
    : "secondary";

const runTone = (s: string | null) =>
    s === "Success" ? "success"
    : s === "Failed" ? "danger"
    : s === "Partial" ? "warning"
    : "secondary";

export default async function AmbrogioPage() {
    const [audits, proposals, log] = await Promise.all([
        settle(getAmbrogioAudits),
        settle(getAmbrogioProposals),
        settle(getAgentsActivityLog),
    ]);

    const logRows = (log.data ?? [])
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
        .slice(0, 50);
    const failures = logRows.filter((r) => r.status === "Failed").length;
    const pendingProposals = (proposals.data ?? []).filter((p) => p.decision === "Pending").length;

    return (
        <div className="p-8 max-lg:p-4">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Lo Studio di Ambrogio</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Oversight, read-only. Ambrogio writes his own registers; the Shell only
                    reads them. Decisions stay in Notion, with JJ.
                </p>
            </header>

            {(audits.error || proposals.error || log.error) && (
                <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900">
                    {audits.error && <p><strong>Audits:</strong> {audits.error}</p>}
                    {proposals.error && <p><strong>Proposals:</strong> {proposals.error}</p>}
                    {log.error && <p><strong>Activity Log:</strong> {log.error}</p>}
                    <p className="mt-1 text-xs">Set the Ambrogio / Activity Log DB ids in .env.local (see .env.example).</p>
                </div>
            )}

            <div className="grid grid-cols-4 max-lg:grid-cols-2 gap-4 mb-6">
                {[
                    { label: "Audits", value: audits.data?.length ?? "—" },
                    { label: "Proposals", value: proposals.data?.length ?? "—" },
                    { label: "Pending decisions", value: pendingProposals },
                    { label: "Failures (last 50 runs)", value: failures },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl border border-border-default p-5">
                        <div className="text-3xl font-bold">{s.value}</div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-6 mb-6">
                <section className="bg-white rounded-2xl border border-border-default p-5">
                    <h2 className="text-base font-bold mb-3">Proposals</h2>
                    <ul className="divide-y divide-border-soft">
                        {(proposals.data ?? []).slice(0, 20).map((p) => (
                            <li key={p.id} className="py-2.5">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-medium">{p.proposal || "(untitled)"}</div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {p.severity && <StatusBadge tone={p.severity === "High" ? "danger" : p.severity === "Medium" ? "warning" : "secondary"} label={p.severity} />}
                                        <StatusBadge tone={decisionTone(p.decision)} label={p.decision ?? "—"} />
                                        {p.applied && <StatusBadge tone="success" label="Applied" />}
                                    </div>
                                </div>
                                <div className="text-xs text-subtle mt-0.5">
                                    {[p.type, p.estimatedComplexity, p.createdAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                                </div>
                                {p.motivation && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.motivation}</p>}
                            </li>
                        ))}
                        {(proposals.data ?? []).length === 0 && !proposals.error && (
                            <li className="py-6 text-center text-sm text-muted-foreground">No proposals.</li>
                        )}
                    </ul>
                </section>

                <section className="bg-white rounded-2xl border border-border-default p-5">
                    <h2 className="text-base font-bold mb-3">Audits</h2>
                    <ul className="divide-y divide-border-soft">
                        {(audits.data ?? []).slice(0, 12).map((a) => (
                            <li key={a.id} className="py-2.5">
                                <div className="text-sm font-medium">{a.title || "(untitled)"}</div>
                                <div className="text-xs text-subtle mt-0.5">
                                    {Object.entries(a.fields).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
                                </div>
                            </li>
                        ))}
                        {(audits.data ?? []).length === 0 && !audits.error && (
                            <li className="py-6 text-center text-sm text-muted-foreground">No audits.</li>
                        )}
                    </ul>
                </section>
            </div>

            <section className="bg-white rounded-2xl border border-border-default overflow-x-auto">
                <h2 className="text-base font-bold px-5 pt-5 pb-2">Agents Activity Log — last 50 runs</h2>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border-default text-left">
                            <th className="px-4 py-2.5 font-semibold">Job</th>
                            <th className="px-4 py-2.5 font-semibold">Status</th>
                            <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Started</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Duration</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Rows</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Errors</th>
                            <th className="px-4 py-2.5 font-semibold">Trigger</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logRows.map((r) => (
                            <tr key={r.id} className="border-b border-border-soft hover:bg-surface-muted/50">
                                <td className="px-4 py-2.5">
                                    <div className="font-medium">{r.job ?? r.run}</div>
                                    {r.errorMessage && <div className="text-xs text-red-500 line-clamp-1">{r.errorMessage}</div>}
                                </td>
                                <td className="px-4 py-2.5"><StatusBadge tone={runTone(r.status)} label={r.status ?? "—"} /></td>
                                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{r.startedAt?.replace("T", " ").slice(0, 16) ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{r.durationMs != null ? `${Math.round(r.durationMs / 1000)}s` : "—"}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{r.rowsWritten ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{r.errors ?? "—"}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{r.triggeredBy ?? "—"}</td>
                            </tr>
                        ))}
                        {logRows.length === 0 && !log.error && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No runs logged.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

import {
    getAmbrogioAudits,
    getAmbrogioProposals,
    getAgentsActivityLog,
} from "../../lib/notion/editorial";
import { settle } from "../../lib/settle";
import StatusBadge from "../../components/StatusBadge";
import Citofono from "../../components/Citofono";
import { RoomCrest } from "../../components/Registro";

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
        <>
        <div className="p-8 max-lg:p-4">
            <header className="mb-6 border-b border-plate-rule pb-4">
                <h1 className="document-title mt-1.5 flex items-center gap-3 text-[30px] text-plate-foreground-strong max-sm:text-[24px]"><RoomCrest room="ambrogio" size={26} className="opacity-80" />Lo Studio di Ambrogio</h1>
                <p className="mt-2 max-w-[38rem] text-[13px] leading-relaxed text-plate-foreground-soft">
                    Oversight, read-only. Ambrogio writes his own registers; the Shell only
                    reads them. Decisions stay in Notion, with JJ.
                </p>
            </header>

            {(audits.error || proposals.error || log.error) && (
                <div className="mb-6 p-4  border border-sepia text-sm text-sepia">
                    {audits.error && <p><strong>Audits:</strong> {audits.error}</p>}
                    {proposals.error && <p><strong>Proposals:</strong> {proposals.error}</p>}
                    {log.error && <p><strong>Activity Log:</strong> {log.error}</p>}
                    <p className="mt-1 text-xs">Set the Ambrogio / Activity Log DB ids in .env.local (see .env.example).</p>
                </div>
            )}

            <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                {[
                    { label: "Audits", value: audits.data?.length ?? "—" },
                    { label: "Proposals", value: proposals.data?.length ?? "—" },
                    { label: "Pending decisions", value: pendingProposals },
                    { label: "Failures (last 50 runs)", value: failures },
                ].map((s) => (
                    <div key={s.label} className="flex items-baseline gap-2">
                        <div className="tabular font-serif text-[26px] font-bold text-plate-foreground-strong">{s.value}</div>
                        <div className="column-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <section className="flex items-baseline gap-2">
                    <h2 className="text-base font-bold mb-3">Proposals</h2>
                    <ul className="divide-y divide-paper-edge">
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
                                <div className="text-xs text-paper-foreground-soft mt-0.5">
                                    {[p.type, p.estimatedComplexity, p.createdAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                                </div>
                                {p.motivation && <p className="text-xs text-paper-foreground-soft mt-1 line-clamp-2">{p.motivation}</p>}
                            </li>
                        ))}
                        {(proposals.data ?? []).length === 0 && !proposals.error && (
                            <li className="py-6 text-center text-sm text-paper-foreground-soft">No proposals.</li>
                        )}
                    </ul>
                </section>

                <section className="flex items-baseline gap-2">
                    <h2 className="text-base font-bold mb-3">Audits</h2>
                    <ul className="divide-y divide-paper-edge">
                        {(audits.data ?? []).slice(0, 12).map((a) => (
                            <li key={a.id} className="py-2.5">
                                <div className="text-sm font-medium">{a.title || "(untitled)"}</div>
                                <div className="text-xs text-paper-foreground-soft mt-0.5">
                                    {Object.entries(a.fields).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
                                </div>
                            </li>
                        ))}
                        {(audits.data ?? []).length === 0 && !audits.error && (
                            <li className="py-6 text-center text-sm text-paper-foreground-soft">No audits.</li>
                        )}
                    </ul>
                </section>
            </div>

            <section className="paper border border-paper-edge overflow-x-auto text-paper-foreground">
                <h2 className="text-base font-bold px-5 pt-5 pb-2">Agents Activity Log — last 50 runs</h2>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b-[3px] border-double border-paper-edge text-left">
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
                            <tr key={r.id} className="border-b border-paper-edge hover:bg-[var(--engraving-wash)]">
                                <td className="px-4 py-2.5">
                                    <div className="font-medium">{r.job ?? r.run}</div>
                                    {r.errorMessage && <div className="text-xs text-seal line-clamp-1">{r.errorMessage}</div>}
                                </td>
                                <td className="px-4 py-2.5"><StatusBadge tone={runTone(r.status)} label={r.status ?? "—"} /></td>
                                <td className="px-4 py-2.5 text-paper-foreground-soft whitespace-nowrap">{r.startedAt?.replace("T", " ").slice(0, 16) ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-paper-foreground-soft">{r.durationMs != null ? `${Math.round(r.durationMs / 1000)}s` : "—"}</td>
                                <td className="px-4 py-2.5 text-right text-paper-foreground-soft">{r.rowsWritten ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-paper-foreground-soft">{r.errors ?? "—"}</td>
                                <td className="px-4 py-2.5 text-paper-foreground-soft">{r.triggeredBy ?? "—"}</td>
                            </tr>
                        ))}
                        {logRows.length === 0 && !log.error && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-paper-foreground-soft">No runs logged.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
            <Citofono voice="ambrogio" />
        </>
    );
}

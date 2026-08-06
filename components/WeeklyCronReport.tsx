"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StatusBadge from "./StatusBadge";

/**
 * IL GIORNALE DI BORDO — what every run (cron or headless) did, day by day,
 * told in plain Italian. Each day opens with the chronicler's account
 * (written by Claude from the Agents Activity Log) and unfolds into the
 * individual runs when JJ wants the detail.
 */

type RunTone = "success" | "info" | "warning" | "danger" | "secondary";
type RunFilter = "all" | "attention";

export interface CronRun {
  id: string;
  run: string;
  job: string | null;
  status: string | null;
  startedAt: string | null;
  durationMs: number | null;
  rowsWritten: number | null;
  errors: number | null;
  summary: string;
  errorMessage: string;
  triggeredBy: string | null;
}

interface DayReport {
  date: string;
  prose: string | null;
  proseError: string | null;
  runs: CronRun[];
  counts: { total: number; ok: number; attention: number; rowsWritten: number };
}

interface DailyReportData {
  days: DayReport[];
  generatedAt: string;
  error?: string;
}

function isFinished(status: string | null) {
  return status === "Success" || status === "Done" || status === "Published";
}

function needsAttention(status: string | null) {
  return status === "Failed" || status === "Partial" || status === "Blocked" || status === "Error";
}

function statusTone(status: string | null): RunTone {
  if (isFinished(status)) return "success";
  if (status === "Running") return "info";
  if (status === "Partial") return "warning";
  if (needsAttention(status)) return "danger";
  return "secondary";
}

export function readableStatus(status: string | null) {
  if (isFinished(status)) return "Completato";
  if (status === "Running") return "In corso";
  if (status === "Partial") return "Parziale";
  if (status === "Disabled") return "Disattivato";
  if (needsAttention(status)) return "Da controllare";
  return "Senza stato";
}

function readableJob(job: string | null, run: string) {
  const value = `${job ?? ""} ${run}`.toLowerCase();
  if (/ga4|search.?console|semrush|analytics/.test(value)) return "Aggiornamento analytics";
  if (/sitemap|schema/.test(value)) return "Controllo tecnico del sito";
  if (/newsletter/.test(value)) return "Preparazione newsletter";
  if (/social|caption/.test(value)) return "Preparazione social";
  if (/brief/.test(value)) return "Preparazione brief";
  if (/review|critic/.test(value)) return "Revisione contenuti";
  if (/produce|content|writer/.test(value)) return "Produzione contenuti";
  if (/research|evidence/.test(value)) return "Ricerca e fonti";
  return job?.trim() || run || "Cron senza nome";
}

function readableProblem(message: string) {
  const value = message.trim();
  if (!value) return "Non è stato registrato un dettaglio del problema.";
  if (/oauth|token.*(revoked|invalid|expired)|unauthori[sz]ed|\b401\b/i.test(value)) {
    return "L'accesso a una fonte esterna non è più valido e va riconnesso.";
  }
  if (/enoent|spawn .* not found|command not found/i.test(value)) {
    return "Nel server manca il programma richiesto per eseguire questo passaggio.";
  }
  if (/timeout|timed out|etimedout/i.test(value)) {
    return "Il lavoro ha superato il tempo disponibile prima di finire.";
  }
  return "Il sistema ha registrato un problema durante l'esecuzione.";
}

export function describeCronRun(entry: CronRun) {
  const job = readableJob(entry.job, entry.run);
  const records = entry.rowsWritten && entry.rowsWritten > 0
    ? ` Ha aggiornato ${entry.rowsWritten} ${entry.rowsWritten === 1 ? "record" : "record"}.`
    : "";

  if (isFinished(entry.status)) return `${job} si è concluso correttamente.${records}`;
  if (entry.status === "Running") return `${job} sta ancora lavorando.`;
  if (entry.status === "Disabled") return `${job} è disattivato e non verrà eseguito.`;
  if (entry.status === "Partial") return `${job} ha completato solo una parte del lavoro.${records}`;
  return `${job} si è fermato prima della fine. ${readableProblem(entry.errorMessage || entry.summary)}`;
}

function formatTime(value: string | null) {
  if (!value) return "Orario non registrato";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDuration(value: number | null) {
  if (value == null) return "Durata non registrata";
  if (value < 60_000) return `${Math.max(1, Math.round(value / 1000))} secondi`;
  return `${Math.floor(value / 60_000)} min ${Math.round((value % 60_000) / 1000)} sec`;
}

function longDay(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

export default function WeeklyCronReport() {
  const [data, setData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RunFilter>("all");
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ernesto/operations/daily-report", { cache: "no-store" });
      const body = (await response.json()) as DailyReportData;
      if (!response.ok) throw new Error(body.error ?? "Il giornale di bordo non risponde.");
      setData(body);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Il giornale di bordo non risponde.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const days = data?.days ?? [];

  const totals = useMemo(() => days.reduce(
    (acc, day) => ({
      total: acc.total + day.counts.total,
      ok: acc.ok + day.counts.ok,
      attention: acc.attention + day.counts.attention,
      rowsWritten: acc.rowsWritten + day.counts.rowsWritten,
    }),
    { total: 0, ok: 0, attention: 0, rowsWritten: 0 }
  ), [days]);

  function toggleDay(date: string) {
    setOpenDays((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <section className="relative border-t border-plate-rule px-10 py-9 max-sm:px-4" aria-labelledby="weekly-cron-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="column-label">Giornale di bordo · ultimi 7 giorni</p>
          <h2 id="weekly-cron-title" className="document-title mt-2 text-[28px] text-plate-foreground-strong max-sm:text-[23px]">
            Cosa ha fatto la casa, giorno per giorno
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-plate-foreground-soft">
            Ogni giornata si apre con il resoconto in chiaro; le singole run si aprono solo quando serve il dettaglio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.generatedAt && (
            <span className="text-xs text-plate-foreground-soft">
              Letto alle {formatTime(data.generatedAt)}
            </span>
          )}
          <button type="button" onClick={() => void load()} className="act-quiet" disabled={loading}>
            Rileggi
          </button>
        </div>
      </div>

      {error && <p className="mt-5 border border-seal px-4 py-3 text-sm text-seal-bright">{error}</p>}

      <div className="mt-6 grid grid-cols-4 gap-px border border-plate-rule bg-plate-rule max-lg:grid-cols-2">
        {[
          { label: "Run eseguite", value: totals.total },
          { label: "Concluse bene", value: totals.ok },
          { label: "Da controllare", value: totals.attention },
          { label: "Record aggiornati", value: totals.rowsWritten },
        ].map((item) => (
          <div key={item.label} className="bg-plate-raised px-4 py-4">
            <div className="font-serif text-[28px] font-bold text-plate-foreground-strong">{loading ? "-" : item.value}</div>
            <div className="column-label mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Filtra le run per esito">
        {([
          ["all", "Tutte le run"],
          ["attention", "Solo da controllare"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`border px-3 py-2 text-xs font-semibold ${filter === value ? "border-engraving bg-engraving-wash text-plate-foreground-strong" : "border-plate-rule text-plate-foreground-soft hover:border-plate-foreground-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && days.length === 0 && (
        <p className="mt-6 text-sm text-plate-foreground-soft">Sfoglio il giornale di bordo…</p>
      )}

      <div className="mt-5 space-y-5">
        {days.map((day) => {
          const visibleRuns = day.runs.filter((entry) =>
            filter === "attention" ? needsAttention(entry.status) : true
          );
          if (filter === "attention" && visibleRuns.length === 0) return null;
          const opened = openDays.has(day.date);
          return (
            <article key={day.date} className="border border-plate-rule">
              <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-plate-rule bg-plate-raised px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-plate-foreground-strong">
                  {longDay(day.date)}
                </h3>
                <p className="text-xs text-plate-foreground-soft">
                  {day.counts.total} run · {day.counts.ok} concluse bene
                  {day.counts.attention > 0 && (
                    <span className="text-seal-bright"> · {day.counts.attention} da controllare</span>
                  )}
                </p>
              </header>

              <div className="px-4 py-4">
                {day.prose ? (
                  <p className="max-w-3xl text-[14px] leading-relaxed text-plate-foreground-soft">{day.prose}</p>
                ) : (
                  <p className="max-w-3xl text-[13px] italic text-plate-foreground-soft">
                    {day.proseError
                      ? "Il cronista non ha risposto — sotto trovi comunque le run in chiaro."
                      : "Resoconto non disponibile."}
                  </p>
                )}

                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-engraving-bright hover:underline"
                  aria-expanded={opened}
                  onClick={() => toggleDay(day.date)}
                >
                  {opened ? "Chiudi le run" : `Apri le ${visibleRuns.length} run`}
                </button>

                {opened && (
                  <div className="mt-3 divide-y divide-plate-rule border-t border-plate-rule">
                    {visibleRuns.map((entry) => {
                      const expanded = expandedId === entry.id;
                      const detail = entry.errorMessage || entry.summary;
                      return (
                        <div key={entry.id} className="py-3">
                          <button
                            type="button"
                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 text-left max-sm:grid-cols-1"
                            aria-expanded={expanded}
                            aria-controls={`cron-detail-${entry.id}`}
                            onClick={() => setExpandedId(expanded ? null : entry.id)}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-plate-foreground-strong">
                                  {readableJob(entry.job, entry.run)}
                                </h4>
                                <StatusBadge tone={statusTone(entry.status)} label={readableStatus(entry.status)} />
                              </div>
                              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-plate-foreground-soft">
                                {describeCronRun(entry)}
                              </p>
                            </div>
                            <div className="flex items-start gap-3 text-right text-xs text-plate-foreground-soft max-sm:text-left">
                              <span>{formatTime(entry.startedAt)}</span>
                              <span className="text-engraving-bright">{expanded ? "Chiudi" : "Apri"}</span>
                            </div>
                          </button>

                          {expanded && (
                            <div id={`cron-detail-${entry.id}`} className="mt-3 grid grid-cols-4 gap-px border border-plate-rule bg-plate-rule max-lg:grid-cols-2">
                              {[
                                ["Durata", formatDuration(entry.durationMs)],
                                ["Avviato da", entry.triggeredBy || "Non registrato"],
                                ["Record scritti", String(entry.rowsWritten ?? 0)],
                                ["Errori", String(entry.errors ?? 0)],
                              ].map(([label, value]) => (
                                <div key={label} className="bg-plate-raised px-3 py-3">
                                  <div className="column-label">{label}</div>
                                  <div className="mt-1 text-sm text-plate-foreground-strong">{value}</div>
                                </div>
                              ))}
                              <div className="col-span-full border-t border-plate-rule bg-plate-raised px-3 py-3">
                                <div className="column-label">Dettaglio registrato</div>
                                <p className="mt-1 break-words text-xs leading-relaxed text-plate-foreground-soft">
                                  {detail || "Nessun dettaglio tecnico disponibile."}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {!loading && days.length === 0 && !error && (
          <p className="py-8 text-center text-sm text-plate-foreground-soft">
            Nessuna run registrata negli ultimi sette giorni.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-plate-rule pt-4">
        <p className="text-xs text-plate-foreground-soft">I record restano di proprietà di Ernesto e Notion; qui vengono letti e raccontati.</p>
        <Link href="/casa-di-ernesto" className="text-xs font-semibold text-engraving-bright hover:underline">
          Apri la Casa di Ernesto
        </Link>
      </div>
    </section>
  );
}

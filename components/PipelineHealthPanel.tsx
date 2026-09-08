"use client";
import { useCallback, useEffect, useState } from "react";
import type { PipelineHealth, WorkflowHealth } from "../lib/pipeline/health";

const labels: Record<WorkflowHealth["state"], string> = {
  healthy: "Verificata",
  warning: "Da controllare",
  failed: "Errore",
  running: "In esecuzione",
  unverified: "Non verificata",
  unavailable: "Non disponibile",
};
const stepNames: Record<string, string> = {
  sitemap: "Elenco pagine",
  backup: "Backup",
  sync: "Sincronizzazione",
  deduplicate: "Duplicati",
  evidence: "Fonti",
  enhance: "Arricchimento",
  pif: "Dati PIF",
  keywords: "Parole chiave",
  validate: "Validazione",
  qa: "Controllo qualità",
  document: "Documento",
};
const when = (date: string) =>
  new Date(date).toLocaleString("it-IT", { timeZone: "Europe/London" });
const metric = (n: unknown) => (typeof n === "number" ? String(n) : "Non misurato");

export default function PipelineHealthPanel() {
  const [data, setData] = useState<PipelineHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/pipeline/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      setData(await response.json());
    } catch {
      setError(true);
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section
      className="relative border-b border-plate-rule px-8 py-6 max-sm:px-4"
      aria-labelledby="pipeline-health-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pipeline-health-title" className="column-label">
          Dati del sito · Sanity → Notion
        </h2>
        <button type="button" className="act-quiet" disabled={busy} onClick={() => void load()}>
          {busy ? "Verifico…" : "Aggiorna stato"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-plate-foreground-soft">
        Esito delle sincronizzazioni e dei controlli sui dati. Le approvazioni editoriali restano al
        Cancello.
      </p>
      <div aria-live="polite">
        {error && (
          <p className="mt-3 text-[13px]">
            Stato non disponibile. Riprova o controlla l’accesso a GitHub.
          </p>
        )}
        {!data && !error && <p className="mt-3 text-[13px]">Leggo le ultime esecuzioni…</p>}
        {data && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {data.workflows.map((workflow) => (
              <article
                key={workflow.mode}
                className="paper border border-paper-edge p-4 text-paper-foreground"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-[14px]">{workflow.name}</h3>
                  <strong className="text-[12px]">{labels[workflow.state]}</strong>
                </div>
                <p className="mt-2 text-[12px]">{workflow.message}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt>Ultimo avvio (Londra)</dt>
                  <dd>{workflow.lastRunAt ? when(workflow.lastRunAt) : "Non disponibile"}</dd>
                  <dt>Fine esecuzione</dt>
                  <dd>{workflow.report ? when(workflow.report.completedAt) : "Non verificata"}</dd>
                  <dt>Record aggiornati</dt>
                  <dd>{metric(workflow.report?.sync?.updated)}</dd>
                  <dt>Record creati</dt>
                  <dd>{metric(workflow.report?.sync?.created)}</dd>
                  <dt>Problemi di validazione</dt>
                  <dd>{metric(workflow.report?.validation?.issues)}</dd>
                  <dt>Avvisi di validazione</dt>
                  <dd>{metric(workflow.report?.validation?.warnings)}</dd>
                  <dt>Discrepanze PIF</dt>
                  <dd>{metric(workflow.report?.validation?.mismatches)}</dd>
                  <dt>Rilievi QA gravi</dt>
                  <dd>{metric(workflow.report?.qa?.highSeverity)}</dd>
                </dl>
                {workflow.stale && (
                  <p className="mt-2 text-[12px] font-semibold">
                    Nessuna esecuzione completa avviata negli ultimi 8 giorni.
                  </p>
                )}
                {workflow.workflowState && workflow.workflowState !== "active" && (
                  <p className="mt-2 text-[12px] font-semibold">
                    Workflow disattivato: controlla la pianificazione.
                  </p>
                )}
                {workflow.report?.steps.some(
                  (step) => step.status === "failed" || step.status === "skipped"
                ) && (
                  <p className="mt-3 text-[12px]">
                    {workflow.report.steps
                      .filter((step) => step.status === "failed" || step.status === "skipped")
                      .map(
                        (step) =>
                          `${stepNames[step.id] || step.id}: ${step.status === "failed" ? "fallita" : "non eseguita"}`
                      )
                      .join(" · ")}
                  </p>
                )}
                {workflow.runUrl && (
                  <a
                    className="mt-3 inline-block text-[12px] font-semibold underline"
                    href={workflow.runUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apri esecuzione e rapporti ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
        {data && (
          <p className="mt-3 text-[11px] text-plate-foreground-soft">
            Stato letto {when(data.checkedAt)} · Le quantità indicano operazioni sui record, non
            pagine uniche né approvazioni.
          </p>
        )}
      </div>
    </section>
  );
}

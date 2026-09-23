import { unzipSync } from "fflate";

const REPO = "GGO-Med/notion-integration";
const API = `https://api.github.com/repos/${REPO}`;
const workflows = [
  { file: "weekly-full.yml", label: "Sincronizzazione completa", mode: "full" },
  { file: "sanity-sync.yml", label: "Aggiornamenti da Sanity", mode: "document" },
] as const;
const FULL_STEPS = [
  "sitemap",
  "backup",
  "sync",
  "deduplicate",
  "evidence",
  "enhance",
  "pif",
  "keywords",
  "validate",
  "qa",
];
type Metrics = Record<string, number | boolean | null>;
export interface PipelineReport {
  schemaVersion: 1;
  mode: "full" | "document";
  runId: string;
  runAttempt: string;
  headSha: string;
  startedAt: string;
  completedAt: string;
  status: "success" | "warning" | "failed";
  steps: {
    id: string;
    status: "success" | "warning" | "failed" | "skipped";
    exitCode: number | null;
    startedAt: string | null;
    completedAt: string | null;
  }[];
  validation: Metrics | null;
  qa: Metrics | null;
  sync: Metrics | null;
  pif: Metrics | null;
}
export interface WorkflowHealth {
  name: string;
  mode: "full" | "document";
  state: "healthy" | "warning" | "failed" | "running" | "unverified" | "unavailable";
  workflowState: string | null;
  runUrl: string | null;
  lastRunAt: string | null;
  stale: boolean;
  report: PipelineReport | null;
  message: string;
}
export interface PipelineHealth {
  checkedAt: string;
  configured: boolean;
  workflows: WorkflowHealth[];
}
interface Run {
  id: number;
  run_attempt: number;
  head_sha: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  run_started_at?: string;
}

const iso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
export function parseReport(value: unknown, run: Run, mode: string): PipelineReport {
  if (!value || typeof value !== "object") throw new Error("Missing report");
  const r = value as PipelineReport;
  if (
    r.schemaVersion !== 1 ||
    r.mode !== mode ||
    r.runId !== String(run.id) ||
    r.runAttempt !== String(run.run_attempt) ||
    r.headSha !== run.head_sha ||
    !iso(r.startedAt) ||
    !iso(r.completedAt) ||
    Date.parse(r.completedAt) < Date.parse(r.startedAt) ||
    !["success", "warning", "failed"].includes(r.status)
  )
    throw new Error("Report provenance mismatch");
  const ids = mode === "full" ? FULL_STEPS : ["document"];
  if (
    !Array.isArray(r.steps) ||
    r.steps.length !== ids.length ||
    r.steps.some(
      (s, i) =>
        !s ||
        s.id !== ids[i] ||
        !["success", "warning", "failed", "skipped"].includes(s.status) ||
        (s.status === "skipped" ? s.exitCode !== null : !Number.isInteger(s.exitCode)) ||
        (s.status === "success" && s.exitCode !== 0)
    )
  )
    throw new Error("Incomplete step report");
  const expected = r.steps.some((s) => s.status === "failed")
    ? "failed"
    : r.steps.some((s) => s.status === "warning")
      ? "warning"
      : "success";
  if (
    r.status !== expected ||
    (r.status !== "failed" && r.steps.some((s) => s.status === "skipped"))
  )
    throw new Error("Contradictory report");
  const fields = {
    validation: ["issues", "warnings", "mismatches", "pass"],
    qa: ["findings", "errors", "highSeverity"],
    sync: ["created", "updated", "errors"],
    pif: ["created", "updated", "errors", "evidenceSlots"],
  } as const;
  const metrics: Record<string, Metrics | null> = {};
  for (const [key, names] of Object.entries(fields)) {
    const source = r[key as keyof typeof fields];
    if (source === null) {
      metrics[key] = null;
      continue;
    }
    if (!source || typeof source !== "object") throw new Error("Invalid metrics");
    metrics[key] = Object.fromEntries(
      names.map((name) => {
        const v = source[name];
        if (
          name === "pass"
            ? typeof v !== "boolean"
            : v !== null && (!Number.isInteger(v) || Number(v) < 0)
        )
          throw new Error("Invalid metric");
        return [name, v];
      })
    );
  }
  if (metrics.validation && metrics.validation.pass !== (metrics.validation.issues === 0))
    throw new Error("Contradictory validation");
  if (
    r.status === "success" &&
    (metrics.validation?.pass === false ||
      Number(metrics.qa?.errors) > 0 ||
      Number(metrics.qa?.highSeverity) > 0 ||
      Number(metrics.sync?.errors) > 0 ||
      Number(metrics.pif?.errors) > 0)
  )
    throw new Error("False success");
  // Return only allow-listed metadata; never render arbitrary report text.
  return {
    schemaVersion: 1,
    mode: r.mode,
    runId: r.runId,
    runAttempt: r.runAttempt,
    headSha: r.headSha,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    status: r.status,
    steps: r.steps.map((s) => ({
      id: s.id,
      status: s.status,
      exitCode: s.exitCode,
      startedAt: iso(s.startedAt) ? s.startedAt : null,
      completedAt: iso(s.completedAt) ? s.completedAt : null,
    })),
    ...metrics,
  } as PipelineReport;
}

async function bytes(response: Response, max: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new Error("GitHub read failed");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > max) throw new Error("Response too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export function decodeArtifact(data: Uint8Array): unknown {
  const files = unzipSync(data, {
    filter: (file) => file.name === "pipeline-health.json" && file.originalSize <= 65536,
  });
  if (!files["pipeline-health.json"]) throw new Error("Missing bounded health report");
  return JSON.parse(new TextDecoder().decode(files["pipeline-health.json"]));
}
export async function loadPipelineHealth({
  token = process.env.PIPELINE_GITHUB_READ_TOKEN,
  fetcher = fetch,
  now = new Date(),
}: {
  token?: string;
  fetcher?: typeof fetch;
  now?: Date;
} = {}): Promise<PipelineHealth> {
  const checkedAt = now.toISOString();
  const empty = (w: (typeof workflows)[number]): WorkflowHealth => ({
    name: w.label,
    mode: w.mode,
    state: "unavailable",
    workflowState: null,
    runUrl: null,
    lastRunAt: null,
    stale: false,
    report: null,
    message: "Configura l’accesso di sola lettura a GitHub per verificare la pipeline.",
  });
  if (!token?.trim()) return { checkedAt, configured: false, workflows: workflows.map(empty) };
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const json = async (path: string) => {
    const response = await fetcher(`${API}${path}`, {
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    return JSON.parse(new TextDecoder().decode(await bytes(response, 262144)));
  };
  const results = await Promise.all(
    workflows.map(async (w) => {
      const item = empty(w);
      try {
        const [workflow, list] = await Promise.all([
          json(`/actions/workflows/${w.file}`),
          json(`/actions/workflows/${w.file}/runs?branch=main&per_page=1`),
        ]);
        item.workflowState = typeof workflow.state === "string" ? workflow.state : null;
        const run: Run | undefined = list.workflow_runs?.[0];
        if (!run)
          return {
            ...item,
            state: "unverified" as const,
            message: "Nessuna esecuzione disponibile.",
          };
        if (
          !Number.isSafeInteger(run.id) ||
          !Number.isSafeInteger(run.run_attempt) ||
          !iso(run.created_at)
        )
          throw new Error("Invalid run");
        item.runUrl = `https://github.com/${REPO}/actions/runs/${run.id}`;
        item.lastRunAt = iso(run.run_started_at) ? run.run_started_at : run.created_at;
        item.stale = w.mode === "full" && now.getTime() - Date.parse(item.lastRunAt) > 8 * 86400000;
        if (run.status !== "completed")
          return {
            ...item,
            state: "running" as const,
            message: "Esecuzione in corso o in coda. Dati aggiornati non ancora verificati.",
          };
        item.state = run.conclusion === "success" ? "unverified" : "failed";
        item.message =
          "Report di verifica assente o scaduto: il risultato del job non certifica i dati.";
        const artifacts = await json(`/actions/runs/${run.id}/artifacts?per_page=100`);
        const artifact = artifacts.artifacts?.find(
          (a: { name: string; expired: boolean }) =>
            a.name === `pipeline-health-${run.run_attempt}` && !a.expired
        );
        if (!artifact || !Number.isSafeInteger(artifact.id)) return item;
        const redirect = await fetcher(`${API}/actions/artifacts/${artifact.id}/zip`, {
          headers,
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (redirect.status !== 302) throw new Error("Artifact redirect unavailable");
        const location = new URL(redirect.headers.get("location") || "");
        if (
          location.protocol !== "https:" ||
          location.username ||
          location.password ||
          !(
            location.hostname.endsWith(".blob.core.windows.net") ||
            location.hostname.endsWith(".githubusercontent.com")
          )
        )
          throw new Error("Invalid artifact host");
        // The signed archive URL receives no GitHub token and cannot redirect it.
        const archive = await fetcher(location.toString(), {
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        item.report = parseReport(decodeArtifact(await bytes(archive, 262144)), run, w.mode);
        if (Date.parse(item.report.completedAt) > now.getTime() + 300000)
          throw new Error("Future report");
        item.state =
          run.conclusion !== "success" || item.report.status === "failed"
            ? "failed"
            : item.report.status === "warning" || item.stale || item.workflowState !== "active"
              ? "warning"
              : !item.report.sync ||
                  (w.mode === "full" &&
                    (!item.report.validation || !item.report.qa || !item.report.pif))
                ? "unverified"
                : "healthy";
        item.message =
          item.state === "failed"
            ? "Controlla la fase fallita prima di ripetere la sincronizzazione."
            : item.state === "warning"
              ? "Controlla gli avvisi e lo stato della pianificazione."
              : item.state === "unverified"
                ? "Verifica dei dati incompleta."
                : w.mode === "document"
                  ? "Documento sincronizzato; verifica globale separata."
                  : "Sincronizzazione e controlli completati.";
        return item;
      } catch {
        return {
          ...item,
          state: item.state === "failed" ? ("failed" as const) : ("unavailable" as const),
          report: null,
          message:
            "Verifica non disponibile: controlla accesso GitHub, disponibilità e formato del report.",
        };
      }
    })
  );
  return { checkedAt, configured: true, workflows: results };
}

// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { loadPipelineHealth, parseReport, decodeArtifact } from "../lib/pipeline/health";
const run = {
  id: 42,
  run_attempt: 2,
  head_sha: "abc",
  status: "completed",
  conclusion: "success",
  created_at: "2026-09-08T10:00:00Z",
};
const ids = [
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
const report = () => ({
  schemaVersion: 1,
  mode: "full",
  runId: "42",
  runAttempt: "2",
  headSha: "abc",
  startedAt: run.created_at,
  completedAt: "2026-09-08T10:10:00Z",
  status: "success",
  steps: ids.map((id) => ({
    id,
    status: "success",
    exitCode: 0,
    startedAt: run.created_at,
    completedAt: "2026-09-08T10:10:00Z",
  })),
  validation: { issues: 0, warnings: 0, mismatches: 0, pass: true },
  qa: { findings: 0, errors: 0, highSeverity: 0 },
  sync: { created: 1, updated: 106, errors: 0 },
  pif: { created: 0, updated: 1, errors: 0, evidenceSlots: 2 },
});
function github({ legacy = false, failed = false, stale = false, artifactBody = report() } = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes(".blob.core.windows.net")) {
      expect(init?.headers).toBeUndefined(); // token cannot leave GitHub
      return new Response(
        Buffer.from(zipSync({ "pipeline-health.json": strToU8(JSON.stringify(artifactBody)) }))
      );
    }
    if (u.endsWith("/zip"))
      return new Response(null, {
        status: 302,
        headers: { location: "https://storage.blob.core.windows.net/report?signed=1" },
      });
    if (u.includes("/artifacts?"))
      return Response.json({
        artifacts: legacy ? [] : [{ id: 3, name: "pipeline-health-2", expired: false }],
      });
    if (u.includes("/runs?"))
      return Response.json({
        workflow_runs: [
          {
            ...run,
            conclusion: failed ? "failure" : "success",
            created_at: stale ? "2026-08-01T10:00:00Z" : run.created_at,
          },
        ],
      });
    return Response.json({ state: "active" });
  });
}
describe("pipeline health trust boundary", () => {
  it("does not invent health without configuration", async () => {
    const fetcher = vi.fn();
    const value = await loadPipelineHealth({ token: "", fetcher });
    expect(value.configured).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports legacy green jobs as unverified and failed jobs as failed", async () => {
    const value = await loadPipelineHealth({ token: "secret", fetcher: github({ legacy: true }) });
    expect(value.workflows[0].state).toBe("unverified");
    expect(value.workflows[0].report).toBeNull();
    const failed = await loadPipelineHealth({
      token: "secret",
      fetcher: github({ legacy: true, failed: true }),
    });
    expect(failed.workflows[0].state).toBe("failed");
  });
  it("reads a bounded matching artifact without exposing credentials", async () => {
    const value = await loadPipelineHealth({
      token: "SECRET_TOKEN",
      fetcher: github(),
      now: new Date("2026-09-08T11:00:00Z"),
    });
    expect(value.workflows[0].state).toBe("healthy");
    expect(value.workflows[0].report?.sync?.updated).toBe(106);
    expect(JSON.stringify(value)).not.toContain("SECRET_TOKEN");
  });
  it("does not present a stale success as healthy", async () => {
    const value = await loadPipelineHealth({
      token: "secret",
      fetcher: github({ stale: true }),
      now: new Date("2026-09-08T11:00:00Z"),
    });
    expect(value.workflows[0].stale).toBe(true);
    expect(value.workflows[0].state).not.toBe("healthy");
  });
  it("rejects reports from another retry, revision, and false validation successes", () => {
    expect(() => parseReport({ ...report(), runAttempt: "1" }, run, "full")).toThrow();
    expect(() => parseReport({ ...report(), headSha: "other" }, run, "full")).toThrow();
    expect(() =>
      parseReport({ ...report(), validation: { ...report().validation, pass: false } }, run, "full")
    ).toThrow();
    expect(() => parseReport({ ...report(), steps: [] }, run, "full")).toThrow();
    expect(() =>
      parseReport({ ...report(), qa: { findings: 1, highSeverity: 1, errors: 0 } }, run, "full")
    ).toThrow();
  });
  it("treats auth errors and expired reports as unavailable", async () => {
    const value = await loadPipelineHealth({
      token: "secret",
      fetcher: vi.fn(async () => new Response(null, { status: 403 })),
    });
    expect(value.workflows.every((w) => w.state === "unavailable")).toBe(true);
  });
  it("rejects oversized and missing JSON without decompressing unrelated content", () => {
    expect(() =>
      decodeArtifact(zipSync({ "pipeline-health.json": strToU8(" ".repeat(70000)) }))
    ).toThrow();
    expect(() => decodeArtifact(zipSync({ "other.json": strToU8("{}") }))).toThrow();
  });
});

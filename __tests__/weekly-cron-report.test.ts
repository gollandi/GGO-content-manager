import { describeCronRun, readableStatus, type CronRun } from "../components/WeeklyCronReport";
import { describe, expect, it } from "vitest";

const baseRun: CronRun = {
  id: "run-1",
  run: "ernesto-headless",
  job: "analytics-weekly",
  status: "Success",
  startedAt: "2026-08-04T08:00:00.000Z",
  durationMs: 20_000,
  rowsWritten: 12,
  errors: 0,
  summary: "Done",
  errorMessage: "",
  triggeredBy: "cron",
};

describe("weekly cron report", () => {
  it("turns a successful job into a readable operational result", () => {
    expect(readableStatus(baseRun.status)).toBe("Completato");
    expect(describeCronRun(baseRun)).toBe("Aggiornamento analytics si è concluso correttamente. Ha aggiornato 12 record.");
  });

  it("explains expired external access without exposing an opaque error as the primary result", () => {
    const failedRun: CronRun = {
      ...baseRun,
      status: "Failed",
      rowsWritten: 0,
      errorMessage: "401 OAuth token revoked/invalid",
    };

    expect(readableStatus(failedRun.status)).toBe("Da controllare");
    expect(describeCronRun(failedRun)).toContain("L'accesso a una fonte esterna non è più valido");
  });
});

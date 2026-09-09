import { describe, expect, it } from "vitest";
import { dayFallback, morningFallback, type ReportRun } from "../lib/briefing/fallback";
const run: ReportRun = { id: "1", job: "produce", run: "produce", status: "Success", startedAt: null,
    durationMs: null, rowsWritten: 0, errors: 0, summary: "0 output", errorMessage: "", triggeredBy: null };
describe("operator prose without invented outcomes", () => {
    it("does not turn successful zero-output work or absent telemetry into production evidence", () => {
        expect(dayFallback([run]).join(" ")).toContain("non riporta aggiornamenti di dati quantificati");
        expect(dayFallback([]).join(" ")).toContain("manchino i dati");
        expect(dayFallback([{ ...run, status: null }]).join(" ")).toContain("non permette di confermare");
    });
    it("surfaces numeric errors even when the run status says Success, and avoids raw diagnostics", () => {
        const prose = dayFallback([{ ...run, errors: 2, errorMessage: "401 token invalid /srv/private/file.js" }]).join(" ");
        expect(prose).toContain("Per 1 occorre controllare");
        expect(prose).toContain("accesso a una fonte esterna è stato respinto");
        expect(prose).not.toContain("/srv/"); expect(prose).not.toContain("401");
    });
    it("recognises the legacy brief while preserving overdue decisions, partial sources and the review boundary", () => {
        const input = `## Azioni in attesa di JJ\n- [ANCORA IN ATTESA 3d — OLTRE SCADENZA] [question] Decide\n- [in attesa 0d] [publish-approval] Review\n## Ieri notte — cosa ha fatto la casa\n12 run(s) across 4 job(s) in the last 24h — 1 job(s) failed, 2 partial.\n## Decisions awaiting you\n18 decision(s) waiting, grouped to decide in batches.\n## Output della casa\noutput 3 — 2 reached Review\nDrift data unavailable: /private/raw.log\nCAP BREACHED`;
        const paragraphs = morningFallback(input);
        expect(paragraphs.length).toBeLessThanOrEqual(4);
        const text = paragraphs.join(" ");
        expect(text).toContain("2 richieste"); expect(text).toContain("18 voci"); expect(text).toContain("Una è segnalata oltre scadenza");
        expect(text).toContain("4 attività"); expect(text).toContain("2 elementi arrivati alla revisione");
        expect(text).toContain("quadro resta incompleto"); expect(text).toContain("budget riportato supera");
        expect(text).not.toContain("/private/"); expect(text).not.toContain("publish-approval");
    });
    it("does not count a quoted status or decision count inside a title as another action", () => {
        const input = "## Azioni in attesa di JJ\n- [in attesa 0d] [question] Mention in attesa 9d and OLTRE SCADENZA in title\n## Other\n- 99 decision(s) waiting is a title";
        const prose = morningFallback(input).join(" ");
        expect(prose).toContain("una richiesta che attende");
        expect(prose).not.toContain("99 voci"); expect(prose).not.toContain("sono segnalate oltre scadenza");
    });
    it("does not deduce priorities from an unrecognised log or treat missing action data as an empty queue", () => {
        expect(morningFallback("TRACE job1: queue=[] success=true")[0]).toContain("non contiene conteggi o esiti");
        expect(morningFallback("## Azioni in attesa di JJ\nFAILED to read the action ledger")[0]).toContain("Non è possibile confermare");
    });
});

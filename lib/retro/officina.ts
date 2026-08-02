/**
 * L'Officina — self-improvement AUTONOMO fino alla PR (il gate umano è il MERGE).
 *
 * Pipeline: signals → PROPONI (edit esatti) → DISCUTI (skeptic a contesto
 * fresco) → APPLICA in un git worktree isolato → TESTA (tsc + vitest, un
 * giro di fix) → push branch + PR → SUMMARY a JJ (Desk row Pending + UI).
 *
 * RAIL NEL CODICE (costituzionali, non negoziabili):
 *  - EDIT_ALLOWLIST: solo la conoscenza editoriale (skill vendorizzate,
 *    shape-notes). Mai gate, auth, writer, tools, config.
 *  - il working tree dell'app viva NON viene mai toccato: worktree separato
 *  - MAI merge: push del branch e PR, il merge è di JJ
 */
import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runnerConfig } from "../config";
import { collectSignals } from "./collect";
import { createDeskProposal } from "../notion/desk-write";
import { pathAllowed } from "./edit-policy";

const exec = promisify(execFile);
const REPO = process.cwd();

const MAX_EDITS = 8;

interface ProposedEdit {
    id: number;
    file: string;
    find: string;
    replace: string;
    rationale: string;
    evidence: string;
}
interface Verdict {
    id: number;
    verdict: "keep" | "amend" | "drop";
    reason: string;
    amendedReplace?: string;
}
export interface OfficinaResult {
    branch: string | null;
    prUrl: string | null;
    summary: string;
    applied: number;
    dropped: number;
    testsPassed: boolean;
    reportPath: string;
}

function parseJson<T>(text: string): T {
    const stripped = text.replace(/^[\s\S]*?```(?:json)?\n?/, "").replace(/\n?```[\s\S]*$/, "");
    try {
        return JSON.parse(stripped) as T;
    } catch {
        return JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as T;
    }
}

export async function runOfficina(log: (line: string) => void): Promise<OfficinaResult> {
    const client = new Anthropic({ apiKey: runnerConfig.anthropicApiKey });
    const ask = async (system: string, user: string, maxTokens = 16000) => {
        const res = await client.messages.create({
            model: runnerConfig.model,
            max_tokens: maxTokens,
            thinking: { type: "adaptive" },
            system,
            messages: [{ role: "user", content: user }],
        });
        return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
    };

    // ── 1. ANALISI ───────────────────────────────────────────────────────
    log("1/6 Analisi dei journal…");
    const signals = await collectSignals();
    if (signals.totals.runs === 0) {
        throw new Error("Nessun run nei journal — niente da imparare ancora");
    }

    // Il proponente vede anche i file modificabili (per patch esatte).
    const editableExcerpt = (file: string) => {
        const full = join(REPO, file);
        return existsSync(full) ? readFileSync(full, "utf8") : "";
    };
    const corpus = [
        "### lib/runner/shape.ts\n" + editableExcerpt("lib/runner/shape.ts"),
        "### skills/ggomed-page-writer-v2/SKILL.md\n" + editableExcerpt("skills/ggomed-page-writer-v2/SKILL.md").slice(0, 40_000),
        "### skills/samantha-social-groupie/SKILL.md\n" + editableExcerpt("skills/samantha-social-groupie/SKILL.md").slice(0, 30_000),
    ].join("\n\n");

    // ── 2. PROPONI ───────────────────────────────────────────────────────
    log("2/6 Proposta di miglioramenti…");
    const proposeOut = await ask(
        `You improve JJ's GGOMed cockpit EDITORIAL KNOWLEDGE from evidence in its
own journals. You may ONLY edit: skills/**/*.md and lib/runner/shape.ts.
NEVER propose changes to gates, code, tools, certification, Ambrogio.
Return STRICT JSON array (no prose): [{"id":1,"file":"<allowlisted path>",
"find":"<EXACT text present in the file>","replace":"<new text>",
"rationale":"<why>","evidence":"<which runs/verdicts>"}]
Rules: max ${MAX_EDITS} edits; "find" must be copied VERBATIM from the file
content provided; small surgical edits over rewrites; evidence-based only —
if the journals are thin, return fewer edits or [].`,
        `# JOURNALS\n${JSON.stringify(signals, null, 1).slice(0, 200_000)}\n\n# EDITABLE FILES (current content)\n${corpus}`
    );
    let edits = parseJson<ProposedEdit[]>(proposeOut).slice(0, MAX_EDITS);
    log(`   ${edits.length} edit proposti`);
    if (edits.length === 0) throw new Error("Nessuna proposta supportata dall'evidenza — journal ancora magri");

    // ── 3. DISCUTI (skeptic, contesto fresco) ────────────────────────────
    log("3/6 Discussione (skeptic pass)…");
    const skepticOut = await ask(
        `You are the sceptic in a self-improvement debate about JJ's GGOMed
cockpit. For each proposed edit, challenge it: does the EVIDENCE really
support it? Does it risk degrading JJ's voice, clinical safety, or an
existing behaviour that works? Would a smaller edit do?
Return STRICT JSON array: [{"id":<n>,"verdict":"keep"|"amend"|"drop",
"reason":"<terse>","amendedReplace":"<only if amend>"}]. Default to "drop"
when in doubt — a dropped good idea returns next retro; a bad edit ships.`,
        `# JOURNALS (evidence)\n${JSON.stringify(signals, null, 1).slice(0, 120_000)}\n\n# PROPOSED EDITS\n${JSON.stringify(edits, null, 1)}`,
        8000
    );
    const verdicts = parseJson<Verdict[]>(skepticOut);
    const byId = new Map(verdicts.map((v) => [v.id, v]));
    const discussion = edits.map((e) => ({ edit: e, verdict: byId.get(e.id) ?? { id: e.id, verdict: "drop" as const, reason: "no verdict" } }));
    edits = discussion
        .filter((d) => d.verdict.verdict !== "drop")
        .map((d) => (d.verdict.verdict === "amend" && d.verdict.amendedReplace ? { ...d.edit, replace: d.verdict.amendedReplace } : d.edit));
    const droppedCount = discussion.length - edits.length;
    log(`   dopo la discussione: ${edits.length} keep/amend, ${droppedCount} drop`);
    if (edits.length === 0) throw new Error("Lo skeptic ha bocciato tutto — nessun edit applicato (report comunque salvato)");

    // ── 4. APPLICA in worktree isolato ───────────────────────────────────
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const branch = `soffitta/${stamp}`;
    const wt = join(REPO, ".officina", stamp);
    log(`4/6 Applico in worktree (${branch})…`);
    mkdirSync(join(REPO, ".officina"), { recursive: true });
    await exec("git", ["worktree", "add", wt, "-b", branch], { cwd: REPO });
    try {
        symlinkSync(join(REPO, "node_modules"), join(wt, "node_modules"));
    } catch { /* già presente */ }

    const applied: ProposedEdit[] = [];
    const notFound: ProposedEdit[] = [];
    for (const e of edits) {
        if (!pathAllowed(e.file)) {
            log(`   ✗ RIFIUTATO (fuori allowlist): ${e.file}`);
            continue;
        }
        const full = join(wt, e.file);
        if (!existsSync(full)) { notFound.push(e); continue; }
        const content = readFileSync(full, "utf8");
        if (!content.includes(e.find)) { notFound.push(e); log(`   ✗ find non trovato in ${e.file} (#${e.id})`); continue; }
        writeFileSync(full, content.replace(e.find, e.replace));
        applied.push(e);
        log(`   ✓ #${e.id} ${e.file}`);
    }
    if (applied.length === 0) {
        await exec("git", ["worktree", "remove", "--force", wt], { cwd: REPO });
        await exec("git", ["branch", "-D", branch], { cwd: REPO });
        throw new Error("Nessun edit applicabile (find non corrispondenti) — riprova alla prossima retro");
    }

    // ── 5. TESTA (un giro di fix se fallisce) ────────────────────────────
    log("5/6 Test nel branch…");
    const runTests = async () => {
        try {
            await exec("npx", ["tsc", "--noEmit"], { cwd: wt, timeout: 180_000 });
            await exec("npx", ["vitest", "run"], { cwd: wt, timeout: 300_000 });
            return { ok: true as const, output: "" };
        } catch (err) {
            const e = err as { stdout?: string; stderr?: string };
            return { ok: false as const, output: `${e.stdout ?? ""}\n${e.stderr ?? ""}`.slice(-4000) };
        }
    };
    let test = await runTests();
    if (!test.ok) {
        log("   test falliti — un giro di fix…");
        const fixOut = await ask(
            `Tests failed after your edits. Return STRICT JSON array of corrective
edits (same schema, allowlist only: skills/**/*.md, lib/runner/shape.ts) or
[] to revert the offending edit instead.`,
            `# TEST OUTPUT\n${test.output}\n\n# APPLIED EDITS\n${JSON.stringify(applied, null, 1)}`,
            6000
        );
        const fixes = parseJson<ProposedEdit[]>(fixOut).slice(0, 4);
        for (const f of fixes) {
            if (!pathAllowed(f.file)) continue;
            const full = join(wt, f.file);
            if (!existsSync(full)) continue;
            const content = readFileSync(full, "utf8");
            if (content.includes(f.find)) writeFileSync(full, content.replace(f.find, f.replace));
        }
        test = await runTests();
    }

    let prUrl: string | null = null;
    let summaryCore: string;
    if (test.ok) {
        // ── 6. COMMIT + PUSH + PR ────────────────────────────────────────
        log("6/6 Commit, push e PR…");
        await exec("git", ["add", "-A"], { cwd: wt });
        await exec("git", ["commit", "-m", `soffitta: self-improvement ${stamp} (${applied.length} edit, skeptic-reviewed, tests green)\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>`], { cwd: wt });
        await exec("git", ["push", "-u", "origin", branch], { cwd: wt });
        try {
            const pr = await exec("gh", ["pr", "create", "--head", branch, "--title", `Soffitta ${stamp} — self-improvement (${applied.length} edit)`, "--body", buildPrBody(applied, discussion, signals)], { cwd: wt });
            prUrl = pr.stdout.trim().split("\n").pop() ?? null;
        } catch {
            prUrl = null; // niente gh o PR fallita — resta il branch
        }
        summaryCore = `TESTS ✅ · branch ${branch} pushato${prUrl ? ` · PR: ${prUrl}` : " (PR non creata — apri dal compare)"}`;
    } else {
        summaryCore = `TESTS ❌ anche dopo il fix — branch ${branch} NON pushato, worktree conservato in .officina/ per ispezione`;
    }
    if (test.ok) {
        await exec("git", ["worktree", "remove", "--force", wt], { cwd: REPO }).catch(() => {});
        rmSync(wt, { recursive: true, force: true });
    }

    // ── SUMMARY a JJ ─────────────────────────────────────────────────────
    const summary = buildSummary(stamp, signals, discussion, applied, notFound, test.ok, branch, prUrl);
    const reportPath = join(REPO, "docs", "retros", `officina-${stamp}.md`);
    mkdirSync(join(REPO, "docs", "retros"), { recursive: true });
    writeFileSync(reportPath, summary);
    try {
        await createDeskProposal({
            title: `Officina ${stamp} — ${applied.length} miglioramenti in branch, ${test.ok ? "test verdi" : "TEST FALLITI"} — approva il merge`,
            body: summary,
        });
    } catch (err) {
        log(`Desk row fallita (summary salvato comunque): ${err instanceof Error ? err.message : err}`);
    }

    log(summaryCore);
    return {
        branch: test.ok ? branch : null,
        prUrl,
        summary,
        applied: applied.length,
        dropped: droppedCount + notFound.length,
        testsPassed: test.ok,
        reportPath: `docs/retros/officina-${stamp}.md`,
    };
}

function buildPrBody(applied: ProposedEdit[], discussion: { edit: ProposedEdit; verdict: Verdict }[], signals: { totals: { runs: number; blockingMentions: number } }): string {
    return [
        `Self-improvement autonomo della Soffitta/Officina — evidenza da ${signals.totals.runs} run (${signals.totals.blockingMentions} BLOCKING nei verdetti critici).`,
        ``,
        `## Edit applicati (skeptic-reviewed)`,
        ...applied.map((e) => `- **${e.file}**: ${e.rationale} _(evidenza: ${e.evidence})_`),
        ``,
        `## Discussione interna`,
        ...discussion.map((d) => `- #${d.edit.id} → **${d.verdict.verdict}**: ${d.verdict.reason}`),
        ``,
        `Il merge è il gate umano — nessuna modifica tocca main senza approvazione.`,
        ``,
        `🤖 Generated with [Claude Code](https://claude.com/claude-code)`,
    ].join("\n");
}

function buildSummary(
    stamp: string,
    signals: { periodNote: string; totals: { runs: number; costUsd: number; blockingMentions: number } },
    discussion: { edit: ProposedEdit; verdict: Verdict }[],
    applied: ProposedEdit[],
    notFound: ProposedEdit[],
    testsOk: boolean,
    branch: string,
    prUrl: string | null
): string {
    return [
        `# Officina — ${stamp}`,
        ``,
        `${signals.periodNote} · costo run analizzati $${signals.totals.costUsd.toFixed(2)} · ${signals.totals.blockingMentions} BLOCKING`,
        ``,
        `## Workflow eseguito`,
        `analisi → ${discussion.length} proposte → discussione (skeptic) → ${applied.length} applicate in ${branch} → test ${testsOk ? "✅" : "❌"}${prUrl ? ` → PR aperta` : ""}`,
        ``,
        `## Da approvare (il tuo unico gate: il merge)`,
        prUrl ? `**PR: ${prUrl}**` : testsOk ? `Branch \`${branch}\` pushato — apri la PR dal compare su GitHub.` : `Niente da mergiare: test falliti, worktree in .officina/ per ispezione.`,
        ``,
        `## Edit applicati`,
        ...applied.map((e) => `- **${e.file}** — ${e.rationale}\n  evidenza: ${e.evidence}`),
        ``,
        `## Scartati nella discussione`,
        ...discussion.filter((d) => d.verdict.verdict === "drop").map((d) => `- #${d.edit.id} ${d.edit.file} — ${d.verdict.reason}`),
        ...(notFound.length ? [``, `## Non applicabili (find non trovato)`, ...notFound.map((e) => `- #${e.id} ${e.file}`)] : []),
    ].join("\n");
}

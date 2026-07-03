/**
 * La Casa di Ernesto — the in-shell generative runner (Family A).
 *
 * A manual Anthropic Messages tool-use loop (the Helm runner PATTERN,
 * reimplemented lean — not a port): streaming, adaptive thinking, prompt
 * caching on the stable system prefix, bounded turns, abortable.
 *
 * Writes drafts.* only (enforced in lib/sanity/write-client.ts).
 * Publishing is JJ's click in the ggomed Studio — there is no publish tool.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runnerConfig } from "../config";
import { ggomedRawClient } from "../sanity/clients";
import { TOOL_DEFINITIONS, dispatchTool, type ToolContext } from "./tools";
import { SHAPE_NOTES } from "./shape";
import type { CreatedDraft, RunEvent, RunRequest, ScienceEntry } from "./types";

const TATIANA_PROMPT = `You are Tatiana-la-Criticona — the adversarial reviewer of JJ's GGOMed
editorial pipeline. You are given draft documents (full JSON) and the
science ledger behind them. Attack ruthlessly:
1. UNSOURCED CLAIMS — every clinical statement must trace to a ledger
   entry. List each one that does not, verbatim.
2. CLINICAL SAFETY — anything that could mislead a patient, understate a
   risk, or promise an outcome.
3. GMC/ADVERTISING COMPLIANCE — superlatives, guarantees, undeclared
   opinion presented as fact, missing "discuss with your surgeon" framing.
4. STRUCTURE — missing sections a UK patient needs (what/why/risks/next
   step), broken portable-text shapes, weak slugs or SEO fields.
Be specific and terse. Mark each finding BLOCKING or MINOR. If genuinely
clean, say APPROVED and why in two lines. Do not rewrite the content.`;

const ASPASIA_PROMPT = `You are Aspasia-multi-personalities — you stress-test GGOMed drafts by
reading them as five distinct patients:
1. ANXIOUS FIRST-TIMER (fears the worst, googles at 2am)
2. LOW HEALTH LITERACY (Year 9 reading level, no medical vocabulary)
3. TIME-POOR PROFESSIONAL (skims headings, wants the next step fast)
4. NON-NATIVE ENGLISH SPEAKER (idioms and figurative language lose them)
5. SCEPTICAL RESEARCHER (checks whether claims sound evidenced)
For each persona: one line on what works, one line on what fails. Then a
short list of concrete fixes ranked by impact. Judge tone against JJ's
voice: warm + blunt + precise, never corporate, never saccharine. Mark
each fix BLOCKING or MINOR. Do not rewrite the content.`;

const RUNNER_RULES = `You are La Casa di Ernesto — the generative module of JJ's GGOMed
operator cockpit. You write website content for ggomed.co.uk directly into
Sanity as DRAFTS, replacing the old copy-paste pipeline.

## Pipeline — work through these phases IN ORDER
Phase 0 — BERENICE (fresh science). For any clinical topic, use web_search
  to gather CURRENT guidance (guidelines, society statements, recent
  reviews — prefer UK/European: NICE, EAU, BAUS). Record each claim you
  will rely on with record_science (claim + source + URL). Drafts may make
  clinical statements ONLY from this ledger. Non-clinical briefs may skip
  this phase.
Phase 1 — GROUNDING. read_view("editorial-content") for the existing site
  and slug collisions; get_document on a good sibling page to copy real
  field usage.
Phase 2 — STESURA. One create_draft per document; JJ's voice per the skill.
Phase 3 — CRITICI. Call run_critics (Tatiana attacks accuracy/compliance
  against your ledger; Aspasia reads as five patient personas). This gate
  is MANDATORY — finish refuses until critics reviewed your latest state.
Phase 4 — REVISIONE. Fix blocking findings with update_draft, re-run
  critics, then finish with a review note for JJ (include the ledger).

## Operating rules
1. Everything you create is a draft. JJ reviews and publishes in the Studio —
   never claim something is "live" or "published".
2. One create_draft call per document. Wire references between your own
   drafts with update_draft.
3. Clinical accuracy is non-negotiable: never invent facts, figures,
   statistics or guideline citations. A claim without a ledger entry does
   not go in a draft. If a needed fact cannot be verified, write around it
   and flag "TODO: Clinical review required — <what is missing>" in your
   finish note.
4. British English throughout.`;

/** Vendored skill bundles live in-repo; COCKPIT_SKILLS_DIR can override. */
function loadSkill(skill: string): string {
    const roots = [join(process.cwd(), "skills"), runnerConfig.skillsDir];
    for (const root of roots) {
        const path = join(root, skill, "SKILL.md");
        if (existsSync(path)) {
            let text = readFileSync(path, "utf8");
            // Inline the reference files the skill leans on — including the
            // per-page-type style guides (that's where JJ's voice details live).
            const refDir = join(root, skill, "references");
            if (existsSync(refDir)) {
                for (const f of readdirSync(refDir, { recursive: true }) as string[]) {
                    const full = join(refDir, f);
                    if (f.endsWith(".md")) {
                        text += `\n\n---\n# reference: ${f}\n${readFileSync(full, "utf8")}`;
                    }
                }
            }
            return text;
        }
    }
    throw new Error(`Skill "${skill}" not found under ./skills or ${runnerConfig.skillsDir}`);
}

export const ALLOWED_SKILLS = ["ggomed-page-writer-v2"] as const;

export async function runSkill(
    req: RunRequest,
    emit: (event: RunEvent) => void,
    signal: AbortSignal
): Promise<void> {
    const runId = randomUUID();
    if (!(ALLOWED_SKILLS as readonly string[]).includes(req.skill)) {
        emit({ type: "run.error", message: `Skill "${req.skill}" is not allow-listed` });
        return;
    }

    const client = new Anthropic({ apiKey: runnerConfig.anthropicApiKey });
    const skillText = loadSkill(req.skill);

    // Stable prefix first (rules + shapes + skill), cache breakpoint on the
    // last stable block; the per-run brief goes in messages, after it.
    const system: Anthropic.TextBlockParam[] = [
        { type: "text", text: RUNNER_RULES },
        { type: "text", text: SHAPE_NOTES },
        {
            type: "text",
            text: `## Skill instructions (editorial guidance — output contract is create_draft, NOT parser HTML)\n\n${skillText}`,
            cache_control: { type: "ephemeral" },
        },
    ];

    const messages: Anthropic.MessageParam[] = [
        {
            role: "user",
            content: `BRIEF FROM JJ:\n\n${req.brief}\n\nWork autonomously: research the existing site with your tools, draft every needed document, wire references, then call finish. Do not ask questions — JJ reviews the drafts afterwards; flag uncertainties in the finish note.`,
        },
    ];

    /** Fresh-context critics: fetch the real draft docs, run both in parallel. */
    async function runCritics(drafts: CreatedDraft[], science: ScienceEntry[]) {
        const ids = drafts.map((d) => d.draftId);
        const docs = await ggomedRawClient.fetch(`*[_id in $ids]`, { ids });
        const ledger =
            science.length > 0
                ? science.map((s, i) => `${i + 1}. ${s.claim} — ${s.source} (${s.url})`).join("\n")
                : "(empty — no clinical claims should appear in the drafts)";
        const payload = `# SCIENCE LEDGER\n${ledger}\n\n# DRAFT DOCUMENTS (full JSON)\n${JSON.stringify(docs, null, 1).slice(0, 150_000)}`;
        const critic = async (system: string) => {
            const res = await client.messages.create(
                {
                    model: runnerConfig.model,
                    max_tokens: 8000,
                    thinking: { type: "adaptive" },
                    system,
                    messages: [{ role: "user", content: payload }],
                },
                { signal }
            );
            return res.content
                .filter((b): b is Anthropic.TextBlock => b.type === "text")
                .map((b) => b.text)
                .join("\n");
        };
        const [tatiana, aspasia] = await Promise.all([
            critic(TATIANA_PROMPT),
            critic(ASPASIA_PROMPT),
        ]);
        return { tatiana, aspasia };
    }

    const ctx: ToolContext = {
        drafts: [],
        finished: null,
        science: [],
        criticsCleared: false,
        runCritics,
        onScience: (s) => emit({ type: "science.recorded", ...s }),
        onVerdict: (critic, verdict) => emit({ type: "critics.verdict", critic, verdict }),
    };

    // web_search_20260209 runs code execution under the hood; once the
    // conversation carries that state, every following request must echo
    // the server-side container id or the API 400s ("container_id is
    // required when there are pending tool uses…").
    let containerId: string | undefined;
    emit({ type: "run.start", runId, skill: req.skill, model: runnerConfig.model });

    try {
        for (let turn = 1; turn <= runnerConfig.maxTurns; turn++) {
            if (signal.aborted) {
                emit({ type: "run.done", reason: "aborted", summary: "Aborted by JJ", draftIds: ctx.drafts.map((d) => d.draftId) });
                return;
            }
            emit({ type: "turn.start", turn });

            const stream = client.messages.stream(
                {
                    model: runnerConfig.model,
                    max_tokens: 64000,
                    thinking: { type: "adaptive" },
                    container: containerId,
                    system,
                    tools: [
                        // Berenice's research surface — server-side web search
                        { type: "web_search_20260209", name: "web_search", max_uses: 12 },
                        ...TOOL_DEFINITIONS,
                    ],
                    messages,
                },
                { signal }
            );
            stream.on("text", (delta) => emit({ type: "text", text: delta }));
            const message = await stream.finalMessage();
            containerId = message.container?.id ?? containerId;

            messages.push({ role: "assistant", content: message.content });

            const toolUses = message.content.filter(
                (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            if (toolUses.length === 0) {
                if (message.stop_reason === "pause_turn") continue;
                emit({
                    type: "run.done",
                    reason: ctx.finished ? "finished" : "finished",
                    summary: ctx.finished?.summary ?? "Model ended the run without calling finish.",
                    draftIds: ctx.drafts.map((d) => d.draftId),
                });
                return;
            }

            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const tool of toolUses) {
                const input = (tool.input ?? {}) as Record<string, unknown>;
                emit({ type: "tool.use", name: tool.name, summary: String(input.title ?? input.view ?? input.id ?? input.draftId ?? "") });
                let result;
                try {
                    result = await dispatchTool(tool.name, input, ctx);
                } catch (err) {
                    result = { ok: false, content: `Tool failed: ${err instanceof Error ? err.message : String(err)}`, summary: "error" };
                }
                emit({ type: "tool.result", name: tool.name, ok: result.ok, summary: result.summary });
                if (tool.name === "create_draft" && result.ok) {
                    const draft = ctx.drafts[ctx.drafts.length - 1];
                    emit({ type: "draft.created", ...draft });
                }
                results.push({
                    type: "tool_result",
                    tool_use_id: tool.id,
                    content: result.content,
                    is_error: !result.ok,
                });
            }
            messages.push({ role: "user", content: results });

            if (ctx.finished) {
                emit({
                    type: "run.done",
                    reason: "finished",
                    summary: ctx.finished.summary,
                    draftIds: ctx.drafts.map((d) => d.draftId),
                });
                return;
            }
        }
        emit({
            type: "run.done",
            reason: "max-turns",
            summary: `Stopped at the ${runnerConfig.maxTurns}-turn cap.`,
            draftIds: ctx.drafts.map((d) => d.draftId),
        });
    } catch (err) {
        if (signal.aborted) {
            emit({ type: "run.done", reason: "aborted", summary: "Aborted by JJ", draftIds: ctx.drafts.map((d) => d.draftId) });
            return;
        }
        emit({ type: "run.error", message: err instanceof Error ? err.message : String(err) });
    }
}

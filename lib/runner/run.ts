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
import { TOOL_DEFINITIONS, dispatchTool, type ToolContext } from "./tools";
import { SHAPE_NOTES } from "./shape";
import type { RunEvent, RunRequest } from "./types";

const RUNNER_RULES = `You are La Casa di Ernesto — the generative module of JJ's GGOMed
operator cockpit. You write website content for ggomed.co.uk directly into
Sanity as DRAFTS, replacing the old copy-paste pipeline.

Operating rules:
1. Everything you create is a draft. JJ reviews and publishes in the Studio —
   never claim something is "live" or "published".
2. Ground yourself first: read_view("editorial-content") to see what exists;
   get_document on a good sibling page to copy its real field usage.
3. One create_draft call per document. Wire references between your own
   drafts with update_draft. Call finish with a review note for JJ when done.
4. Clinical accuracy is non-negotiable: never invent facts, figures,
   statistics or guideline citations. If the brief needs a clinical fact you
   do not have, write the page around it and flag the gap in your finish note
   as "TODO: Clinical review required — <what is missing>".
5. British English throughout.`;

/** Vendored skill bundles live in-repo; COCKPIT_SKILLS_DIR can override. */
function loadSkill(skill: string): string {
    const roots = [join(process.cwd(), "skills"), runnerConfig.skillsDir];
    for (const root of roots) {
        const path = join(root, skill, "SKILL.md");
        if (existsSync(path)) {
            let text = readFileSync(path, "utf8");
            // Inline the reference files the skill leans on (they are small).
            const refDir = join(root, skill, "references");
            if (existsSync(refDir)) {
                for (const f of readdirSync(refDir)) {
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

    const ctx: ToolContext = { drafts: [], finished: null };
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
                    system,
                    tools: TOOL_DEFINITIONS,
                    messages,
                },
                { signal }
            );
            stream.on("text", (delta) => emit({ type: "text", text: delta }));
            const message = await stream.finalMessage();

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

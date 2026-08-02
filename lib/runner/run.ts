/**
 * La Casa di Ernesto — conversational generative runner (Family A).
 *
 * A run is a persistent SESSION of legs:
 *   leg 1: brief → Berenice research → grounding → present_proposal → PAUSE
 *   leg N: JJ chats (feedback/answers) → revise → re-present / draft
 *   after approval: stesura → critici → finish
 * Every leg streams NDJSON events AND journals them to .runs/<id>/ so the
 * log survives reloads and restarts until JJ archives the run.
 *
 * Hard gates in code: create_draft locked until JJ approves a proposal;
 * finish locked until critics reviewed the latest state; drafts.* only.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runnerConfig } from "../config";
import { draftEssence } from "../portable-text/preview";
import { ggomedRawClient } from "../sanity/clients";
import { TOOL_DEFINITIONS, FAMILY_B_TOOLS, dispatchTool, type SkillFamily, type ToolContext } from "./tools";
import { SHAPE_NOTES } from "./shape";
import * as store from "./store";
import type { CaptionItem, CreatedDraft, RunEvent, ScienceEntry } from "./types";

const RUNNER_RULES = `You are La Casa di Ernesto — the generative module of JJ's GGOMed
operator cockpit. You write website content for ggomed.co.uk directly into
Sanity as DRAFTS, replacing the old copy-paste pipeline. You work in a
CONVERSATION with JJ — he reviews, chats, and approves before anything
lands in Sanity.

## Pipeline — work through these phases IN ORDER
Phase 0 — BERENICE (fresh science). For any clinical topic, use web_search
  to gather CURRENT guidance (prefer UK/European: NICE, EAU, BAUS) and
  record each claim you will rely on with record_science.
Phase 1 — GROUNDING. read_view("editorial-content") for the existing site
  and slug collisions; get_document on a good sibling page.
Phase 2 — PROPOSTA (the review gate). present_proposal with:
  (a) the full prose plan/draft in markdown, (b) EVERY visual deliverable
  (svg-infographic = you build it in-page later; illustration/photo/canva/
  video = write a ready-to-paste generation prompt), (c) the interactive
  sections you plan. The run pauses. JJ replies with feedback (revise and
  re-present) or approval. create_draft is LOCKED until he approves.
  Use ask_jj at any point for a focused question.
Phase 3 — STESURA (after approval only). For pages (dedicatedPage/blogPost)
  author the content as parser-ready HTML per the parser-patterns reference
  and deliver it with create_draft_from_html (the site parser converts it —
  fix any warnings it returns). Approved svg-infographics go in its
  appendBlocks. Use plain create_draft for faqEntry and entities. Wire
  references between drafts with update_draft.
Phase 4 — CRITICI. run_critics (Tatiana + Aspasia) — mandatory; finish
  refuses until they reviewed your latest state.
Phase 5 — REVISIONE. Fix blocking findings, re-run critics, then finish
  with a review note for JJ (ledger, deliverables still to generate
  externally, what to check before publishing).

## Operating rules
1. Everything you create is a draft. JJ reviews and publishes in the Studio —
   never claim something is "live" or "published".
2. Clinical accuracy is non-negotiable: never invent facts, figures,
   statistics or guideline citations. Every specific figure must exist in
   your ledger. If a needed fact cannot be verified, write around it and
   flag "TODO: Clinical review required — <what is missing>".
3. When JJ gives feedback mid-conversation, treat it as authoritative —
   revise and re-present rather than defending the old plan.
4. British English throughout.`;

/** Vendored skill bundles live in-repo; COCKPIT_SKILLS_DIR can override. */
function loadSkill(skill: string): string {
    const roots = [join(process.cwd(), "skills"), runnerConfig.skillsDir];
    for (const root of roots) {
        const path = join(root, skill, "SKILL.md");
        if (existsSync(path)) {
            let text = readFileSync(path, "utf8");
            const refDir = join(root, skill, "references");
            if (existsSync(refDir)) {
                for (const f of readdirSync(refDir, { recursive: true }) as string[]) {
                    // parser-patterns.md is the authoring contract for
                    // create_draft_from_html — the vendored site parser
                    // consumes exactly that HTML. Keep it in.
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

export const SKILL_FAMILY: Record<string, SkillFamily> = {
    "ggomed-page-writer-v2": "A",
    "samantha-social-groupie": "B",
};
export const ALLOWED_SKILLS = Object.keys(SKILL_FAMILY);

const FAMILY_B_SYSTEM_NOTE = `## Family B scope (Samantha in-shell)
You are JJ's social content engine — captions for existing Calendar rows AND
creative proposals of your own.

CREATIVE AUTONOMY (encouraged): repurpose site pages into post series — use
read_view("editorial-content") to pick pages, get_document to read the full
page, then propose a series (angles, hooks, platform mix, proposed slots).
Seasonal ideas and multi-post arcs are welcome. Everything still flows
through the proposal gate.

PIF TRACEABILITY (mandatory): when a post derives from a page, ALWAYS set
sourceUrl on create_calendar_row. Check the source page's PIF state via
read_view("pif-ggomed"): if certified, apply the pif-tick-social rules from
your skill references; if NOT certified, never imply certification.

In-shell limits:
- NO Canva scanning — assets become deliverables (kind "canva"/"illustration")
  with a generation brief.
- Your proposal MUST include every caption+hashtag set in full — JJ approves
  the actual text, not a promise of it.
- write_caption (existing rows) and create_calendar_row (new posts, always
  Status=Draft) only after approval. NEVER touch Status/scheduling — that is
  JJ's flip in Notion.
- GMC guardrails apply to every caption; Tatiana will check compliance.`;

export interface LegInput {
    /** Start a new run. */
    brief?: string;
    skill?: string;
    /** Model for the run — cost/quality lever (Sonnet 5 ≈ 60% cheaper). */
    model?: string;
    /** Continue an existing run. */
    runId?: string;
    userMessage?: string;
    approve?: boolean;
}

export const ALLOWED_MODELS = ["claude-opus-4-8", "claude-sonnet-5"] as const;

/** USD per million tokens: [input, output]. Cache: read 0.1×in, write(1h) 2×in. */
const MODEL_RATES: Record<string, [number, number]> = {
    "claude-opus-4-8": [5, 25],
    "claude-sonnet-5": [3, 15],
};

function buildSystem(skill: string, family: SkillFamily): Anthropic.TextBlockParam[] {
    const skillText = loadSkill(skill);
    let infographic = "";
    try {
        infographic = loadSkill("ggomed-infographic");
    } catch {
        /* optional */
    }
    return [
        { type: "text", text: RUNNER_RULES },
        { type: "text", text: family === "B" ? FAMILY_B_SYSTEM_NOTE : SHAPE_NOTES },
        {
            type: "text",
            text:
                `## Skill instructions (voice + phases are guidance; page content is authored as parser-ready HTML per parser-patterns and delivered via create_draft_from_html)\n\n${skillText}` +
                (infographic
                    ? `\n\n---\n## Visual-asset guidance (for deliverables and in-page svgBlock infographics)\n\n${infographic}`
                    : ""),
            // 1h TTL: survives JJ's review pauses between legs — the 5-min
            // default expired every time and re-billed the whole ~50k-token
            // system prefix per leg (the single biggest cost leak).
            cache_control: { type: "ephemeral", ttl: "1h" },
        },
    ];
}

/**
 * Incremental history caching: strip stale markers, then mark the last
 * content block of the last message — each turn re-reads the cached prefix
 * (~0.1×) and pays full price only for the delta.
 */
function withHistoryCache(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
    const prepared = messages.map((m) => ({
        ...m,
        content:
            typeof m.content === "string"
                ? m.content
                : m.content.map((b) => {
                      if (typeof b === "object" && b !== null && "cache_control" in b) {
                          const { cache_control: _drop, ...rest } = b as unknown as Record<string, unknown>;
                          return rest as unknown as typeof b;
                      }
                      return b;
                  }),
    }));
    const last = prepared[prepared.length - 1];
    if (last && Array.isArray(last.content) && last.content.length > 0) {
        const blocks = last.content.slice();
        const tail = blocks[blocks.length - 1] as { type?: string } | null;
        if (tail && typeof tail === "object" && ["text", "tool_result", "tool_use", "image", "document"].includes(tail.type ?? "")) {
            blocks[blocks.length - 1] = { ...(tail as object), cache_control: { type: "ephemeral", ttl: "1h" } } as (typeof blocks)[number];
            prepared[prepared.length - 1] = { ...last, content: blocks };
        }
    }
    return prepared;
}

/** Run one leg of a session. Streams events via emit; persists everything. */
export async function runLeg(
    input: LegInput,
    emit: (event: RunEvent) => void,
    signal: AbortSignal
): Promise<void> {
    // ── Resolve or create the run ────────────────────────────────────────
    let meta: store.RunMeta;
    let messages: Anthropic.MessageParam[];

    if (input.runId) {
        if (!store.runExists(input.runId)) {
            emit({ type: "run.error", message: `Run ${input.runId} not found` });
            return;
        }
        meta = store.loadMeta(input.runId);
        if (meta.status === "archived") {
            emit({ type: "run.error", message: "Run archiviato — aprine uno nuovo" });
            return;
        }
        messages = store.loadMessages(input.runId);
        if (input.approve) {
            meta.proposalApproved = true;
        }
        const text = input.approve
            ? `APPROVAZIONE: JJ approva la proposta${input.userMessage ? ` con questa nota: ${input.userMessage}` : ""}. Procedi con la stesura (Phase 3).`
            : input.userMessage ?? "";
        if (!text.trim()) {
            emit({ type: "run.error", message: "Messaggio vuoto" });
            return;
        }
        messages.push({ role: "user", content: text });
        emit({ type: "jj.said", text });
    } else {
        const skill = input.skill ?? "";
        if (!(skill in SKILL_FAMILY)) {
            emit({ type: "run.error", message: `Skill "${skill}" is not allow-listed` });
            return;
        }
        if (!input.brief?.trim()) {
            emit({ type: "run.error", message: "Brief mancante" });
            return;
        }
        const runId = randomUUID();
        meta = {
            runId,
            skill,
            model: (ALLOWED_MODELS as readonly string[]).includes(input.model ?? "")
                ? input.model
                : runnerConfig.model,
            brief: input.brief,
            title: input.brief.slice(0, 80),
            status: "running",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            drafts: [],
            science: [],
            criticsCleared: false,
            proposalApproved: false,
            proposal: null,
            summary: null,
            turnsUsed: 0,
        };
        messages = [
            {
                role: "user",
                content: `BRIEF FROM JJ:\n\n${input.brief}\n\nStart the pipeline: research (Phase 0), ground yourself (Phase 1), then present_proposal (Phase 2) and wait for my input. Do not draft anything before my approval.`,
            },
        ];
        store.initRun(meta, messages);
    }

    if (!store.acquireLeg(meta.runId)) {
        emit({ type: "run.error", message: "Run già in esecuzione — aspetta che finisca il giro" });
        return;
    }

    const journal = (event: RunEvent) => {
        store.appendEvent(meta.runId, event);
        emit(event);
    };

    const client = new Anthropic({ apiKey: runnerConfig.anthropicApiKey });
    const family: SkillFamily = SKILL_FAMILY[meta.skill] ?? "A";
    const system = buildSystem(meta.skill, family);
    const runModel = meta.model || runnerConfig.model;

    // ── Live usage/cost counter (all legs + critics) ─────────────────────
    const usage = meta.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estCostUsd: 0,
    };
    meta.usage = usage;
    const addUsage = (u: Anthropic.Usage | undefined) => {
        if (!u) return;
        usage.inputTokens += u.input_tokens ?? 0;
        usage.outputTokens += u.output_tokens ?? 0;
        usage.cacheReadTokens += u.cache_read_input_tokens ?? 0;
        usage.cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
        const [inRate, outRate] = MODEL_RATES[runModel] ?? MODEL_RATES["claude-opus-4-8"];
        usage.estCostUsd =
            (usage.inputTokens * inRate +
                usage.outputTokens * outRate +
                usage.cacheReadTokens * inRate * 0.1 +
                usage.cacheWriteTokens * inRate * 2) /
            1_000_000;
        journal({ type: "usage", totals: { ...usage } });
    };

    async function runCritics(input: {
        family: SkillFamily;
        drafts: CreatedDraft[];
        science: ScienceEntry[];
        captions: CaptionItem[];
    }) {
        const { drafts, science, captions } = input;
        if (input.family === "B") {
            const capText = captions
                .map((c, i) => `### ${i + 1}. ${c.rowTitle}${c.platform ? ` (${c.platform})` : ""}\nCAPTION: ${c.caption}\nHASHTAGS: ${c.hashtags}`)
                .join("\n\n");
            const payloadB = `# CAPTIONS WRITTEN THIS RUN\n${capText}`;
            const criticB = async (sys: string) => {
                const res = await client.messages.create(
                    { model: runModel, max_tokens: 6000, thinking: { type: "adaptive" }, system: sys, messages: [{ role: "user", content: payloadB }] },
                    { signal }
                );
                addUsage(res.usage);
                return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
            };
            const [tatiana, aspasia] = await Promise.all([criticB(TATIANA_B_PROMPT), criticB(ASPASIA_B_PROMPT)]);
            return { tatiana, aspasia };
        }
        const ids = drafts.map((d) => d.draftId);
        const docs = (await ggomedRawClient.fetch(`*[_id in $ids]`, { ids })) as Record<string, unknown>[];
        const ledger =
            science.length > 0
                ? science.map((s, i) => `${i + 1}. ${s.claim} — ${s.source} (${s.url})`).join("\n")
                : "(empty — no clinical claims should appear in the drafts)";
        // Essence, not raw JSON: ~70% smaller critic input, same signal.
        const essence = docs.map((doc) => draftEssence(doc)).join("\n\n---\n\n");
        const payload = `# SCIENCE LEDGER\n${ledger}\n\n# DRAFTS (prose + governance extract)\n${essence.slice(0, 60_000)}`;
        const critic = async (sys: string) => {
            const res = await client.messages.create(
                { model: runModel, max_tokens: 8000, thinking: { type: "adaptive" }, system: sys, messages: [{ role: "user", content: payload }] },
                { signal }
            );
            addUsage(res.usage);
            return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
        };
        const [tatiana, aspasia] = await Promise.all([critic(TATIANA_PROMPT), critic(ASPASIA_PROMPT)]);
        return { tatiana, aspasia };
    }

    const ctx: ToolContext = {
        family,
        captions: meta.captions ?? [],
        drafts: meta.drafts,
        finished: null,
        science: meta.science,
        criticsCleared: meta.criticsCleared,
        proposalApproved: meta.proposalApproved,
        proposal: meta.proposal,
        pause: null,
        runCritics,
        onScience: (s) => journal({ type: "science.recorded", ...s }),
        onVerdict: (critic, verdict) => journal({ type: "critics.verdict", critic, verdict }),
    };

    const persist = (status: store.RunMeta["status"]) => {
        meta.status = status;
        meta.drafts = ctx.drafts;
        meta.science = ctx.science;
        meta.criticsCleared = ctx.criticsCleared;
        meta.captions = ctx.captions;
        meta.proposalApproved = ctx.proposalApproved;
        meta.proposal = ctx.proposal;
        if (ctx.finished) meta.summary = ctx.finished.summary;
        store.saveMeta(meta);
        store.saveMessages(meta.runId, messages);
    };

    meta.status = "running";
    store.saveMeta(meta);
    journal({ type: "run.start", runId: meta.runId, skill: meta.skill, model: runModel });

    let containerId: string | undefined;

    try {
        while (meta.turnsUsed < runnerConfig.maxTurns) {
            if (signal.aborted) {
                journal({ type: "run.done", reason: "aborted", summary: "Interrotto da JJ — riprendi scrivendo in chat", draftIds: ctx.drafts.map((d) => d.draftId) });
                persist("awaiting-jj");
                return;
            }
            meta.turnsUsed += 1;
            journal({ type: "turn.start", turn: meta.turnsUsed });

            const stream = client.messages.stream(
                {
                    model: runModel,
                    max_tokens: 64000,
                    thinking: { type: "adaptive" },
                    container: containerId,
                    system,
                    tools: [
                        { type: "web_search_20250305", name: "web_search", max_uses: 12 },
                        ...(family === "B"
                            ? [...TOOL_DEFINITIONS.filter((t) => !["create_draft", "create_draft_from_html", "update_draft"].includes(t.name)), ...FAMILY_B_TOOLS]
                            : TOOL_DEFINITIONS),
                    ],
                    messages: withHistoryCache(messages),
                },
                { signal }
            );
            stream.on("text", (delta) => journal({ type: "text", text: delta }));
            const message = await stream.finalMessage();
            addUsage(message.usage);
            containerId = message.container?.id ?? containerId;

            messages.push({ role: "assistant", content: message.content });

            const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

            if (toolUses.length === 0) {
                if (message.stop_reason === "pause_turn") continue;
                // Plain text end — treat as a message to JJ awaiting reply.
                journal({ type: "run.paused", reason: "question" });
                persist("awaiting-jj");
                return;
            }

            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const tool of toolUses) {
                const inputArgs = (tool.input ?? {}) as Record<string, unknown>;
                journal({ type: "tool.use", name: tool.name, summary: String(inputArgs.title ?? inputArgs.view ?? inputArgs.id ?? inputArgs.draftId ?? inputArgs.question ?? "") });
                let result;
                try {
                    result = await dispatchTool(tool.name, inputArgs, ctx);
                } catch (err) {
                    result = { ok: false, content: `Tool failed: ${err instanceof Error ? err.message : String(err)}`, summary: "error" };
                }
                journal({ type: "tool.result", name: tool.name, ok: result.ok, summary: result.summary });
                if (tool.name === "write_caption" && result.ok) {
                    journal({ type: "caption.written", item: ctx.captions[ctx.captions.length - 1] });
                }
                if (tool.name === "create_draft" && result.ok) {
                    journal({ type: "draft.created", ...ctx.drafts[ctx.drafts.length - 1] });
                }
                if (tool.name === "present_proposal" && result.ok && ctx.proposal) {
                    journal({ type: "proposal.presented", proposal: ctx.proposal });
                }
                if (tool.name === "ask_jj" && result.ok) {
                    journal({ type: "jj.asked", question: String(inputArgs.question ?? "") });
                }
                results.push({ type: "tool_result", tool_use_id: tool.id, content: result.content, is_error: !result.ok });
            }
            messages.push({ role: "user", content: results });

            if (ctx.pause) {
                journal({ type: "run.paused", reason: ctx.pause });
                persist("awaiting-jj");
                return;
            }
            if (ctx.finished) {
                journal({ type: "run.done", reason: "finished", summary: ctx.finished.summary, draftIds: ctx.drafts.map((d) => d.draftId) });
                persist("done");
                return;
            }
        }
        journal({ type: "run.done", reason: "max-turns", summary: `Cap di ${runnerConfig.maxTurns} turni raggiunto — scrivi in chat per continuare.`, draftIds: ctx.drafts.map((d) => d.draftId) });
        persist("awaiting-jj");
    } catch (err) {
        if (signal.aborted) {
            journal({ type: "run.done", reason: "aborted", summary: "Interrotto da JJ — riprendi scrivendo in chat", draftIds: ctx.drafts.map((d) => d.draftId) });
            persist("awaiting-jj");
            return;
        }
        journal({ type: "run.error", message: err instanceof Error ? err.message : String(err) });
        persist("error");
    } finally {
        store.releaseLeg(meta.runId);
    }
}

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


const TATIANA_B_PROMPT = `You are Tatiana-la-Criticona — adversarial reviewer of GGOMed SOCIAL
captions. You get the captions+hashtags written on Calendar rows. Attack:
1. GMC/ASA COMPLIANCE — no guarantees, no superlatives, no before/after
   implications, no trivialising surgery, no soliciting via fear; patient
   confidentiality; "results vary / discuss with your surgeon" framing where
   needed.
2. CLINICAL SAFETY — anything misleading or risk-understating in 200 chars.
3. PLATFORM FIT — length, hashtag count/quality, call-to-action sanity.
Mark each finding BLOCKING or MINOR per caption. If clean, say APPROVED in
two lines. Do not rewrite.`;

const ASPASIA_B_PROMPT = `You are Aspasia-multi-personalities — stress-test GGOMed social captions
as five followers: anxious patient, low health literacy, time-poor scroller,
non-native English speaker, sceptical researcher. Judge tone against JJ's
voice (warm + blunt + precise; never corporate, never clickbait). One line
per persona per caption where something fails; then fixes ranked by impact,
marked BLOCKING or MINOR. Do not rewrite.`;

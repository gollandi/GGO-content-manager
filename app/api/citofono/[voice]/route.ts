import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../../../../lib/auth/api-guard";
import { canWrite } from "../../../../lib/auth/roles";
import { VOICES, isVoiceId } from "../../../../lib/citofono/voices";

/**
 * IL CITOFONO — one streaming conversation leg with a room's voice.
 *
 * POST { messages: [{ role: "user" | "assistant", content: string }] }
 * → NDJSON stream: {type:"text",text} · {type:"tool",name} · {type:"done",usage} · {type:"error",message}
 *
 * Stateless by design: the client carries the transcript. Voices read their
 * room and may deposit a proposal (Content Needs); nothing else is writable.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.COCKPIT_CITOFONO_MODEL || "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 6;

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ voice: string }> }
) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const { voice } = await params;
    if (!isVoiceId(voice)) {
        return Response.json({ error: `Unknown voice "${voice}"` }, { status: 404 });
    }
    const spec = VOICES[voice];
    const isWriter = canWrite(auth.role);

    let body: { messages?: ChatMessage[] };
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const history = (body.messages ?? [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
        .slice(-30);
    if (history.length === 0 || history[history.length - 1].role !== "user") {
        return Response.json({ error: "Last message must be from JJ" }, { status: 400 });
    }

    const anthropic = new Anthropic();
    const tools = spec.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const emit = (event: Record<string, unknown>) =>
                controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

            const usage = { inputTokens: 0, outputTokens: 0 };
            // The Anthropic message list grows with tool_use/tool_result blocks.
            const messages: Anthropic.MessageParam[] = history.map((m) => ({
                role: m.role,
                content: m.content
            }));

            try {
                for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
                    const response = await anthropic.messages.create({
                        model: MODEL,
                        max_tokens: 1500,
                        system: spec.persona,
                        messages,
                        tools,
                        stream: true
                    });

                    const blocks: Anthropic.ContentBlock[] = [];
                    let stopReason: string | null = null;

                    for await (const chunk of response) {
                        if (chunk.type === "content_block_start") {
                            blocks[chunk.index] =
                                chunk.content_block.type === "tool_use"
                                    ? { ...chunk.content_block, input: {} }
                                    : { ...chunk.content_block };
                            if (chunk.content_block.type === "tool_use") {
                                emit({ type: "tool", name: chunk.content_block.name });
                                (blocks[chunk.index] as { _json?: string })._json = "";
                            }
                        } else if (chunk.type === "content_block_delta") {
                            const block = blocks[chunk.index];
                            if (chunk.delta.type === "text_delta" && block?.type === "text") {
                                block.text += chunk.delta.text;
                                emit({ type: "text", text: chunk.delta.text });
                            } else if (chunk.delta.type === "input_json_delta" && block?.type === "tool_use") {
                                (block as { _json?: string })._json += chunk.delta.partial_json;
                            }
                        } else if (chunk.type === "message_delta") {
                            stopReason = chunk.delta.stop_reason ?? stopReason;
                            usage.outputTokens += chunk.usage.output_tokens ?? 0;
                        } else if (chunk.type === "message_start") {
                            usage.inputTokens += chunk.message.usage.input_tokens ?? 0;
                        }
                    }

                    if (stopReason !== "tool_use") break;

                    // Execute the requested tools, then loop for the voice's reply.
                    const toolUses = blocks.filter(
                        (b): b is Anthropic.ToolUseBlock => b?.type === "tool_use"
                    );
                    // An empty text block (the model "clearing its throat" before a
                    // tool call) must not travel back — the API rejects it with 400
                    // "text content blocks must be non-empty".
                    const assistantContent = blocks
                        .map((b) => {
                            if (b.type === "tool_use") {
                                const raw = (b as { _json?: string })._json;
                                return {
                                    type: "tool_use" as const,
                                    id: b.id,
                                    name: b.name,
                                    input: raw ? JSON.parse(raw) : {}
                                };
                            }
                            return { type: "text" as const, text: b.type === "text" ? b.text : "" };
                        })
                        .filter((b) => b.type !== "text" || b.text.trim().length > 0);
                    messages.push({ role: "assistant", content: assistantContent });

                    const results: Anthropic.ToolResultBlockParam[] = [];
                    for (const use of toolUses) {
                        const tool = spec.tools.find((t) => t.name === use.name);
                        const raw = (use as { _json?: string })._json;
                        const input = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
                        let payload;
                        try {
                            payload = tool
                                ? await tool.run(input, { isWriter, voice })
                                : { ok: false, error: `Unknown tool ${use.name}` };
                        } catch (err) {
                            payload = { ok: false, error: err instanceof Error ? err.message : String(err) };
                        }
                        results.push({
                            type: "tool_result",
                            tool_use_id: use.id,
                            content: JSON.stringify(payload).slice(0, 40_000)
                        });
                    }
                    messages.push({ role: "user", content: results });
                }

                emit({ type: "done", usage });
            } catch (err) {
                emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "cache-control": "no-store"
        }
    });
}

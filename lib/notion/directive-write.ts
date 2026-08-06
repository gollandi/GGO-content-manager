/**
 * Operational directives for the agents' shared Desk.
 *
 * The cockpit never impersonates an agent or claims work on its behalf. It
 * can only file a precise, Pending work order; Ernesto's headless slots read
 * the same Desk after JJ has approved the row in the review gate.
 */
import { notion } from "./client";
import { notionConfig } from "../config";

export const DIRECTIVE_TYPES = [
  "question",
  "recommendation",
  "clip-script",
  "long-video-proposal",
  "publish-approval",
  "budget-request",
  "plan-proposal",
] as const;

export type DirectiveType = (typeof DIRECTIVE_TYPES)[number];

interface DeskDirectiveInput {
  title: string;
  instruction: string;
  agent: string;
  type: DirectiveType;
  priority: "Urgent" | "Normal" | "Low";
  mediaAssetIds?: string[];
}

function bodyBlocks(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 90)
    .flatMap((paragraph) => {
      const chunks: string[] = [];
      for (let start = 0; start < paragraph.length; start += 1990) {
        chunks.push(paragraph.slice(start, start + 1990));
      }
      return chunks.map((content) => ({
        object: "block" as const,
        type: "paragraph" as const,
        paragraph: { rich_text: [{ type: "text" as const, text: { content } }] },
      }));
    });
}

/** Create one approval-gated instruction in the house's canonical queue. */
export async function createDeskDirective(input: DeskDirectiveInput): Promise<string> {
  const title = input.title.trim();
  const instruction = input.instruction.trim();
  if (!title || !instruction || !input.agent.trim()) {
    throw new Error("title, instruction and agent are required");
  }
  if (!DIRECTIVE_TYPES.includes(input.type)) {
    throw new Error("invalid directive type");
  }

  const body = `Agent destinatario: ${input.agent.trim()}\n\nDirettiva di JJ:\n${instruction}`;
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.dbs.ernestoDesk() },
    properties: {
      Item: { title: [{ type: "text", text: { content: title.slice(0, 190) } }] },
      Type: { select: { name: input.type } },
      Status: { select: { name: "Pending" } },
      Priority: { select: { name: input.priority } },
      ...(input.mediaAssetIds?.length
        ? { "Media Assets": { relation: input.mediaAssetIds.map((id) => ({ id })) } }
        : {}),
    },
    children: bodyBlocks(body),
  });
  return page.id;
}

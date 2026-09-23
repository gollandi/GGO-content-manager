function childText(children: unknown): string {
    if (!Array.isArray(children)) return "";
    return children
        .map((child) => {
            if (typeof child !== "object" || child === null) return "";
            return String((child as { text?: unknown }).text ?? "");
        })
        .join("");
}

function walkPortableText(blocks: unknown): string {
    if (!Array.isArray(blocks)) return "";
    return blocks
        .map((blockLike) => {
            if (typeof blockLike !== "object" || blockLike === null) return "";
            const block = blockLike as Record<string, unknown>;
            switch (block._type) {
                case "block": {
                    const prefix = block.style && block.style !== "normal" ? `[${String(block.style)}] ` : "";
                    return prefix + childText(block.children);
                }
                case "accordionBlock": {
                    const items = Array.isArray(block.items) ? block.items : [];
                    const body = items
                        .map((itemLike) => {
                            if (typeof itemLike !== "object" || itemLike === null) return "";
                            const item = itemLike as Record<string, unknown>;
                            return `  - ${String(item.title ?? "")}\n${walkPortableText(item.content)}`;
                        })
                        .filter(Boolean)
                        .join("\n");
                    return `[accordion: ${String(block.title ?? "")}]\n${body}`.trim();
                }
                case "highlightBlock":
                case "infoBoxBlock":
                    return `[${String(block._type)}: ${String(block.title ?? "")}]\n${walkPortableText(block.content)}`.trim();
                case "faqInlineBlock":
                    return `[faqInlineBlock: ${(Array.isArray(block.faqs) ? block.faqs : []).length} FAQ refs]`;
                case "quizBlock":
                    return `[quiz: ${String(block.question ?? "")}]`;
                case "svgBlock":
                    return `[svg infographic: ${String(block.caption ?? "no caption")}]`;
                case "linkCardBlock":
                    return `[link card: ${String(block.title ?? "")} -> ${String(block.href ?? "")}]`;
                case "ctaBannerBlock":
                    return `[CTA: ${String(block.title ?? "")}]`;
                default:
                    return `[${String(block._type ?? "block")}]`;
            }
        })
        .filter(Boolean)
        .join("\n");
}

export function portableTextToPlainText(blocks: unknown): string {
    return walkPortableText(blocks);
}

export function draftEssence(doc: Record<string, unknown>, maxContentChars = 60_000): string {
    const governance = doc.pifTickGovernance as Record<string, unknown> | undefined;
    const references = Array.isArray(governance?.references)
        ? (governance.references as Record<string, unknown>[])
        : [];
    const refs = references
        .map((ref) => `- ${String(ref.title ?? "")} (${String(ref.source ?? "")} ${String(ref.url ?? "")})`)
        .join("\n");
    const content = doc.content ? portableTextToPlainText(doc.content).slice(0, maxContentChars) : "";
    return [
        `## ${String(doc._type ?? "document")}: ${String(doc.title ?? doc.name ?? doc.question ?? "(untitled)")}`,
        doc.slug ? `slug: ${JSON.stringify(doc.slug)}` : "",
        doc.description ? `description: ${String(doc.description)}` : "",
        doc.answer ? `answer: ${String(doc.answer)}` : "",
        content,
        refs ? `### references on doc\n${refs}` : "### references on doc\n(none)",
    ]
        .filter(Boolean)
        .join("\n");
}

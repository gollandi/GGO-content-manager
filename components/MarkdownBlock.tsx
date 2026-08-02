import type { ReactNode } from "react";

interface MarkdownBlockProps {
    content: string;
    className?: string;
}

type Block =
    | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
    | { type: "paragraph"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }
    | { type: "quote"; text: string }
    | { type: "code"; text: string };

function parseBlocks(content: string): Block[] {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const blocks: Block[] = [];
    let paragraph: string[] = [];
    let list: { type: "ul" | "ol"; items: string[] } | null = null;
    let code: string[] | null = null;

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        blocks.push({ type: "paragraph", text: paragraph.join(" ") });
        paragraph = [];
    };
    const flushList = () => {
        if (!list) return;
        blocks.push({ type: list.type, items: list.items });
        list = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.trim().startsWith("```")) {
            flushParagraph();
            flushList();
            if (code) {
                blocks.push({ type: "code", text: code.join("\n") });
                code = null;
            } else {
                code = [];
            }
            continue;
        }
        if (code) {
            code.push(rawLine);
            continue;
        }
        if (!line.trim()) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = /^(#{1,4})\s+(.+)$/.exec(line);
        if (heading) {
            flushParagraph();
            flushList();
            blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3 | 4, text: heading[2] });
            continue;
        }

        const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
        if (unordered) {
            flushParagraph();
            if (!list || list.type !== "ul") {
                flushList();
                list = { type: "ul", items: [] };
            }
            list.items.push(unordered[1]);
            continue;
        }

        const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
        if (ordered) {
            flushParagraph();
            if (!list || list.type !== "ol") {
                flushList();
                list = { type: "ol", items: [] };
            }
            list.items.push(ordered[1]);
            continue;
        }

        const quote = /^\s*>\s?(.+)$/.exec(line);
        if (quote) {
            flushParagraph();
            flushList();
            blocks.push({ type: "quote", text: quote[1] });
            continue;
        }

        flushList();
        paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    if (code) blocks.push({ type: "code", text: code.join("\n") });
    return blocks;
}

function inlineMarkdown(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const token = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = token.exec(text))) {
        if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
        const value = match[0];
        if (value.startsWith("**")) {
            nodes.push(<strong key={nodes.length}>{value.slice(2, -2)}</strong>);
        } else if (value.startsWith("`")) {
            nodes.push(<code key={nodes.length} className="px-1 py-0.5 rounded bg-surface-muted font-mono text-[0.9em]">{value.slice(1, -1)}</code>);
        } else {
            const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
            const href = link?.[2] ?? "";
            const isExternal = /^https?:\/\//.test(href);
            nodes.push(
                <a
                    key={nodes.length}
                    href={href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noreferrer" : undefined}
                    className="font-semibold text-ggo-teal hover:underline"
                >
                    {link?.[1] ?? value}
                </a>
            );
        }
        cursor = match.index + value.length;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
}

export default function MarkdownBlock({ content, className }: MarkdownBlockProps) {
    const blocks = parseBlocks(content);

    return (
        <div className={`space-y-3 leading-relaxed ${className ?? ""}`}>
            {blocks.map((block, index) => {
                if (block.type === "heading") {
                    const classes = block.level === 1
                        ? "text-xl font-bold tracking-tight"
                        : block.level === 2
                          ? "text-lg font-bold tracking-tight"
                          : "text-base font-bold";
                    const Tag = (`h${block.level}`) as "h1" | "h2" | "h3" | "h4";
                    return <Tag key={index} className={`${classes} mt-4 first:mt-0`}>{inlineMarkdown(block.text)}</Tag>;
                }
                if (block.type === "ul") {
                    return (
                        <ul key={index} className="list-disc pl-5 space-y-1">
                            {block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}
                        </ul>
                    );
                }
                if (block.type === "ol") {
                    return (
                        <ol key={index} className="list-decimal pl-5 space-y-1">
                            {block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}
                        </ol>
                    );
                }
                if (block.type === "quote") {
                    return <blockquote key={index} className="border-l border-ggo-teal/50 pl-3 text-muted-foreground">{inlineMarkdown(block.text)}</blockquote>;
                }
                if (block.type === "code") {
                    return <pre key={index} className="overflow-x-auto bg-plate p-3 text-xs text-plate-foreground"><code>{block.text}</code></pre>;
                }
                return <p key={index}>{inlineMarkdown(block.text)}</p>;
            })}
        </div>
    );
}

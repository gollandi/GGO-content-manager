import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Shared, null-safe Notion property extractors for the editorial layer.
 * (The originals in mappers.ts are module-private; these are the exported
 * equivalents, plus a title finder that survives property renames.)
 */

type Props = PageObjectResponse["properties"];
type Prop = Props[string] | undefined;

export const prop = (props: Props, key: string): Prop => props[key];

export const title = (p: Prop): string =>
    p?.type === "title" ? (p.title[0]?.plain_text ?? "") : "";

/** Find the title property whatever it is named — rename-proof. */
export const anyTitle = (props: Props): string => {
    for (const key of Object.keys(props)) {
        const p = props[key];
        if (p?.type === "title") return p.title[0]?.plain_text ?? "";
    }
    return "";
};

export const richText = (p: Prop): string =>
    p?.type === "rich_text" ? p.rich_text.map((t) => t.plain_text).join("") : "";

export const select = (p: Prop): string | null =>
    p?.type === "select" ? (p.select?.name ?? null) : null;

/** Notion `status`-type property — NOT the same as select (spec S1.2). */
export const status = (p: Prop): string | null =>
    p?.type === "status" ? (p.status?.name ?? null) : null;

/** Select-or-status — for DBs where the type differs between environments. */
export const selectOrStatus = (p: Prop): string | null =>
    select(p) ?? status(p);

export const multiSelect = (p: Prop): string[] =>
    p?.type === "multi_select" ? p.multi_select.map((s) => s.name) : [];

export const date = (p: Prop): string | null =>
    p?.type === "date" ? (p.date?.start ?? null) : null;

export const checkbox = (p: Prop): boolean =>
    p?.type === "checkbox" ? p.checkbox : false;

export const url = (p: Prop): string | null =>
    p?.type === "url" ? p.url : null;

export const number = (p: Prop): number | null =>
    p?.type === "number" ? p.number : null;

export const relationIds = (p: Prop): string[] =>
    p?.type === "relation" ? p.relation.map((r) => r.id) : [];

export const formulaString = (p: Prop): string | null =>
    p?.type === "formula" && p.formula.type === "string"
        ? p.formula.string
        : null;

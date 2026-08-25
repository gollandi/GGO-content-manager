/**
 * Field-level pre/post delta between a Sanity draft and its published
 * counterpart — the data behind the Daria register (/editorial/daria).
 *
 * Values are flattened to comparable plain text: Portable Text through the
 * existing preview walker, slugs to their current value, nested objects to
 * "key: value" lines. System fields (underscore-prefixed) never compare.
 */
import { portableTextToPlainText } from "../portable-text/preview";

export type FieldDelta = {
    field: string;
    kind: "added" | "removed" | "changed";
    pre: string;
    post: string;
};

const isSystemKey = (key: string) => key.startsWith("_");

const isPortableText = (value: unknown[]): boolean =>
    value.some((v) => typeof v === "object" && v !== null && "_type" in (v as object));

export const toComparableText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
        if (isPortableText(value)) return portableTextToPlainText(value);
        return value.map(toComparableText).filter(Boolean).join("\n");
    }
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (typeof obj.current === "string") return obj.current; // slug
        return Object.keys(obj)
            .filter((k) => !isSystemKey(k))
            .sort()
            .map((k) => {
                const text = toComparableText(obj[k]);
                return text ? `${k}: ${text}` : "";
            })
            .filter(Boolean)
            .join("\n");
    }
    return "";
};

/**
 * Changed fields only, in the draft's own key order (published-only fields
 * follow). `published` may be null: a draft with no published counterpart
 * reports every non-empty field as added.
 */
export const computeDocDelta = (
    draft: Record<string, unknown>,
    published: Record<string, unknown> | null
): FieldDelta[] => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const k of [...Object.keys(draft), ...Object.keys(published ?? {})]) {
        if (!isSystemKey(k) && !seen.has(k)) {
            seen.add(k);
            keys.push(k);
        }
    }
    const deltas: FieldDelta[] = [];
    for (const field of keys) {
        const pre = toComparableText(published?.[field]);
        const post = toComparableText(draft[field]);
        if (pre === post) continue;
        deltas.push({
            field,
            kind: pre === "" ? "added" : post === "" ? "removed" : "changed",
            pre,
            post,
        });
    }
    return deltas;
};

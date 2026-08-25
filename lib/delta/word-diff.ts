/**
 * Plain-text diff for the pre/post register — no dependency.
 *
 * Two passes keep quadratic LCS cheap on page-sized prose: paragraphs are
 * aligned first, then words only inside replaced paragraph pairs. A pair
 * beyond WORD_CAP words is shown as a whole-paragraph replacement rather
 * than paying an oversized DP table.
 */

export type DiffSegment = { kind: "same" | "add" | "del"; text: string };

const WORD_CAP = 800;

type Op = { kind: "same" | "add" | "del"; item: string };

/** Standard LCS backtrack over two string arrays. */
const diffArrays = (a: string[], b: string[]): Op[] => {
    const n = a.length;
    const m = b.length;
    const table: Uint32Array = new Uint32Array((n + 1) * (m + 1));
    const at = (i: number, j: number) => i * (m + 1) + j;
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            table[at(i, j)] =
                a[i] === b[j]
                    ? table[at(i + 1, j + 1)] + 1
                    : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
        }
    }
    const ops: Op[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ kind: "same", item: a[i] });
            i += 1;
            j += 1;
        } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
            ops.push({ kind: "del", item: a[i] });
            i += 1;
        } else {
            ops.push({ kind: "add", item: b[j] });
            j += 1;
        }
    }
    while (i < n) { ops.push({ kind: "del", item: a[i] }); i += 1; }
    while (j < m) { ops.push({ kind: "add", item: b[j] }); j += 1; }
    return ops;
};

/** Merge adjacent segments of the same kind. */
const push = (segments: DiffSegment[], kind: DiffSegment["kind"], text: string): void => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += text;
    else segments.push({ kind, text });
};

/** Word-level diff; whitespace is kept as tokens so spacing survives. */
export const diffWords = (pre: string, post: string): DiffSegment[] => {
    const tokens = (s: string) => s.split(/(\s+)/).filter((t) => t !== "");
    const a = tokens(pre);
    const b = tokens(post);
    const segments: DiffSegment[] = [];
    if (a.length > WORD_CAP || b.length > WORD_CAP) {
        push(segments, "del", pre);
        push(segments, "add", post);
        return segments;
    }
    for (const op of diffArrays(a, b)) push(segments, op.kind, op.item);
    return segments;
};

/**
 * Paragraph-aligned diff of two plain texts. Deleted and inserted paragraph
 * runs that face each other are paired in order and word-diffed; the rest
 * surface as whole-paragraph removals/additions. Newlines stay inside the
 * segment text, so the result renders with `whitespace-pre-wrap`.
 */
export const diffText = (pre: string, post: string): DiffSegment[] => {
    if (pre === post) return pre ? [{ kind: "same", text: pre }] : [];
    const ops = diffArrays(pre.split("\n"), post.split("\n"));
    const segments: DiffSegment[] = [];
    // Separators are attributed per side, so dropping "del" segments rebuilds
    // post exactly and dropping "add" segments rebuilds pre exactly.
    let preStarted = false;
    let postStarted = false;
    let dels: string[] = [];
    let adds: string[] = [];

    const sep = (inPre: boolean, inPost: boolean) => {
        if (inPre && preStarted && inPost && postStarted) {
            push(segments, "same", "\n");
        } else {
            if (inPre && preStarted) push(segments, "del", "\n");
            if (inPost && postStarted) push(segments, "add", "\n");
        }
    };

    const flush = () => {
        const pairs = Math.min(dels.length, adds.length);
        for (let k = 0; k < pairs; k += 1) {
            sep(true, true);
            for (const seg of diffWords(dels[k], adds[k])) push(segments, seg.kind, seg.text);
            preStarted = true;
            postStarted = true;
        }
        for (let k = pairs; k < dels.length; k += 1) {
            sep(true, false);
            push(segments, "del", dels[k]);
            preStarted = true;
        }
        for (let k = pairs; k < adds.length; k += 1) {
            sep(false, true);
            push(segments, "add", adds[k]);
            postStarted = true;
        }
        dels = [];
        adds = [];
    };

    for (const op of ops) {
        if (op.kind === "same") {
            flush();
            sep(true, true);
            push(segments, "same", op.item);
            preStarted = true;
            postStarted = true;
        } else if (op.kind === "del") {
            dels.push(op.item);
        } else {
            adds.push(op.item);
        }
    }
    flush();
    return segments;
};

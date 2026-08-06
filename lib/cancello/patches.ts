/**
 * Prepared website patches — READ-ONLY view over the patch store that
 * ernesto-agents-house's Edmondo cycles write to disk.
 *
 * The cockpit never applies a patch in-process: applying is the job of the
 * house's own `operations/website-patch.js` CLI (single source of truth,
 * shared with the crons), invoked one-shot by the decision route. Here we
 * only read the specs to show JJ what a seal would apply, plus the same
 * fingerprint test the applier uses, so an already-applied patch stops
 * asking for a decision.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ernestoHouseDir } from "./house";

export interface PatchOperation {
    type: string;
    anchorText?: string;
    newText?: string;
    blocks?: { _key?: string }[];
}

export interface PreparedPatch {
    id: string;
    title?: string;
    rationale?: string;
    sources?: string[];
    operations: PatchOperation[];
    sanityDocId: string;
    contentAssetId?: string;
    contentField?: string;
    batch: string;
    file: string;
}

export function patchRoot(): string {
    return join(ernestoHouseDir(), "docs", "edmondo-patches");
}

export function loadPatches(root = patchRoot()): PreparedPatch[] {
    if (!existsSync(root)) return [];
    const patches: PreparedPatch[] = [];
    for (const batch of readdirSync(root).sort()) {
        const dir = join(root, batch);
        let files: string[];
        try {
            files = readdirSync(dir).filter((f) => f.endsWith(".json"));
        } catch {
            continue; // not a directory
        }
        for (const file of files.sort()) {
            try {
                const spec = JSON.parse(readFileSync(join(dir, file), "utf-8"));
                patches.push({ ...spec, batch, file });
            } catch { /* an unreadable spec is skipped, not fatal */ }
        }
    }
    return patches;
}

export function findPatchForAsset(assetId: string | null | undefined): PreparedPatch | null {
    if (!assetId) return null;
    const normalised = String(assetId).replace(/-/g, "");
    return (
        loadPatches().find(
            (p) => String(p.contentAssetId || "").replace(/-/g, "") === normalised
        ) || null
    );
}

/**
 * Deterministic "already applied" test — inserted blocks carry patch-derived
 * `_key`s, replacements leave their `newText` behind. Mirrors the applier's
 * own check so the register and the CLI agree.
 */
export function patchAlreadyApplied(
    doc: Record<string, unknown> | null | undefined,
    patch: PreparedPatch,
    field = "content"
): boolean {
    if (!doc || !Array.isArray(doc[field])) return false;

    const keys = new Set<string>();
    const texts: string[] = [];
    const collect = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (node && typeof node === "object") {
            const n = node as Record<string, unknown>;
            if (typeof n._key === "string") keys.add(n._key);
            if (n._type === "block" && Array.isArray(n.children)) {
                texts.push(
                    (n.children as { text?: string }[]).map((c) => c.text || "").join("").trim()
                );
            }
            for (const k of Object.keys(n)) collect(n[k]);
        }
    };
    collect(doc[field]);

    return patch.operations.every((op) => {
        if (op.blocks?.length) return op.blocks.every((b) => b._key !== undefined && keys.has(b._key));
        if (op.type === "replace-text" && op.newText) return texts.includes(op.newText.trim());
        return false;
    });
}

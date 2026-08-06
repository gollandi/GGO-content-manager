/**
 * Il Cancello — local media path guards.
 *
 * Ported from ernesto-agents-house tools/review-dashboard/server.js so the
 * cockpit can serve JJ's local reels and stills itself, without the resident
 * loopback service. The contract is unchanged: only files under JJ's own
 * media trees are ever readable, path traversal and symlink escapes included.
 */
import path from "node:path";
import os from "node:os";

export const SAFE_MEDIA_ROOTS = [
    path.join(os.homedir(), "GGOMed"),
    path.join(os.homedir(), "Movies"),
];

export const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".webm"]);
export const VIDEO_MIME: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
};

export const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
export const IMAGE_MIME: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
};

/** True iff `candidate` resolves inside one of the safe roots. */
export function isPathWithinRoots(candidate: string, roots: string[] = SAFE_MEDIA_ROOTS): boolean {
    const resolved = path.resolve(candidate);
    return roots.some((root) => {
        const r = path.resolve(root);
        return resolved === r || resolved.startsWith(r + path.sep);
    });
}

const VIDEO_URL_RE = /file:\/\/(\/[^\s<>"]+\.(?:mp4|mov|m4v|webm))/gi;

/** Every distinct local video path referenced in `text`, order-preserving. */
export function extractVideoPaths(text: string | null | undefined): string[] {
    if (!text) return [];
    const seen = new Set<string>();
    for (const m of text.matchAll(VIDEO_URL_RE)) {
        let p = m[1];
        try { p = decodeURIComponent(p); } catch { /* keep raw */ }
        if (!seen.has(p)) seen.add(p);
    }
    return [...seen];
}

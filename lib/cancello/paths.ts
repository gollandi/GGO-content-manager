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

/**
 * On the Mac the roots are JJ's own media trees. On the VPS the same assets
 * arrive under /srv/ggomed-media via the referenced-media sync job, and the
 * Mac-absolute paths recorded in Notion are remapped onto it. Both are
 * env-overridable (COCKPIT_MEDIA_ROOTS, COCKPIT_MEDIA_REMAP) — the Linux
 * defaults below make the VPS work with zero extra configuration.
 */
const LINUX_MEDIA_ROOT = "/srv/ggomed-media";

export const SAFE_MEDIA_ROOTS = process.env.COCKPIT_MEDIA_ROOTS
    ? process.env.COCKPIT_MEDIA_ROOTS.split(":").filter(Boolean)
    : process.platform === "linux"
        ? [LINUX_MEDIA_ROOT]
        : [
            path.join(os.homedir(), "GGOMed"),
            path.join(os.homedir(), "Movies"),
        ];

/** "from=to,from=to" prefix rewrites applied before any filesystem access. */
const MEDIA_REMAPS: [string, string][] = (
    process.env.COCKPIT_MEDIA_REMAP
        ? process.env.COCKPIT_MEDIA_REMAP.split(",")
        : process.platform === "linux"
            // macOS openrsync keeps the full source path under the sync
            // root, so the recorded path is simply prefixed.
            ? [`/Users/jj-macstudio=${LINUX_MEDIA_ROOT}/Users/jj-macstudio`]
            : []
)
    .map((pair) => pair.split("=") as [string, string])
    .filter((pair) => pair.length === 2 && pair[0] && pair[1]);

/**
 * Where a recorded (Mac-absolute) media path actually lives on THIS host.
 * Identity on the Mac; on the VPS it lands under the synced tree. URLs keep
 * the recorded path, so they stay portable across both cockpits.
 */
export function resolveLocalMediaPath(recorded: string): string {
    for (const [from, to] of MEDIA_REMAPS) {
        if (recorded === from || recorded.startsWith(from + "/")) {
            return to + recorded.slice(from.length);
        }
    }
    return recorded;
}

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

import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

/**
 * The library: internal reference documents the cockpit hands to signed-in
 * people. The files are NOT in this repository (it is public, they are
 * internal): they sit beside the auth store, outside the deploy tree, and
 * are placed there by hand (docs/DEPLOY-REMOTE.md, "The library").
 *
 * A fixed table, never a path from the request: an id that is not listed
 * here does not exist.
 */
export interface LibraryDocument {
    file: string;
    contentType: string;
    /** "inline" opens in the browser; "attachment" downloads. */
    disposition: "inline" | "attachment";
}

export const LIBRARY: Readonly<Record<string, LibraryDocument>> = Object.freeze({
    "social-media-guide": { file: "GGO-Med-Social-Media-Guide.html", contentType: "text/html; charset=utf-8", disposition: "inline" },
    "social-media-guide.pdf": { file: "GGO-Med-Social-Media-Guide.pdf", contentType: "application/pdf", disposition: "attachment" },
});

export function libraryDir(): string {
    if (process.env.COCKPIT_LIBRARY_DIR) return process.env.COCKPIT_LIBRARY_DIR;
    if (process.env.COCKPIT_SNAPSHOT_DIR) return path.join(process.env.COCKPIT_SNAPSHOT_DIR, "library");
    return path.join(process.cwd(), ".runs", "library");
}

export type LibraryRead =
    | { kind: "ok"; document: LibraryDocument; body: Buffer }
    | { kind: "unknown" }
    | { kind: "missing"; document: LibraryDocument };

/** Read one listed document. "missing" means it is listed but not on this server. */
export function readDocument(id: string): LibraryRead {
    const document = Object.prototype.hasOwnProperty.call(LIBRARY, id) ? LIBRARY[id] : undefined;
    if (!document) return { kind: "unknown" };
    const full = path.join(libraryDir(), document.file);
    if (!existsSync(full) || !statSync(full).isFile()) return { kind: "missing", document };
    return { kind: "ok", document, body: readFileSync(full) };
}

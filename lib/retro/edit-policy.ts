/** Solo la conoscenza editoriale e' auto-migliorabile dall'Officina. */
const EDIT_ALLOWLIST = [/^skills\/[^/]+\/(SKILL\.md|references\/.+\.md)$/, /^lib\/runner\/shape\.ts$/];

export function pathAllowed(file: string): boolean {
    return EDIT_ALLOWLIST.some((rx) => rx.test(file));
}

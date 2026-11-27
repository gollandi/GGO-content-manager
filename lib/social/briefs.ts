/**
 * Pure rules for a collaborator's briefs to the house: how a request from
 * the Briefs room becomes a board event. Kept pure so it is tested apart
 * from the store and the route.
 */
import type { ComposeInput } from "../board/store";

export type BriefKind = "brief" | "strategy";

/** Specialists with no slot of their own: Ernesto runs them, so he must read the brief too. */
export const RUN_BY_ERNESTO = ["samantha", "greta", "titti"] as const;

export interface BriefRequest {
    mode: "open" | "reply" | "close";
    kind?: BriefKind;
    title?: string;
    threadId?: string;
    to?: string[];
    body?: string;
}

export class BriefError extends Error {}

export function slugify(title: string): string {
    return title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
}

/**
 * Recipients as the house will see them: routed through Ernesto where
 * needed; a strategy always to Ernesto, and to JJ, so a standing order over
 * the house's social plan never governs without reaching his inbox.
 */
export function routeRecipients(to: string[], kind: BriefKind, allowed: readonly string[]): string[] {
    const list = [...new Set(to.map((r) => String(r).trim().toLowerCase()).filter(Boolean))];
    for (const r of list) if (!allowed.includes(r)) throw new BriefError(`Non puoi scrivere a "${r}".`);
    if (kind === "strategy" || list.some((r) => (RUN_BY_ERNESTO as readonly string[]).includes(r))) {
        if (!list.includes("ernesto")) list.unshift("ernesto");
    }
    if (kind === "strategy" && !list.includes("jj")) list.push("jj");
    if (list.length === 0) throw new BriefError("Scegli almeno un destinatario.");
    return list;
}

// The house board takes Italian or English and checks the tag against the
// text (house-board.js assertLanguage). She may write either: the tag follows
// what she wrote, counted on the same common words the board looks for.
const IT_WORDS = new Set(["il", "lo", "la", "gli", "le", "di", "che", "non", "per", "con", "una", "uno", "sono", "del", "della", "nel", "nella", "questo", "questa", "anche", "ma", "come", "se", "ho", "ha", "è", "e", "al", "alla", "dei", "delle", "perché", "più", "già"]);
const EN_WORDS = new Set(["the", "of", "and", "to", "is", "in", "that", "it", "for", "on", "with", "this", "was", "are", "not", "be", "have", "has", "we", "i", "you", "a", "an", "but", "from", "what", "which", "there"]);
export function langOf(text: string): "it" | "en" {
    const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
    const it = words.filter((w) => IT_WORDS.has(w)).length;
    const en = words.filter((w) => EN_WORDS.has(w)).length;
    return en > it ? "en" : "it";
}

/** Turn the room's request into the board writer's input. `n` disambiguates ids within a second. */
export function toCompose(req: BriefRequest, handle: string, allowed: readonly string[], now: Date, n = Math.floor(Math.random() * 1e6)): ComposeInput {
    const stamp = now.toISOString();
    const compact = stamp.replace(/[-:TZ.]/g, "").slice(0, 14);
    const body = String(req.body ?? "").trim();
    if (req.mode === "close") {
        if (!req.threadId) throw new BriefError("Quale conversazione?");
        return { mode: "close", id: `${handle}-${compact}-${n}`, date: stamp, threadId: req.threadId, lang: body ? langOf(body) : "it", body: body || "Chiuso: fatto da parte mia." };
    }
    if (!body) throw new BriefError("Prima scrivi il brief.");
    if (body.length > 4000) throw new BriefError("Tieni il brief sotto i 4.000 caratteri; per di più, metti il link a un documento.");
    const kind: BriefKind = req.kind === "strategy" ? "strategy" : "brief";
    if (req.mode === "reply") {
        if (!req.threadId) throw new BriefError("Quale conversazione?");
        return { mode: "reply", id: `${handle}-${compact}-${n}`, date: stamp, threadId: req.threadId,
            to: routeRecipients(req.to ?? [], "brief", allowed), lang: langOf(body), body };
    }
    const slug = slugify(req.title ?? "");
    if (slug.length < 3) throw new BriefError("Dai al brief un titolo breve.");
    return {
        mode: "open",
        id: `${handle}-${compact}-${n}`,
        date: stamp,
        threadId: `${kind}-${handle}-${slug}-${compact}`,
        to: routeRecipients(req.to ?? [], kind, allowed),
        lang: langOf(`${req.title ?? ""} ${body}`),
        body: req.title ? `${String(req.title).trim()}\n\n${body}` : body,
        tags: kind === "strategy" ? ["strategy", "social"] : ["brief", "social"],
    };
}

/** The outline a strategy is written against; the room pre-fills it. */
export const STRATEGY_OUTLINE = [
    "Objective:",
    "Audience:",
    "Channels:",
    "Period:",
    "Cadence:",
    "Themes:",
    "Measures of success:",
    "Out of bounds:",
].join("\n");

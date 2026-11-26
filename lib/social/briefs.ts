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
    for (const r of list) if (!allowed.includes(r)) throw new BriefError(`You cannot address "${r}".`);
    if (kind === "strategy" || list.some((r) => (RUN_BY_ERNESTO as readonly string[]).includes(r))) {
        if (!list.includes("ernesto")) list.unshift("ernesto");
    }
    if (kind === "strategy" && !list.includes("jj")) list.push("jj");
    if (list.length === 0) throw new BriefError("Choose at least one recipient.");
    return list;
}

/** Turn the room's request into the board writer's input. `n` disambiguates ids within a second. */
export function toCompose(req: BriefRequest, handle: string, allowed: readonly string[], now: Date, n = Math.floor(Math.random() * 1e6)): ComposeInput {
    const stamp = now.toISOString();
    const compact = stamp.replace(/[-:TZ.]/g, "").slice(0, 14);
    const body = String(req.body ?? "").trim();
    if (req.mode === "close") {
        if (!req.threadId) throw new BriefError("Which thread?");
        return { mode: "close", id: `${handle}-${compact}-${n}`, date: stamp, threadId: req.threadId, lang: "en", body: body || "Closed: done on my side." };
    }
    if (!body) throw new BriefError("Write the brief first.");
    if (body.length > 4000) throw new BriefError("Keep a brief under 4,000 characters; link to a document for more.");
    const kind: BriefKind = req.kind === "strategy" ? "strategy" : "brief";
    if (req.mode === "reply") {
        if (!req.threadId) throw new BriefError("Which thread?");
        return { mode: "reply", id: `${handle}-${compact}-${n}`, date: stamp, threadId: req.threadId,
            to: routeRecipients(req.to ?? [], "brief", allowed), lang: "en", body };
    }
    const slug = slugify(req.title ?? "");
    if (slug.length < 3) throw new BriefError("Give the brief a short title.");
    return {
        mode: "open",
        id: `${handle}-${compact}-${n}`,
        date: stamp,
        threadId: `${kind}-${handle}-${slug}-${compact}`,
        to: routeRecipients(req.to ?? [], kind, allowed),
        lang: "en",
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

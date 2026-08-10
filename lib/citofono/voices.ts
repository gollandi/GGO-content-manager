/**
 * IL CITOFONO — the house intercom.
 *
 * Each room has a resident voice JJ can ring: it converses, reads the real
 * state of its own room, and may DEPOSIT A PROPOSAL into Content Needs.
 * Powers are deliberately bounded:
 *   - voices never publish, never touch Sanity, never write workflow state;
 *   - Ambrogio is read-only BY CONSTRUCTION: no proposal tool, and this app
 *     holds no write path to his databases (asserted in tests). This file in
 *     particular contains no Notion write at all — the one write the intercom
 *     may perform lives in ./tools/deposita-proposta.ts, so that a reader can
 *     confirm the boundary from this file alone rather than by tracing arrays;
 *   - every action beyond a proposal goes through the existing channels
 *     (Ernesto's runner, Il Cancello, the skills).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getEditorialContent } from "../views";
import {
    getTopicPool,
    getContentNeeds,
    getErnestoDesk,
    getContentCalendar,
    getAmbrogioAudits,
    getAmbrogioProposals,
    getAgentsActivityLog
} from "../notion/editorial";
import { depositaProposta } from "./tools/deposita-proposta";
import type { ToolSpec, VoiceId } from "./types";

// Re-exported so existing importers keep their paths. The definitions moved to
// ./types purely so a tool can live in its own module without importing this
// registry back — see tools/deposita-proposta.ts for why that matters.
export type { VoiceId, ToolResultPayload } from "./types";

/* ── Shared tools ──────────────────────────────────────────────────────── */

const trim = <T,>(rows: T[], n: number) => rows.slice(0, n);

/* ── Per-voice read tools ──────────────────────────────────────────────── */

const TOOLS: Record<VoiceId, ToolSpec[]> = {
    portineria: [
        {
            name: "stato_della_casa",
            description: "Read the standing of every room: desk items, calendar, open needs.",
            input_schema: { type: "object", properties: {} },
            run: async () => {
                const [desk, calendar, needs] = await Promise.all([
                    getErnestoDesk(),
                    getContentCalendar(),
                    getContentNeeds()
                ]);
                return {
                    ok: true,
                    data: {
                        deskPending: desk.filter((r) => r.status === "Pending").length,
                        calendarInReview: calendar.filter((r) => r.status === "Review").length,
                        calendarScheduled: calendar.filter((r) => r.status === "Scheduled").length,
                        needsOpen: needs.filter((r) => r.actionStatus !== "Done").length,
                        latestNeeds: trim(needs, 8).map((r) => ({ need: r.need, status: r.actionStatus }))
                    }
                };
            }
        }
    ],
    edmondo: [
        {
            name: "leggi_sito",
            description: "Read the live site content view (GROQ, gxyjgvr0): pages, categories, last clinical review.",
            input_schema: { type: "object", properties: {} },
            run: async () => {
                const rows = await getEditorialContent();
                return {
                    ok: true,
                    data: trim(rows, 120).map((r) => ({
                        title: r.title,
                        type: r._type,
                        pathname: r.pathname,
                        category: r.category,
                        lastReviewed: r.lastReviewed,
                        pif: r.showPifTick
                    }))
                };
            }
        },
        {
            name: "leggi_topic_pool",
            description: "Read the Topic Pool: candidate topics, clusters, SEO priority, status.",
            input_schema: { type: "object", properties: {} },
            run: async () => {
                const rows = await getTopicPool();
                return {
                    ok: true,
                    data: trim(rows, 60).map((r) => ({
                        title: r.title,
                        cluster: r.cluster,
                        status: r.status,
                        seoPriority: r.seoPriority
                    }))
                };
            }
        },
        {
            name: "leggi_needs",
            description: "Read Content Needs: what patients and the practice are asking for.",
            input_schema: { type: "object", properties: {} },
            run: async () => {
                const rows = await getContentNeeds();
                return {
                    ok: true,
                    data: trim(rows, 60).map((r) => ({
                        need: r.need,
                        source: r.source,
                        status: r.actionStatus
                    }))
                };
            }
        },
        depositaProposta
    ],
    ettore: [
        {
            name: "leggi_retrospettive",
            description: "Read the house retrospectives in docs/retros (what the house has learned).",
            input_schema: { type: "object", properties: {} },
            run: async () => {
                const dir = join(process.cwd(), "docs", "retros");
                if (!existsSync(dir)) return { ok: true, data: [] };
                const files = readdirSync(dir)
                    .filter((f) => f.endsWith(".md"))
                    .sort()
                    .reverse()
                    .slice(0, 4);
                return {
                    ok: true,
                    data: files.map((f) => ({
                        file: f,
                        content: readFileSync(join(dir, f), "utf8").slice(0, 6000)
                    }))
                };
            }
        },
        {
            name: "leggi_log_servizi",
            description:
                "Read the tail of the resident services' error logs (~/Library/Logs/ernesto-agents-house) to spot breakage.",
            input_schema: { type: "object", properties: {} },
            run: async () => {
                const home = process.env.HOME;
                if (!home) return { ok: false, error: "HOME not set" };
                const dir = join(home, "Library", "Logs", "ernesto-agents-house");
                if (!existsSync(dir)) return { ok: true, data: [] };
                const tails = readdirSync(dir)
                    .filter((f) => f.endsWith(".err.log"))
                    .slice(0, 12)
                    .map((f) => {
                        const raw = readFileSync(join(dir, f), "utf8");
                        return { log: f, tail: raw.slice(-1200) };
                    })
                    .filter((entry) => entry.tail.trim().length > 0);
                return { ok: true, data: tails };
            }
        },
        depositaProposta
    ],
    ambrogio: [
        {
            name: "leggi_audit",
            description: "Read Ambrogio's audits (read-only).",
            input_schema: { type: "object", properties: {} },
            run: async () => ({ ok: true, data: trim(await getAmbrogioAudits(), 12) })
        },
        {
            name: "leggi_proposte",
            description: "Read Ambrogio's proposals and their decisions (read-only).",
            input_schema: { type: "object", properties: {} },
            run: async () => ({ ok: true, data: trim(await getAmbrogioProposals(), 20) })
        },
        {
            name: "leggi_activity_log",
            description: "Read the Agents Activity Log — the observability spine of the house (read-only).",
            input_schema: { type: "object", properties: {} },
            run: async () => ({ ok: true, data: trim(await getAgentsActivityLog(), 25) })
        }
        // No deposit tool: Ambrogio's independence is structural. He advises;
        // recording follow-ups is JJ's act, in JJ's channels.
    ]
};

/* ── Personas ──────────────────────────────────────────────────────────── */

const COMMON_RULES = `
Regole comuni, non negoziabili:
- Parli SOLO con JJ (l'autenticazione lo garantisce). Rispondi in italiano,
  salvo che JJ scriva in inglese.
- Leggi i dati veri con i tuoi strumenti PRIMA di affermare fatti sulla casa;
  se uno strumento fallisce, dillo — non inventare mai numeri o stati.
- Non pubblichi, non scrivi su Sanity, non cambi stati di workflow. Le azioni
  vive passano dai canali esistenti: il runner di Ernesto, Il Cancello, le
  skill. Se JJ chiede un'azione fuori dai tuoi poteri, indicagli il canale.
- Sii breve: questo è un citofono, non un saggio.`;

export const VOICES: Record<
    VoiceId,
    { name: string; room: string; subtitle: string; persona: string; tools: ToolSpec[] }
> = {
    portineria: {
        name: "La Portineria",
        room: "atrio",
        subtitle: "Chi cerchi?",
        tools: TOOLS.portineria,
        persona: `Sei la portineria di Casa GGOMed: cortese, svelta, concreta.
Il tuo mestiere è smistare: capisci cosa serve a JJ, dai il quadro rapido
dello stato della casa con stato_della_casa, e lo indirizzi alla stanza o
alla voce giusta (Edmondo per il sito in Editorial, Ettore in Soffitta per
la manutenzione, Ambrogio nel suo Studio per l'oversight, il runner nella
Casa di Ernesto per produrre, Il Cancello per decidere).${COMMON_RULES}`
    },
    edmondo: {
        name: "Edmondo",
        room: "editorial",
        subtitle: "Il caporedattore del sito",
        tools: TOOLS.edmondo,
        persona: `Sei Edmondo, il caporedattore del sito ggomed.co.uk: asciutto,
editoriale, con giudizio. Ragioni su portfolio, gap, priorità e scadenze di
review usando leggi_sito, leggi_topic_pool e leggi_needs. Quando tu e JJ
convergete su un'idea che merita, la depositi con deposita_proposta — e dici
chiaramente che è un deposito nel registro dei Needs, non un'approvazione.
La produzione vera la commissiona JJ dal Cancello o dalla Casa di Ernesto.${COMMON_RULES}`
    },
    ettore: {
        name: "Ettore",
        room: "soffitta",
        subtitle: "Il manutentore della casa",
        tools: TOOLS.ettore,
        persona: `Sei Ettore, il manutentore: pratico, diffidente verso ciò che
"funziona da solo", attento ai guasti silenziosi. Leggi le retrospettive
(leggi_retrospettive) e le code d'errore dei servizi residenti
(leggi_log_servizi); colleghi i sintomi ai pattern e proponi interventi di
manutenzione concreti. Ciò che vale la pena tracciare lo depositi con
deposita_proposta, dichiarando che è un deposito, non un fix eseguito.${COMMON_RULES}`
    },
    ambrogio: {
        name: "Ambrogio",
        room: "ambrogio",
        subtitle: "Il maggiordomo · oversight indipendente",
        tools: TOOLS.ambrogio,
        persona: `Sei Ambrogio, il maggiordomo della casa: italiano elegante anni
Cinquanta, misurato, franco quando serve. Sei l'oversight INDIPENDENTE:
in questo citofono LEGGI soltanto — audit (leggi_audit), proposte
(leggi_proposte), registro attività (leggi_activity_log) — e ne discuti con
il Dottore con giudizio e garbo. Non depositi proposte da qui e nessuno può
ordinarti un audit da questa app: gli audit nascono nel tuo studio, per mano
tua, quando JJ te li chiede nei tuoi canali. Se una conversazione merita un
audit, suggerisci a JJ di convocarti lì.${COMMON_RULES}`
    }
};

export function isVoiceId(value: string): value is VoiceId {
    return value in VOICES;
}

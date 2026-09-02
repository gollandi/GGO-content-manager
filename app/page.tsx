import Link from "next/link";
import Citofono from "../components/Citofono";
import { Guilloche, AgeBar, RoomCrest, ROOM_INK, type RoomId } from "../components/Registro";
import { getHouseState, type HouseState } from "../lib/house/state";
import { QUESTION_KINDS } from "../lib/house/families";

export const dynamic = "force-dynamic";

/**
 * The Atrio — the first page, and the one that has to answer in five
 * seconds: what waits for me, what broke overnight, where is the week.
 *
 * Every number here comes from the house state (lib/house/state.ts), the
 * same read model the Sidebar's margin count and Il Cancello's register are
 * built from. The Atrio ranks; it never recomputes.
 */

type Tone = "seal" | "sepia" | "quiet" | "mute";

interface Tile {
  href: string;
  label: string;
  value: string;
  note: string;
  tone: Tone;
}

interface Call {
  href: string;
  room: RoomId;
  title: string;
  fact: string;
  days?: number | null;
}

interface RoomLine {
  href: string;
  room: RoomId;
  name: string;
  fact: string;
  tone: Tone;
}

const TILE_TONE: Record<Tone, string> = {
  seal: "border-seal text-seal-deep",
  sepia: "border-[var(--sepia)] text-[var(--sepia)]",
  quiet: "border-plate-rule text-plate-foreground",
  mute: "border-dashed border-plate-rule text-plate-foreground-soft",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(d);
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/* ── Deriving the page from the state ───────────────────────────────────── */

function tiles(s: HouseState): Tile[] {
  const a = s.awaiting;
  const n = s.night;
  const w = s.week;
  const e = s.editorial;
  const p = s.pif;
  const produceDays = daysAgo(n?.lastProductiveAt ?? null);
  return [
    {
      href: "/review",
      label: "Al Cancello",
      value: a ? String(a.total) : "—",
      note: !a
        ? "la dashboard non risponde"
        : a.total === 0
          ? "niente aspetta il tuo sigillo"
          : [
              a.social ? `${a.social} social` : null,
              a.desk ? `${a.desk} desk` : null,
              a.website ? `${a.website} sito` : null,
              a.oldestDays ? `la più vecchia da ${a.oldestDays} gg` : null,
            ]
              .filter(Boolean)
              .join(" · "),
      tone: !a ? "mute" : a.total > 0 ? "seal" : "quiet",
    },
    {
      href: "/questioni",
      label: "Le Questioni",
      value: a ? String(a.questions) : "—",
      note: !a
        ? "la scrivania non risponde"
        : a.questions === 0
          ? "nessuna domanda, piano o raccomandazione in sospeso"
          : QUESTION_KINDS.filter((k) => a.questionsByKind[k.type])
              .map((k) => `${a.questionsByKind[k.type]} ${k.label.toLowerCase()}`)
              .join(" · "),
      tone: !a ? "mute" : a.questions > 0 ? "sepia" : "quiet",
    },
    {
      href: "/casa-di-ernesto#attivita",
      label: "Gli agenti · 24 ore",
      value: n ? String(n.attention) : "—",
      note: !n
        ? "il registro delle run non risponde"
        : [
            n.runs === 0 ? "nessuna run" : n.attention === 0 ? `${n.runs} run, tutte bene` : `da guardare su ${n.runs} run`,
            produceDays === null ? "mai prodotto" : produceDays === 0 ? "prodotto oggi" : `ultima produzione ${produceDays} gg fa`,
            n.zeroOutputStreak > 0 ? `${n.zeroOutputStreak} slot a zero` : null,
          ]
            .filter(Boolean)
            .join(" · "),
      tone: !n
        ? "mute"
        : n.attention > 0 || produceDays === null || produceDays >= 7
          ? "seal"
          : n.runs === 0 || produceDays >= 3
            ? "sepia"
            : "quiet",
    },
    {
      href: "/casa-di-ernesto",
      label: "Questa settimana",
      value: w ? (w.target ? `${w.published}/${w.target}` : String(w.published)) : "—",
      note: !w
        ? "il calendario non risponde"
        : w.total === 0
          ? `nessuna uscita in calendario dal ${fmtDate(w.weekOf)}`
          : w.target
            ? `pubblicate su obiettivo · ${w.total} in calendario`
            : `pubblicate · ${w.total} in calendario · obiettivo non impostato`,
      tone: !w ? "mute" : w.total === 0 ? "sepia" : "quiet",
    },
    {
      href: "/editorial",
      label: "Sito da rivedere",
      value: e ? String(e.stale) : "—",
      note: !e
        ? "Sanity non risponde"
        : e.stale === 0
          ? `${e.live} pagine vive, nessuna oltre i sei mesi`
          : `su ${e.live} pagine vive${e.oldestStaleDays ? ` · la più vecchia da ${e.oldestStaleDays} gg` : ""}`,
      tone: !e ? "mute" : e.stale > 0 ? "sepia" : "quiet",
    },
    {
      href: "/pif-tick",
      label: "PIF Tick",
      value: p ? String(p.unlit) : "—",
      note: !p
        ? "i criteri non rispondono"
        : [
            p.unlit === 0 ? "ogni badge sigillato" : "badge senza sigillo",
            p.overdue ? `${p.overdue} review scadute` : null,
            p.nextReviewDate
              ? p.nextReviewInDays !== null && p.nextReviewInDays >= 0
                ? `prossima review fra ${p.nextReviewInDays} gg`
                : `review del ${fmtDate(p.nextReviewDate)} passata`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
      tone: !p ? "mute" : p.overdue > 0 ? "seal" : p.unlit > 0 ? "sepia" : "quiet",
    },
  ];
}

/** What wants JJ, ranked: decisions first, then breakage, then staleness. */
function calls(s: HouseState): Call[] {
  const out: Call[] = [];
  const a = s.awaiting;
  if (a && a.total > 0) {
    out.push({
      href: "/review",
      room: "cancello",
      title: `${a.total} ${a.total === 1 ? "atto aspetta" : "atti aspettano"} il tuo sigillo`,
      fact: [a.social ? `${a.social} social` : null, a.desk ? `${a.desk} desk` : null, a.website ? `${a.website} patch sito` : null]
        .filter(Boolean)
        .join(" · "),
      days: a.oldestDays,
    });
  }
  if (a && a.questions > 0) {
    out.push({
      href: "/questioni",
      room: "questioni",
      title: `${a.questions} ${a.questions === 1 ? "questione aspetta" : "questioni aspettano"} una risposta`,
      fact: QUESTION_KINDS.filter((k) => a.questionsByKind[k.type])
        .map((k) => `${a.questionsByKind[k.type]} ${k.label.toLowerCase()}`)
        .join(" · "),
      days: a.questionsOldestDays,
    });
  }
  if (a && a.impact > 0) {
    out.push({
      href: "/editorial#impact",
      room: "editorial",
      title: `${a.impact} ${a.impact === 1 ? "verdetto d'impatto dovuto" : "verdetti d'impatto dovuti"}`,
      fact: "bisogni con data di review raggiunta e senza esito",
    });
  }
  if (s.night && s.night.attention > 0) {
    out.push({
      href: "/casa-di-ernesto#attivita",
      room: "ernesto",
      title: `${s.night.attention} run da guardare nelle ultime 24 ore`,
      fact: s.night.failed.map((f) => f.job ?? "run").slice(0, 3).join(" · "),
    });
  }
  if (s.runs.failed > 0) {
    out.push({
      href: "/casa-di-ernesto",
      room: "ernesto",
      title: `${s.runs.failed} run ${s.runs.failed === 1 ? "interattiva fallita" : "interattive fallite"}`,
      fact: "dietro la porta della Casa di Ernesto",
    });
  }
  if (s.pif && s.pif.overdue > 0) {
    out.push({
      href: "/pif-tick?source=all&state=overdue",
      room: "pif",
      title: `${s.pif.overdue} review PIF ${s.pif.overdue === 1 ? "scaduta" : "scadute"}`,
      fact: "la data di prossima review è passata",
    });
  }
  if (s.night && s.night.zeroOutputStreak >= 3) {
    out.push({
      href: "/casa-di-ernesto",
      room: "ernesto",
      title: `${s.night.zeroOutputStreak} slot di produzione consecutivi a zero`,
      fact: "la casa gira ma non produce",
      days: daysAgo(s.night.lastProductiveAt),
    });
  }
  if (s.snapshot && s.snapshot.ageDays !== null && s.snapshot.ageDays >= 15) {
    out.push({
      href: "/portineria",
      room: "portineria",
      title: "Snapshot performance fermo",
      fact: `l'ultima settimana letta è del ${fmtDate(s.snapshot.latestWeekOf)}`,
      days: s.snapshot.ageDays,
    });
  }
  return out;
}

function rooms(s: HouseState): RoomLine[] {
  const a = s.awaiting;
  const e = s.editorial;
  const p = s.pif;
  return [
    {
      href: "/review",
      room: "cancello",
      name: "Il Cancello",
      fact: !a
        ? "nessun riporto"
        : a.total === 0
          ? `niente in attesa · ${a.scheduled} programmati`
          : `${a.total} in attesa · ${a.scheduled} programmati`,
      tone: !a ? "mute" : a.total > 0 ? "seal" : "quiet",
    },
    {
      href: "/questioni",
      room: "questioni",
      name: "Le Questioni",
      fact: !a
        ? "nessun riporto"
        : a.questions === 0
          ? "nessuna questione in sospeso"
          : `${a.questions} in sospeso${s.ambrogioPending ? ` · ${s.ambrogioPending} proposte di Ambrogio nel suo studio` : ""}`,
      tone: !a ? "mute" : a.questions > 0 ? "sepia" : "quiet",
    },
    {
      href: "/editorial",
      room: "editorial",
      name: "Editorial",
      fact: !e ? "nessun riporto" : `${e.live} pagine vive · ${e.stale} da rivedere · ${e.pifLit} con badge PIF`,
      tone: !e ? "mute" : e.stale > 0 ? "sepia" : "quiet",
    },
    {
      href: "/pif-tick",
      room: "pif",
      name: "PIF Tick",
      fact: !p ? "nessun riporto" : `${p.lit} di ${p.rows} badge sigillati · ${p.overdue} scaduti`,
      tone: !p ? "mute" : p.overdue > 0 ? "seal" : p.unlit > 0 ? "sepia" : "quiet",
    },
    {
      href: "/casa-di-ernesto",
      room: "ernesto",
      name: "Gli agenti",
      fact:
        s.runs.active > 0
          ? `${s.runs.active} run in corso dietro la porta`
          : s.runs.failed > 0
            ? `${s.runs.failed} run fallite`
            : "la porta è chiusa, nessuna run in corso",
      tone: s.runs.failed > 0 ? "seal" : "quiet",
    },
    {
      href: "/portineria",
      room: "portineria",
      name: "La Portineria",
      fact: !s.snapshot
        ? "nessun riporto"
        : s.snapshot.latestWeekOf
          ? `snapshot della settimana del ${fmtDate(s.snapshot.latestWeekOf)}`
          : "nessuna settimana letta",
      tone: !s.snapshot ? "mute" : (s.snapshot.ageDays ?? 0) >= 15 ? "seal" : (s.snapshot.ageDays ?? 0) >= 8 ? "sepia" : "quiet",
    },
    { href: "/carico", room: "carico", name: "Il Carico", fact: "ingresso dei girati dal telefono", tone: "quiet" },
    {
      href: "/soffitta",
      room: "soffitta",
      name: "La Soffitta",
      fact: s.retros === 0 ? "nessun retro archiviato" : `${s.retros} retro fra i bauli`,
      tone: "quiet",
    },
    {
      href: "/ambrogio",
      room: "ambrogio",
      name: "Lo Studio di Ambrogio",
      fact: "le relazioni si leggono dentro: lo studio non riporta in atrio",
      tone: "mute",
    },
  ];
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default async function AtrioPage() {
  const state = await getHouseState();
  const strip = tiles(state);
  const wanting = calls(state);
  const lines = rooms(state);
  const awaiting = state.awaiting?.total ?? null;

  const headline =
    awaiting === null
      ? "Il registro non risponde"
      : wanting.length === 0
        ? "La casa è in ordine"
        : awaiting > 0
          ? `${awaiting} ${awaiting === 1 ? "atto aspetta" : "atti aspettano"} il tuo sigillo`
          : `${wanting.length} ${wanting.length === 1 ? "cosa ti aspetta" : "cose ti aspettano"}`;

  return (
    <>
      <div className="relative min-h-screen overflow-hidden">
        <Guilloche
          size={1100}
          rings={4}
          opacity={0.2}
          className="pointer-events-none absolute -right-80 -top-72 h-[1100px] w-[1100px]"
        />

        {/* The masthead: one headline, one act. */}
        <header className="relative border-b border-plate-rule px-10 pb-5 pt-9 max-sm:px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="column-label">Casa GGOMed · l’ingresso</p>
              <h1 className="document-title mt-2 text-[34px] text-plate-foreground-strong max-sm:text-[26px]">
                {headline}
              </h1>
              <p className="mt-2 text-[12px] text-plate-foreground-soft">
                Letto alle {fmtWhen(state.generatedAt)}
                {state.errors.length > 0 && (
                  <span className="text-seal"> · {state.errors.length} {state.errors.length === 1 ? "fonte non risponde" : "fonti non rispondono"}</span>
                )}
              </p>
            </div>
            <Link href="/review" className={awaiting && awaiting > 0 ? "act-seal" : "act-quiet"}>
              {awaiting && awaiting > 0 ? `Apri Il Cancello · ${awaiting}` : "Apri Il Cancello"}
            </Link>
          </div>
        </header>

        {/* The strip: six numbers, each a decision. */}
        <section className="relative px-10 pt-6 max-sm:px-4" aria-label="Oggi">
          <div className="grid grid-cols-7 gap-px border border-plate-rule bg-plate-rule max-2xl:grid-cols-4 max-md:grid-cols-2">
            {strip.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className={`block border-t-2 bg-plate-raised px-4 py-4 transition-colors hover:bg-plate ${TILE_TONE[t.tone]}`}
              >
                <div className="column-label">{t.label}</div>
                <div className="tabular mt-1 font-serif text-[30px] font-bold leading-none">{t.value}</div>
                <div className="mt-2 text-[11px] leading-snug text-plate-foreground-soft">{t.note}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* What wants JJ, ranked. */}
        <section className="relative px-10 pt-8 max-sm:px-4" aria-labelledby="atrio-calls">
          <h2 id="atrio-calls" className="column-label">Ti aspettano</h2>
          {wanting.length === 0 ? (
            <p className="mt-3 border border-dashed border-plate-rule px-4 py-5 text-[13px] text-plate-foreground-soft">
              Niente aspetta il tuo sigillo, nessuna run da guardare, nessuna review scaduta.
            </p>
          ) : (
            <ol className="mt-3 border-t border-plate-rule">
              {wanting.map((c, i) => (
                <li key={`${c.href}-${i}`} className="border-b border-plate-rule">
                  <Link
                    href={c.href}
                    className="group flex items-center gap-4 px-2 py-3 transition-colors hover:bg-plate-raised max-sm:gap-3"
                  >
                    <span className="serial w-6 flex-none text-plate-foreground-soft">{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: ROOM_INK[c.room].accent }}>
                      <RoomCrest room={c.room} size={18} className="flex-none opacity-80" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-plate-foreground-strong group-hover:underline">
                        {c.title}
                      </span>
                      {c.fact && <span className="block text-[12px] text-plate-foreground-soft">{c.fact}</span>}
                    </span>
                    {c.days !== undefined && c.days !== null && c.days > 0 && (
                      <span className="flex flex-none items-center gap-2">
                        <AgeBar days={c.days} />
                        <span className="serial text-seal-deep">{c.days}d</span>
                      </span>
                    )}
                    <span aria-hidden="true" className="flex-none text-plate-foreground-soft">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* The rooms: one line each, one fact each. */}
        <section className="relative px-10 pt-8 max-sm:px-4" aria-labelledby="atrio-rooms">
          <h2 id="atrio-rooms" className="column-label">Le stanze</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-8 border-t border-plate-rule max-lg:grid-cols-1">
            {lines.map((r) => (
              <li key={r.href} className="border-b border-plate-rule">
                <Link
                  href={r.href}
                  className="group flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-plate-raised"
                >
                  <span style={{ color: r.tone === "mute" ? undefined : ROOM_INK[r.room].accent }}>
                    <RoomCrest room={r.room} size={16} className={r.tone === "mute" ? "opacity-40" : "opacity-80"} />
                  </span>
                  <span className="w-[11rem] flex-none font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-plate-foreground max-sm:w-auto">
                    {r.name}
                  </span>
                  <span
                    className={[
                      "min-w-0 flex-1 truncate text-[12px]",
                      r.tone === "seal"
                        ? "text-seal-deep"
                        : r.tone === "sepia"
                          ? "text-[var(--sepia)]"
                          : "text-plate-foreground-soft",
                    ].join(" ")}
                  >
                    {r.fact}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Overnight: what broke, then the chronicler's week. */}
        <section id="stanotte" className="relative px-10 pt-8 max-sm:px-4" aria-labelledby="atrio-night">
          <h2 id="atrio-night" className="column-label">Stanotte</h2>
          {!state.night ? (
            <p className="mt-3 text-[13px] text-plate-foreground-soft">Il registro delle run non risponde.</p>
          ) : state.night.failed.length === 0 ? (
            <p className="mt-3 text-[13px] text-plate-foreground-soft">
              {state.night.runs === 0
                ? "Nessuna run nelle ultime 24 ore."
                : `${state.night.runs} run nelle ultime 24 ore, nessuna da guardare.`}
            </p>
          ) : (
            <ul className="mt-3 border-t border-seal/40">
              {state.night.failed.map((f) => (
                <li key={f.id} className="flex items-start gap-4 border-b border-seal/40 px-2 py-2.5">
                  <span className="serial w-[5.5rem] flex-none text-plate-foreground-soft">{fmtWhen(f.startedAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-seal-deep">
                      {f.job ?? "run"} · {f.status}
                    </span>
                    {f.summary && <span className="block text-[12px] text-plate-foreground-soft">{f.summary}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12px] text-plate-foreground-soft">
            Tutto quello che gli agenti hanno fatto, giorno per giorno, si legge da{" "}
            <Link href="/casa-di-ernesto#attivita" className="font-semibold text-engraving-ink hover:underline">
              Gli agenti
            </Link>
            .
          </p>
        </section>

        <footer className="relative mt-10 border-t border-plate-rule px-10 py-6 max-sm:px-4">
          <p className="text-[12px] text-plate-foreground-soft">
            Ogni numero di questa pagina viene dallo stesso registro che alimenta Il Cancello. Nessun numero è
            stato inventato per riempire una casella: una fonte muta scrive “nessun riporto”.
          </p>
        </footer>
      </div>
      <Citofono voice="portineria" />
    </>
  );
}

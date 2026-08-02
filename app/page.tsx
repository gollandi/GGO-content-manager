"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../components/AppShell";
import Citofono from "../components/Citofono";
import { Guilloche, Socket, Tally, AgeBar, RoomCrest, ROOM_INK, type RoomId } from "../components/Registro";
import { ContentItem, PifValidationItem } from "../lib/notion/types";

/**
 * L'ATRIO — the counterfoil wall.
 *
 * Every room of the house is a perforated stub torn from the same book.
 * Volume reads as tally marks. Decisions read as seal sockets: filled is
 * settled, empty is waiting for JJ. A room that needs him tears its own edge.
 *
 * Rooms with no reporting line say so. They are never given a number.
 */

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

type StubState = "quiet" | "attention" | "mute";

interface RoomStub {
  href: string;
  name: string;
  room: RoomId;
  /** What the tally counts, in three words or fewer. */
  unit: string;
  /** The tally itself. Null when the room has no reporting line. */
  volume: number | null;
  /** Sockets: how many acts are settled, and how many still await a seal. */
  sealed: number;
  awaiting: number;
  /** Days the oldest undecided item has been standing. */
  oldestDays: number | null;
  /** One line of plain fact under the rule. */
  note: string;
  state: StubState;
  /** Ernesto only: the light under the closed door while a run is working. */
  doorLight?: boolean;
}

/** The torn edge of a stub pulled from its book. Drawn, not masked. */
function TornEdge({ colour }: { colour: string }) {
  const teeth = 26;
  const points: string[] = ["0,10"];
  for (let i = 0; i < teeth; i += 1) {
    const x = (i / teeth) * 100;
    const next = ((i + 1) / teeth) * 100;
    points.push(`${x.toFixed(2)},${i % 2 === 0 ? 3 : 8}`);
    points.push(`${((x + next) / 2).toFixed(2)},${i % 2 === 0 ? 7 : 1}`);
  }
  points.push("100,10", "100,12", "0,12");
  return (
    <svg
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      className="absolute -top-[11px] left-0 h-3 w-full"
      aria-hidden="true"
    >
      <polygon points={points.join(" ")} fill={colour} />
    </svg>
  );
}

function Stub({ room }: { room: RoomStub }) {
  const torn = room.state === "attention";
  const mute = room.state === "mute";

  const body = (
    <>
      {torn && <TornEdge colour="var(--stub-torn-paper, #f0dfd8)" />}

      {/* Room name and its ex libris, struck like the heading of a counterfoil book. */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <h3
          className={[
            "font-condensed text-[13px] font-bold uppercase leading-tight tracking-[0.14em]",
            mute ? "text-plate-foreground-soft" : torn ? "text-seal-deep" : "text-paper-foreground"
          ].join(" ")}
        >
          {room.name}
        </h3>
        <span style={mute ? undefined : { color: torn ? "var(--seal-deep)" : ROOM_INK[room.room].accent }}>
          <RoomCrest room={room.room} size={20} className={mute ? "opacity-50" : "opacity-80"} />
        </span>
      </div>

      <div
        className={[
          "mx-4 mt-2.5 border-t",
          mute ? "border-plate-rule" : torn ? "border-seal/40" : "border-paper-edge"
        ].join(" ")}
      />

      {/* The tally: volume you can read without reading a number. */}
      <div className="flex flex-1 flex-col justify-center px-4 py-4">
        {room.volume === null ? (
          <p className="font-condensed text-[11px] uppercase leading-relaxed tracking-[0.12em] text-plate-foreground-soft">
            Nessun riporto
          </p>
        ) : (
          <>
            <Tally
              count={room.volume}
              colour={torn ? "var(--seal-deep)" : "var(--engraving-ink)"}
              label={`${room.volume} ${room.unit}`}
            />
            <p
              className={[
                "mt-2 font-condensed text-[10px] uppercase tracking-[0.16em]",
                torn ? "text-seal-deep/80" : "text-paper-foreground-soft"
              ].join(" ")}
            >
              {room.volume} {room.unit}
            </p>
          </>
        )}

        <p
          className={[
            "mt-3 text-[12px] leading-snug",
            mute ? "text-plate-foreground-soft" : torn ? "text-seal-deep" : "text-paper-foreground-soft"
          ].join(" ")}
        >
          {room.note}
        </p>

        {room.oldestDays !== null && room.oldestDays > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <AgeBar days={room.oldestDays} />
            <span className="serial text-seal-deep">
              {room.oldestDays}d
            </span>
          </div>
        )}
      </div>

      {/* The light under the door: on only while the girls are working. */}
      {room.doorLight && (
        <div
          className="door-light mx-4"
          role="img"
          aria-label="Run in corso dietro la porta"
          title="Run in corso dietro la porta"
        />
      )}

      {/* The foot: one socket per act. Empty means it is waiting for you. */}
      {!mute && (
        <div
          className={[
            "flex items-center gap-1.5 border-t px-4 py-3",
            torn ? "border-seal/40" : "border-paper-edge"
          ].join(" ")}
        >
          {Array.from({ length: Math.min(room.awaiting, 5) }).map((_, i) => (
            <Socket key={`a${i}`} sealed={false} size={18} title="Awaiting your seal" />
          ))}
          {Array.from({ length: Math.max(0, Math.min(5 - room.awaiting, room.sealed)) }).map((_, i) => (
            <Socket key={`s${i}`} sealed size={18} title="Sealed" />
          ))}
          {room.awaiting > 5 && (
            <span className="serial ml-1 text-seal-deep">+{room.awaiting - 5}</span>
          )}
        </div>
      )}
    </>
  );

  if (mute) {
    return (
      <Link href={room.href} className="stub stub-mute">
        {body}
      </Link>
    );
  }

  return (
    <Link href={room.href} className={torn ? "stub stub-torn" : "stub"}>
      {body}
    </Link>
  );
}

/**
 * The facade: Casa GGOMed cut open, engraved in the hairline grammar.
 * Not decoration — each window is a real room, lit by its real state:
 * oxblood glow = the room wants JJ; amber = Ernesto's girls at work;
 * faint = quiet; outline only = no reporting line.
 */
function Facade({ rooms }: { rooms: RoomStub[] }) {
  const by = (href: string) => rooms.find((r) => r.href === href);
  // Two floors of the cut-open house, in the order the rooms sit in it.
  const upper = [by("/soffitta"), by("/ambrogio"), by("/helm-pathways"), by("/youtube")];
  const lower = [by("/review"), by("/casa-di-ernesto"), by("/editorial"), by("/pif-tick")];

  const windowFill = (room?: RoomStub) => {
    if (!room || room.state === "mute") return "transparent";
    if (room.state === "attention") return "var(--seal-bright)";
    if (room.doorLight) return "var(--sepia-bright)";
    return "var(--plate-raised)";
  };

  const lit = rooms.filter((r) => r.state === "attention").length;

  return (
    <svg
      viewBox="0 0 176 96"
      width={176}
      height={96}
      fill="none"
      stroke="var(--plate-fg-soft)"
      strokeWidth={1}
      aria-label={
        lit === 0
          ? "Casa GGOMed: nessuna finestra accesa"
          : `Casa GGOMed: ${lit === 1 ? "una finestra accesa" : `${lit} finestre accese`}`
      }
      role="img"
      className="flex-none max-sm:hidden"
    >
      {/* Roofline and carcass */}
      <path d="M8 34 L88 6 L168 34" />
      <path d="M20 34 V90 H156 V34" />
      <path d="M20 62 H156" />
      {/* Chimney */}
      <path d="M132 20 v-8 h8 v11" />
      {/* Windows: upper floor */}
      {upper.map((room, i) => (
        <rect
          key={`u${i}`}
          x={30 + i * 33}
          y={40}
          width={20}
          height={14}
          fill={windowFill(room)}
          fillOpacity={room?.state === "attention" ? 0.85 : room?.doorLight ? 0.8 : 1}
          strokeDasharray={room?.state === "mute" ? "2 2" : undefined}
        />
      ))}
      {/* Windows: ground floor */}
      {lower.map((room, i) => (
        <rect
          key={`l${i}`}
          x={30 + i * 33}
          y={68}
          width={20}
          height={16}
          fill={windowFill(room)}
          fillOpacity={room?.state === "attention" ? 0.85 : room?.doorLight ? 0.8 : 1}
          strokeDasharray={room?.state === "mute" ? "2 2" : undefined}
        />
      ))}
      {/* The gate stands where the entry is */}
      <path d="M30 84 v-12 M40 84 v-12 M35 84 v-14 M30 76 h10" strokeWidth={0.8} />
    </svg>
  );
}

export default function AtrioPage() {
  const [content, setContent] = useState<ContentItem[] | null>(null);
  const [compliance, setCompliance] = useState<PifValidationItem[] | null>(null);
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [runs, setRuns] = useState<unknown[] | null>(null);
  const [retro, setRetro] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const grab = async (url: string) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    };

    Promise.all([
      grab("/api/notion/content"),
      grab("/api/notion/compliance"),
      grab("/api/review-dashboard/state"),
      grab("/api/ernesto/runs"),
      grab("/api/retro")
    ]).then(([c, p, r, e, s]) => {
      if (cancelled) return;
      if (Array.isArray(c)) setContent(c);
      if (Array.isArray(p)) setCompliance(p);
      if (r && typeof r === "object") setReview(r as Record<string, unknown>);
      setRuns(Array.isArray(e) ? e : Array.isArray(e?.runs) ? e.runs : null);
      if (s && typeof s === "object") setRetro(s as Record<string, unknown>);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Derive each room's reporting line from what actually answered ────── */

  const rows = (key: string): Record<string, unknown>[] => {
    const value = review?.[key];
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  };

  const wall = rows("wall");
  const desk = rows("desk");
  const calendar = rows("calendar");
  const website = rows("website");
  const wallIds = new Set(wall.map((r) => r.rowId));

  const awaitingSeal =
    wall.length +
    calendar.filter((r) => r.status === "Review").length +
    desk.filter((r) => r.status === "Pending" && !wallIds.has(r.rowId)).length +
    website.filter((r) => r.patch && r.patchState !== "awaiting-publish").length;

  const scheduled = calendar.filter((r) => r.status === "Scheduled").length;

  const oldestWaitDays = (() => {
    const dues = desk
      .filter((r) => r.status === "Pending" && typeof r.due === "string")
      .map((r) => new Date(r.due as string).getTime())
      .filter((t) => Number.isFinite(t));
    if (dues.length === 0) return null;
    const days = Math.floor((Date.now() - Math.min(...dues)) / 86_400_000);
    return days > 0 ? days : null;
  })();

  const isVideo = (item: ContentItem) =>
    item.youtubeId.trim().length > 0 ||
    item.platform.some((p) => p.toLowerCase().includes("youtube"));

  const overdue = (content ?? []).filter((item) => {
    if (item.status === "👁️ Review" || item.status === "⚠️ Needs Update") return true;
    if (!item.lastReviewed) return true;
    return new Date(item.lastReviewed).getTime() < Date.now() - SIX_MONTHS_MS;
  });

  const compliant = (compliance ?? []).filter((c) => c.status === "✅ YES").length;
  const failing = (compliance ?? []).filter((c) => c.status === "❌ NO").length;

  const failedRuns = (runs ?? []).filter(
    (r) => typeof r === "object" && r !== null && (r as { status?: string }).status === "Failed"
  ).length;

  // The light under Ernesto's door: on only while the girls are working.
  const activeRuns = (runs ?? []).filter((r) => {
    const status = typeof r === "object" && r !== null ? (r as { status?: string }).status : undefined;
    return status === "running" || status === "awaiting-jj";
  }).length;

  const proposals = Array.isArray(retro?.proposals) ? (retro.proposals as unknown[]).length : null;

  const ROOMS: RoomStub[] = [
    {
      href: "/review",
      name: "Il Cancello",
      room: "cancello",
      unit: "in attesa",
      volume: review ? awaitingSeal : null,
      sealed: scheduled,
      awaiting: awaitingSeal,
      oldestDays: oldestWaitDays,
      note: !review
        ? "La dashboard di review non risponde."
        : awaitingSeal === 0
          ? "Niente aspetta il tuo sigillo."
          : "Al cancello: bozze, caption e patch ferme sul tuo giudizio.",
      state: !review ? "mute" : awaitingSeal > 0 ? "attention" : "quiet"
    },
    {
      href: "/editorial",
      name: "Editorial",
      room: "editorial",
      unit: "asset vivi",
      volume: content ? content.length : null,
      sealed: content ? content.length - overdue.length : 0,
      awaiting: overdue.length,
      oldestDays: null,
      note: !content
        ? "Content Assets non risponde."
        : overdue.length === 0
          ? "Nessuna review scaduta."
          : `${overdue.length} oltre i sei mesi o segnati da rivedere.`,
      state: !content ? "mute" : overdue.length > 0 ? "attention" : "quiet"
    },
    {
      href: "/pif-tick",
      name: "PIF Tick",
      room: "pif",
      unit: "criteri",
      volume: compliance ? compliance.length : null,
      sealed: compliant,
      awaiting: failing,
      oldestDays: null,
      note: !compliance
        ? "Compliance non risponde."
        : failing === 0
          ? "Nessun criterio in fallimento."
          : `${failing} criteri falliti.`,
      state: !compliance ? "mute" : failing > 0 ? "attention" : "quiet"
    },
    {
      href: "/youtube",
      name: "YouTube",
      room: "youtube",
      unit: "video",
      volume: content ? content.filter(isVideo).length : null,
      sealed: content ? content.filter(isVideo).length : 0,
      awaiting: 0,
      oldestDays: null,
      note: content ? "Asset video registrati." : "Content Assets non risponde.",
      state: content ? "quiet" : "mute"
    },
    {
      href: "/casa-di-ernesto",
      name: "La Casa di Ernesto",
      room: "ernesto",
      unit: "run",
      volume: runs ? runs.length : null,
      sealed: runs ? runs.length - failedRuns : 0,
      awaiting: failedRuns,
      oldestDays: null,
      note: !runs
        ? "Nessuna run leggibile."
        : failedRuns > 0
          ? `${failedRuns} run fallite dietro la porta.`
          : activeRuns > 0
            ? `La porta è chiusa: ${activeRuns === 1 ? "una run in corso" : `${activeRuns} run in corso`} dietro la porta.`
            : "La porta è chiusa e la casa tace: nessuna run in corso.",
      doorLight: activeRuns > 0,
      state: !runs ? "mute" : failedRuns > 0 ? "attention" : "quiet"
    },
    {
      href: "/soffitta",
      name: "La Soffitta",
      room: "soffitta",
      unit: "proposte",
      volume: proposals,
      sealed: 0,
      awaiting: proposals ?? 0,
      oldestDays: null,
      note:
        proposals === null
          ? "Il retro non risponde."
          : proposals === 0
            ? "Nessuna proposta in giacenza."
            : "Proposte in giacenza fra i bauli.",
      state: proposals === null ? "mute" : "quiet"
    },
    {
      href: "/ambrogio",
      name: "Lo Studio di Ambrogio",
      room: "ambrogio",
      unit: "",
      volume: null,
      sealed: 0,
      awaiting: 0,
      oldestDays: null,
      note: "Lo studio non manda riporti in atrio: le relazioni si leggono dentro.",
      state: "mute"
    },
    {
      href: "/helm-pathways",
      name: "Helm Pathways",
      room: "helm",
      unit: "",
      volume: null,
      sealed: 0,
      awaiting: 0,
      oldestDays: null,
      note: "Server component: nessuna linea di riporto verso l'atrio.",
      state: "mute"
    }
  ];

  const wanting = ROOMS.filter((r) => r.state === "attention");

  return (
    <AppShell>
      <div className="relative min-h-screen overflow-hidden">
        <Guilloche
          size={1100}
          rings={4}
          opacity={0.2}
          className="pointer-events-none absolute -right-80 -top-72 h-[1100px] w-[1100px]"
        />
        <Guilloche
          size={820}
          rings={3}
          opacity={0.14}
          className="pointer-events-none absolute -bottom-72 -left-72 h-[820px] w-[820px]"
        />

        {/* The masthead of the book. */}
        <header className="relative border-b border-plate-rule px-10 pb-5 pt-9 max-sm:px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="column-label">Casa GGOMed · l’ingresso</p>
              <h1 className="document-title mt-2 text-[34px] text-plate-foreground-strong max-sm:text-[26px]">
                {loading
                  ? "Apro il registro…"
                  : wanting.length === 0
                    ? "La casa è in ordine"
                    : wanting.length === 1
                      ? "Una stanza ti aspetta"
                      : `${wanting.length} stanze ti aspettano`}
              </h1>
            </div>
            <div className="flex items-end gap-6">
              <p className="max-w-[22rem] text-[13px] leading-relaxed text-plate-foreground-soft">
                Ogni stanza è una matrice staccata dallo stesso libro. Le tacche contano
                il volume, le sedi contano gli atti: piena è decisa, vuota aspetta te.
              </p>
              <Facade rooms={ROOMS} />
            </div>
          </div>
        </header>

        {/* The wall. */}
        <div className="relative px-10 py-9 max-sm:px-4">
          <div className="grid grid-cols-4 gap-x-5 gap-y-8 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {ROOMS.map((room) => (
              <Stub key={room.href} room={room} />
            ))}
          </div>
        </div>

        {/* The engraved strip that closes the page. */}
        <footer className="relative mt-6 border-t border-plate-rule px-10 py-6 max-sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="column-label">
              Vecchio archivio · undici superfici in pensionamento
            </p>
            <p className="text-[12px] text-plate-foreground-soft">
              Le matrici tratteggiate non hanno una linea di riporto: nessun numero è
              stato inventato per riempirle.
            </p>
          </div>
        </footer>
      </div>
        <Citofono voice="portineria" />
        </AppShell>
  );
}

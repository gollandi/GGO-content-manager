/**
 * IL REGISTRO — the primitives of the cockpit's visual world.
 *
 * Security engraving, seals, and the bound register of signed decisions.
 * These are the reusable atoms every surface is cut from. Seed key 9055bf41.
 */

import type { ReactNode } from "react";

/* ===========================================================================
   GUILLOCHE
   A real hypotrochoid lathe, computed at render time — the same curve family
   a geometric lathe engraves onto a banknote. Not a texture image: the
   parameters drive it, so any panel can carry its own rosette at any scale.
   =========================================================================== */

function hypotrochoid(
  R: number,
  r: number,
  d: number,
  turns: number,
  steps: number,
  cx: number,
  cy: number
): string {
  const points: string[] = [];
  const k = (R - r) / r;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * turns * Math.PI * 2;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

export function Guilloche({
  size = 520,
  rings = 3,
  opacity = 0.5,
  colour = "var(--engraving)",
  className = ""
}: {
  size?: number;
  rings?: number;
  opacity?: number;
  colour?: string;
  className?: string;
}) {
  const c = size / 2;
  // Each ring is a different lathe setting, as on a real rose engine.
  const settings = [
    { R: c * 0.94, r: c * 0.17, d: c * 0.3, turns: 17 },
    { R: c * 0.72, r: c * 0.11, d: c * 0.24, turns: 11 },
    { R: c * 0.48, r: c * 0.07, d: c * 0.17, turns: 7 },
    { R: c * 0.3, r: c * 0.05, d: c * 0.1, turns: 5 }
  ].slice(0, rings);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ opacity }}
    >
      {settings.map((s, i) => (
        <polyline
          key={i}
          points={hypotrochoid(s.R, s.r, s.d, s.turns, 1800, c, c)}
          fill="none"
          stroke={colour}
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/**
 * A full-bleed guilloche watermark for the plate behind a surface.
 * Decorative and inert: it never intercepts a pointer and never reads out.
 */
export function GuillocheField({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <Guilloche
        size={900}
        rings={4}
        opacity={0.16}
        className="absolute -right-40 -top-52 h-[900px] w-[900px]"
      />
      <Guilloche
        size={700}
        rings={3}
        opacity={0.1}
        className="absolute -bottom-60 -left-44 h-[700px] w-[700px]"
      />
    </div>
  );
}

/* ===========================================================================
   THE SEAL AND ITS SOCKET
   Filled socket = decided. Empty socket = it is waiting for you.
   =========================================================================== */

export function Socket({
  sealed,
  onPlate = false,
  size = 28,
  justSealed = false,
  title
}: {
  sealed: boolean;
  onPlate?: boolean;
  size?: number;
  justSealed?: boolean;
  title?: string;
}) {
  const label = title ?? (sealed ? "Sealed" : "Awaiting your seal");
  return (
    <span
      className={[
        "socket",
        sealed ? "socket-sealed" : "socket-empty",
        onPlate ? "socket-on-plate" : "",
        justSealed ? "animate-press-seal" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      title={label}
    >
      {sealed && (
        <svg viewBox="0 0 24 24" width={size * 0.52} height={size * 0.52} aria-hidden="true">
          {/* The engraved device struck into the wax. */}
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="var(--seal-deep)"
            strokeWidth="1"
            opacity="0.7"
          />
          <path
            d="M12 6.5 13.7 10.3 17.8 10.8 14.8 13.6 15.6 17.6 12 15.6 8.4 17.6 9.2 13.6 6.2 10.8 10.3 10.3Z"
            fill="var(--seal-deep)"
            opacity="0.55"
          />
        </svg>
      )}
    </span>
  );
}

/* ===========================================================================
   COUNTERFOIL
   The stub torn off and kept when a document is issued. Here it is the
   left margin of a register, carrying the entry's serial.
   =========================================================================== */

export function Counterfoil({
  serial,
  tone = "seal",
  children
}: {
  serial: string;
  tone?: "seal" | "quiet";
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-none items-stretch" aria-hidden={!children}>
      <div
        className={[
          "flex w-9 flex-none items-center justify-center px-1 py-3",
          tone === "seal" ? "bg-seal text-paper" : "bg-plate-raised text-plate-foreground-soft"
        ].join(" ")}
      >
        <span
          className="serial whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {serial}
        </span>
      </div>
      <div className="perforation-y" />
      {children}
    </div>
  );
}

/* ===========================================================================
   TALLY MARKS
   Volume, counted the way a register counts: in fives, struck through.
   Readable at a glance without reading a number.
   =========================================================================== */

export function Tally({
  count,
  max = 25,
  colour = "currentColor",
  label
}: {
  count: number;
  max?: number;
  colour?: string;
  label?: string;
}) {
  const shown = Math.min(count, max);
  const groups = Math.floor(shown / 5);
  const remainder = shown % 5;
  const accessible = label ?? `${count}`;

  const group = (key: string, strokes: number, struck: boolean) => (
    <svg key={key} width={strokes * 4 + (struck ? 6 : 2)} height="14" aria-hidden="true">
      {Array.from({ length: strokes }).map((_, i) => (
        <line
          key={i}
          x1={i * 4 + 2}
          y1="1"
          x2={i * 4 + 2}
          y2="13"
          stroke={colour}
          strokeWidth="2"
        />
      ))}
      {struck && <line x1="0" y1="11" x2={strokes * 4 + 4} y2="3" stroke={colour} strokeWidth="2" />}
    </svg>
  );

  return (
    <span className="inline-flex items-end gap-1.5" role="img" aria-label={accessible}>
      {Array.from({ length: groups }).map((_, i) => group(`g${i}`, 4, true))}
      {remainder > 0 && group("r", remainder, false)}
      {shown === 0 && <span className="serial opacity-40">—</span>}
      {count > max && <span className="serial ml-0.5">+{count - max}</span>}
    </span>
  );
}

/* ===========================================================================
   STATE MARKS
   A rubber stamp, not a pill.
   =========================================================================== */

export type MarkTone = "sealed" | "pending" | "stamped" | "ageing" | "quiet";

export function Mark({
  tone = "quiet",
  onPaper = false,
  children
}: {
  tone?: MarkTone;
  onPaper?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={["mark", `mark-${tone}`, onPaper ? "mark-on-paper" : ""].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

/* ===========================================================================
   AGE
   An undecided thing gets heavier the longer it waits. The register shows
   that as weight, not as a date nobody subtracts in their head.
   =========================================================================== */

export function ageTone(days: number | null | undefined): MarkTone {
  if (days === null || days === undefined) return "quiet";
  if (days >= 14) return "pending";
  if (days >= 5) return "ageing";
  return "quiet";
}

export function AgeBar({ days }: { days: number | null | undefined }) {
  if (days === null || days === undefined) return null;
  const weight = Math.min(days / 21, 1);
  const tone = ageTone(days);
  const colour =
    tone === "pending" ? "var(--seal-bright)" : tone === "ageing" ? "var(--sepia-bright)" : "var(--plate-rule)";
  return (
    <span
      className="inline-flex h-3 w-16 items-end gap-px"
      role="img"
      aria-label={`Waiting ${days} ${days === 1 ? "day" : "days"}`}
      title={`Waiting ${days} ${days === 1 ? "day" : "days"}`}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="flex-1"
          style={{
            height: `${30 + i * 10}%`,
            background: i / 8 < weight ? colour : "var(--plate-rule)",
            opacity: i / 8 < weight ? 1 : 0.35
          }}
        />
      ))}
    </span>
  );
}

/* ===========================================================================
   STRUCTURE
   =========================================================================== */

/** A sheet of safety paper set into the plate. */
export function Document({
  className = "",
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`paper border border-paper-edge ${className}`}>{children}</div>;
}

/** A ruled section heading on the plate. */
export function RegisterHeading({
  label,
  count,
  action
}: {
  label: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-plate-rule pb-2">
      <h2 className="column-label text-plate-foreground">
        {label}
        {count !== undefined && (
          <span className="ml-2 text-plate-foreground-soft">[{count}]</span>
        )}
      </h2>
      {action}
    </div>
  );
}

/* ===========================================================================
   THE HOUSE LAYER
   Function first; the house lives in the details. Each room of Casa GGOMed
   carries its own engraved ex libris and its own ink. The crests are drawn
   in the same hairline grammar as everything else — never clip-art.
   =========================================================================== */

export type RoomId =
  | "cancello"
  | "questioni"
  | "editorial"
  | "youtube"
  | "pif"
  | "portineria"
  | "helm"
  | "ernesto"
  | "carico"
  | "soffitta"
  | "ambrogio"
  | "archivio"
  | "atrio";

/** Each room's own ink, drawn from the world's existing families. */
export const ROOM_INK: Record<RoomId, { accent: string; bright: string }> = {
  atrio: { accent: "var(--plate-fg)", bright: "var(--plate-fg-strong)" },
  cancello: { accent: "var(--seal)", bright: "var(--seal-bright)" },
  /* Le Questioni: answered in ink, never sealed — the stamp's family. */
  questioni: { accent: "var(--stamp)", bright: "var(--stamp-bright)" },
  editorial: { accent: "var(--engraving)", bright: "var(--engraving-bright)" },
  youtube: { accent: "var(--plate-fg-soft)", bright: "var(--plate-fg)" },
  pif: { accent: "var(--engraving-ink)", bright: "var(--engraving-bright)" },
  portineria: { accent: "var(--stamp)", bright: "var(--stamp-bright)" },
  helm: { accent: "var(--plate-fg-soft)", bright: "var(--plate-fg)" },
  ernesto: { accent: "var(--sepia)", bright: "var(--sepia-bright)" },
  /* Il Carico feeds Ernesto, so it carries his ink. */
  carico: { accent: "var(--sepia)", bright: "var(--sepia-bright)" },
  soffitta: { accent: "var(--stamp)", bright: "var(--stamp-bright)" },
  ambrogio: { accent: "var(--engraving)", bright: "var(--engraving-bright)" },
  archivio: { accent: "var(--plate-fg-soft)", bright: "var(--plate-fg)" }
};

const CREST_PATHS: Record<RoomId, ReactNode> = {
  /* The wrought gate, half open. */
  cancello: (
    <>
      <path d="M4 20V8c0-2 2-4 4-4M20 20V8c0-2-2-4-4-4" />
      <path d="M8 20V6M12 20V4M16 20V6" />
      <path d="M6 11h12" />
      <circle cx="12" cy="14" r="1.6" />
    </>
  ),
  /* The desk bell and the open ledger: questions answered, not sealed. */
  questioni: (
    <>
      <path d="M4 19h16" />
      <path d="M6 19V9c0-1 1-2 2-2h8c1 0 2 1 2 2v10" />
      <path d="M9 12h6M9 15h4" />
      <path d="M12 7V4" />
      <circle cx="12" cy="3.5" r="0.8" />
    </>
  ),
  /* The crate on the receiving bench, taking in what comes down to it. */
  carico: (
    <>
      <path d="M4 12v7c0 .6.4 1 1 1h14c.6 0 1-.4 1-1v-7" />
      <path d="M4 12h16" />
      <path d="M12 3v7" />
      <path d="M9 7l3 3 3-3" />
    </>
  ),
  /* The editorial desk calendar, one leaf lifted. */
  editorial: (
    <>
      <rect x="4" y="6" width="16" height="14" />
      <path d="M4 10h16M8 4v4M16 4v4" />
      <path d="M8 14h4M8 17h7" />
    </>
  ),
  /* The projection reel. */
  youtube: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="7" r="1.4" />
      <circle cx="12" cy="17" r="1.4" />
      <circle cx="7" cy="12" r="1.4" />
      <circle cx="17" cy="12" r="1.4" />
    </>
  ),
  /* The certificate with its tick. */
  pif: (
    <>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M7 7h6M7 10h4" />
      <path d="M9 15.5l2.2 2.2 4.3-4.6" />
    </>
  ),
  /* The front desk ledger and its service bell. */
  portineria: (
    <>
      <rect x="4" y="7" width="16" height="12" />
      <path d="M7 10h6M7 13h4M15.5 15.5h2" />
      <path d="M11 7V5h2v2" />
      <path d="M15 5.5a3 3 0 0 1 3 3" />
    </>
  ),
  /* The compass rose. */
  helm: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 5.5l1.8 4.7L12 18.5l-1.8-8.3z" />
      <path d="M5.5 12h2M16.5 12h2" />
    </>
  ),
  /* Ernesto's closed door, light spilling beneath it. */
  ernesto: (
    <>
      <rect x="7" y="4" width="10" height="15" />
      <circle cx="14.4" cy="12" r="0.9" />
      <path d="M4.5 20.5h15" strokeWidth={2.4} opacity={0.85} />
    </>
  ),
  /* The attic trunk under the roofline. */
  soffitta: (
    <>
      <path d="M3 10l9-6 9 6" />
      <rect x="7" y="12" width="10" height="7" />
      <path d="M7 15h10M12 12v3" />
    </>
  ),
  /* The butler's wall bell on its coiled spring. */
  ambrogio: (
    <>
      <path d="M8 4h8" />
      <path d="M12 4v3" />
      <path d="M7 13a5 5 0 0 1 10 0v3H7z" />
      <path d="M10.5 19a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  /* The pigeonholes of the old archive. */
  archivio: (
    <>
      <rect x="4" y="5" width="16" height="14" />
      <path d="M4 12h16M9.3 5v14M14.6 5v14" />
      <path d="M6 9.5h1.8M11 9.5h1.8M16.2 16h1.8" />
    </>
  ),
  /* The house itself, cut open. */
  atrio: (
    <>
      <path d="M3.5 11l8.5-6.5L20.5 11" />
      <path d="M6 10v9h12v-9" />
      <path d="M6 14.5h12M12 10v9" />
    </>
  )
};

/**
 * A room's ex libris. Inline, stroke-drawn, inherits currentColor unless the
 * room's own ink is requested with `inked`.
 */
export function RoomCrest({
  room,
  size = 20,
  inked = false,
  className = ""
}: {
  room: RoomId;
  size?: number;
  inked?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={inked ? ROOM_INK[room].accent : "currentColor"}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {CREST_PATHS[room]}
    </svg>
  );
}

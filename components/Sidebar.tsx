"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import * as Icons from "./Icons";
import { Socket, Guilloche, RoomCrest, ROOM_INK, type RoomId } from "./Registro";

/**
 * The register's left margin.
 *
 * Three ranks, because twenty-one equal entries is not a table of contents:
 *   1. The gate — one seal press, the only oxblood in the margin.
 *   2. The rooms — surfaces reading live sources.
 *   3. The old archive — pages reading the mirror databases due to retire.
 */

interface NavEntry {
  href: string;
  label: string;
  room: RoomId;
}

const ROOMS: NavEntry[] = [
  { href: "/", label: "Atrio", room: "atrio" },
  { href: "/editorial", label: "Editorial", room: "editorial" },
  { href: "/youtube", label: "YouTube", room: "youtube" },
  { href: "/pif-tick", label: "PIF Tick", room: "pif" },
  { href: "/helm-pathways", label: "Helm Pathways", room: "helm" },
  { href: "/casa-di-ernesto", label: "La Casa di Ernesto", room: "ernesto" },
  { href: "/soffitta", label: "La Soffitta", room: "soffitta" },
  { href: "/ambrogio", label: "Lo Studio di Ambrogio", room: "ambrogio" }
];

const ARCHIVE: NavEntry[] = [
  { href: "/content-explorer", label: "Content Explorer", room: "archivio" },
  { href: "/validation-hub", label: "PIF Tick Validation", room: "archivio" },
  { href: "/evidence-repository", label: "Evidence Repository", room: "archivio" },
  { href: "/content-requests", label: "Content Requests", room: "archivio" },
  { href: "/feedback-queue", label: "Feedback Queue", room: "archivio" },
  { href: "/annual-review", label: "Annual Review", room: "archivio" },
  { href: "/analytics", label: "Analytics", room: "archivio" },
  { href: "/assistant", label: "AI Assistant", room: "archivio" },
  { href: "/patient-journeys", label: "Patient Journeys", room: "archivio" },
  { href: "/keywords", label: "Keywords", room: "archivio" },
  { href: "/schema-validation", label: "Schema Validation", room: "archivio" }
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer"
};

function NavRow({ entry, active }: { entry: NavEntry; active: boolean }) {
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center gap-3 border-l-2 py-2 pl-4 pr-3 text-[13px] transition-colors max-lg:whitespace-nowrap",
        active
          ? "bg-plate-raised text-plate-foreground-strong"
          : "border-l-transparent text-plate-foreground-soft hover:text-plate-foreground"
      ].join(" ")}
      style={active ? { borderLeftColor: ROOM_INK[entry.room].bright, color: undefined } : undefined}
    >
      <RoomCrest
        room={entry.room}
        size={16}
        className={[
          "flex-none transition-colors",
          active ? "" : "opacity-70 group-hover:opacity-100"
        ].join(" ")}
      />
      <span className="truncate">{entry.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [pending, setPending] = useState<number | null>(null);

  // The one number worth carrying in the margin of every page: how much of
  // the house is standing still, waiting for a decision only JJ can make.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/review-dashboard/state", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const wall = Array.isArray(data.wall) ? data.wall : [];
        const desk = Array.isArray(data.desk) ? data.desk : [];
        const calendar = Array.isArray(data.calendar) ? data.calendar : [];
        const website = Array.isArray(data.website) ? data.website : [];
        const wallIds = new Set(wall.map((row: { rowId: string }) => row.rowId));
        setPending(
          wall.length +
            calendar.filter((row: { status: string }) => row.status === "Review").length +
            desk.filter(
              (row: { status: string; rowId: string }) =>
                row.status === "Pending" && !wallIds.has(row.rowId)
            ).length +
            website.filter(
              (row: { patch: unknown; patchState?: string }) =>
                row.patch && row.patchState !== "awaiting-publish"
            ).length
        );
      })
      .catch(() => {
        /* The margin degrades to no count; the gate is still reachable. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="plate relative sticky top-0 flex min-h-screen flex-col justify-between border-r border-plate-rule max-lg:relative max-lg:min-h-auto max-lg:border-b max-lg:border-r-0">
      <Guilloche
        size={420}
        rings={3}
        opacity={0.11}
        className="pointer-events-none absolute -left-24 top-24 h-[420px] w-[420px]"
      />

      <div className="relative flex flex-1 flex-col">
        {/* The plate's masthead, struck like a letterhead. */}
        <div className="border-b border-plate-rule px-5 py-5">
          <Link href="/" className="block">
            <div className="document-title text-[19px] text-plate-foreground-strong">GGO Med</div>
            <div className="column-label mt-1.5">Registro delle decisioni</div>
          </Link>
        </div>

        {/* Il Cancello — the one gate. The only oxblood in the margin. */}
        <div className="border-b border-plate-rule px-4 py-4">
          <Link
            href="/review"
            className="group flex items-center gap-3 border border-seal-deep bg-seal px-3 py-3 text-paper transition-colors hover:bg-seal-bright hover:text-plate"
          >
            <Socket sealed={false} size={26} title="" />
            <span className="min-w-0 flex-1">
              <span className="block font-condensed text-[13px] font-bold uppercase tracking-[0.14em]">
                Il Cancello
              </span>
              <span className="mt-0.5 block text-[11px] opacity-90">
                {pending === null
                  ? "Review & publish"
                  : pending === 0
                    ? "Nothing awaits your seal"
                    : `${pending} awaiting your seal`}
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto py-5 max-lg:flex-row max-lg:gap-3 max-lg:overflow-x-auto max-lg:py-3">
          <div className="max-lg:flex max-lg:items-center max-lg:gap-1">
            <h2 className="column-label mb-2 px-5 max-lg:mb-0 max-lg:px-3">Le stanze</h2>
            <div className="flex flex-col max-lg:flex-row">
              {ROOMS.map((entry) => (
                <NavRow key={entry.href} entry={entry} active={isActive(entry.href)} />
              ))}
            </div>
          </div>

          {/* Demoted by rank, not hidden: these read the mirror databases that
              retire once the parity harness clears. */}
          {/* Phone: the registrar's acts ride the horizontal nav so sign-out
              and settings never disappear with the hidden footer. */}
          <div className="hidden max-lg:flex max-lg:items-center max-lg:gap-1">
            <Link href="/settings" className="act-quiet whitespace-nowrap">
              Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="act-quiet whitespace-nowrap"
              type="button"
            >
              Sign out
            </button>
          </div>

          <div className="max-lg:flex max-lg:items-center max-lg:gap-1">
            <h2 className="column-label mb-2 flex items-center gap-2 px-5 max-lg:mb-0 max-lg:px-3">
              <span>Vecchio archivio</span>
              <span className="font-normal normal-case tracking-normal text-plate-foreground-soft/70">
                in pensionamento
              </span>
            </h2>
            <div className="flex flex-col opacity-70 transition-opacity hover:opacity-100 max-lg:flex-row">
              {ARCHIVE.map((entry) => (
                <NavRow key={entry.href} entry={entry} active={isActive(entry.href)} />
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* The registrar's own line at the foot of the page. */}
      <div className="relative border-t border-plate-rule px-4 py-4 max-lg:hidden">
        <button
          onClick={() => window.location.reload()}
          className="act-quiet w-full"
          type="button"
        >
          <Icons.IconSync className="h-3.5 w-3.5" />
          <span>Rileggi le fonti</span>
        </button>

        {session?.user && (
          <div className="mt-4 border-t border-plate-rule pt-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] text-plate-foreground">
                {session.user.name ?? "Registrar"}
              </span>
              <span className="column-label">{ROLE_LABELS[session.user.role] ?? "Viewer"}</span>
            </div>
            <div className="flex gap-2">
              <Link href="/settings" className="act-quiet flex-1">
                Settings
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="act-quiet flex-1"
                type="button"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import * as Icons from "./Icons";
import { Socket, Guilloche, RoomCrest, ROOM_INK, type RoomId } from "./Registro";

/**
 * The margin of the register. Three ranks, top to bottom:
 *   1. Il Cancello — the one gate, the only oxblood in the margin.
 *   2. The rooms — eight surfaces, each owning one class of fact.
 *   3. The old archive — the mirror pages, folded away until asked for.
 */

interface NavEntry {
  href: string;
  label: string;
  room: RoomId;
}

const ROOMS: NavEntry[] = [
  { href: "/", label: "Atrio", room: "atrio" },
  { href: "/editorial", label: "Editorial", room: "editorial" },
  { href: "/pif-tick", label: "PIF Tick", room: "pif" },
  { href: "/casa-di-ernesto", label: "La Casa di Ernesto", room: "ernesto" },
  { href: "/portineria", label: "La Portineria", room: "portineria" },
  { href: "/carico", label: "Il Carico", room: "carico" },
  { href: "/soffitta", label: "La Soffitta", room: "soffitta" },
  { href: "/ambrogio", label: "Lo Studio di Ambrogio", room: "ambrogio" }
];

/* Read the mirror databases; retire once the parity harness clears. */
const ARCHIVE: NavEntry[] = [
  { href: "/youtube", label: "YouTube", room: "youtube" },
  { href: "/content-explorer", label: "Content Explorer", room: "archivio" },
  { href: "/validation-hub", label: "PIF Tick Validation", room: "archivio" },
  { href: "/evidence-repository", label: "Evidence Repository", room: "archivio" },
  { href: "/content-requests", label: "Content Requests", room: "archivio" },
  { href: "/feedback-queue", label: "Feedback Queue", room: "archivio" },
  { href: "/annual-review", label: "Annual Review", room: "archivio" },
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

const PENDING_KEY = "house-awaiting";
const PENDING_TTL_MS = 5 * 60 * 1000;
const ARCHIVE_KEY = "sidebar-archive-open";

function NavRow({ entry, active }: { entry: NavEntry; active: boolean }) {
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center gap-3 border-l-2 py-2 pl-4 pr-3 text-[13px] transition-colors max-lg:whitespace-nowrap max-lg:border-l-0 max-lg:px-3",
        active
          ? "bg-plate-raised text-plate-foreground-strong"
          : "border-l-transparent text-plate-foreground-soft hover:text-plate-foreground"
      ].join(" ")}
      style={active ? { borderLeftColor: ROOM_INK[entry.room].bright } : undefined}
    >
      <RoomCrest
        room={entry.room}
        size={16}
        className={["flex-none transition-colors", active ? "" : "opacity-70 group-hover:opacity-100"].join(" ")}
      />
      <span className="truncate">{entry.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [pending, setPending] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const inArchive = ARCHIVE.some((entry) => pathname.startsWith(entry.href));

  // The one number worth carrying in the margin of every page: how much of
  // the house is standing still, waiting for a decision only JJ can make.
  // It is the house state's own count — the same the Atrio and Il Cancello
  // show — cached a few minutes so reloads do not wake the Notion crawl.
  useEffect(() => {
    let cancelled = false;
    const readSaved = (): number | null => {
      try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw) as { count: number; at: number };
        return Date.now() - saved.at < PENDING_TTL_MS ? saved.count : null;
      } catch {
        return null; /* storage unavailable — fall through to the fetch */
      }
    };
    const saved = readSaved();
    if (saved !== null) {
      Promise.resolve().then(() => {
        if (!cancelled) setPending(saved);
      });
      return () => {
        cancelled = true;
      };
    }
    fetch("/api/house/state", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { awaiting?: { total?: number } | null } | null) => {
        if (cancelled || !data?.awaiting || typeof data.awaiting.total !== "number") return;
        const count = data.awaiting.total;
        setPending(count);
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ count, at: Date.now() }));
        } catch { /* storage unavailable — the count still rendered */ }
      })
      .catch(() => {
        /* The margin degrades to no count; the gate is still reachable. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read after mount (the server renders the archive folded) so hydration
  // matches; the saved preference is applied in the next tick.
  useEffect(() => {
    let cancelled = false;
    let open = false;
    try {
      open = localStorage.getItem(ARCHIVE_KEY) === "1";
    } catch { /* default closed */ }
    if (open) {
      Promise.resolve().then(() => {
        if (!cancelled) setArchiveOpen(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleArchive = () => {
    setArchiveOpen((open) => {
      try {
        localStorage.setItem(ARCHIVE_KEY, open ? "0" : "1");
      } catch { /* not persisted */ }
      return !open;
    });
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const showArchive = archiveOpen || inArchive;

  return (
    <aside className="plate relative sticky top-0 flex min-h-screen flex-col justify-between border-r border-plate-rule max-lg:relative max-lg:min-h-0 max-lg:border-b max-lg:border-r-0">
      <Guilloche
        size={420}
        rings={3}
        opacity={0.11}
        className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px]"
      />
      <div className="relative">
        {/* The plate's masthead, struck like a letterhead. */}
        <div className="border-b border-plate-rule px-5 py-5 max-lg:px-4 max-lg:py-3">
          <Link href="/" className="block">
            <div className="document-title text-[19px] text-plate-foreground-strong">GGO Med</div>
            <div className="column-label mt-1.5">Registro delle decisioni</div>
          </Link>
        </div>

        {/* Il Cancello — the one gate. The only oxblood in the margin. */}
        <div className="border-b border-plate-rule px-4 py-4 max-lg:py-3">
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
                    ? "Niente aspetta il tuo sigillo"
                    : `${pending} in attesa del tuo sigillo`}
              </span>
            </span>
          </Link>
        </div>

        <nav className="py-4 max-lg:flex max-lg:flex-wrap max-lg:items-center max-lg:gap-x-3 max-lg:overflow-x-auto max-lg:px-2 max-lg:py-2">
          <div className="max-lg:flex max-lg:items-center max-lg:gap-1">
            <h2 className="column-label mb-2 px-5 max-lg:mb-0 max-lg:px-3">Le stanze</h2>
            <div className="max-lg:flex max-lg:items-center">
              {ROOMS.map((entry) => (
                <NavRow key={entry.href} entry={entry} active={isActive(entry.href)} />
              ))}
            </div>
          </div>

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

          {/* The old archive, folded. Eleven mirror pages in retirement: one
              row until asked for, so the margin stays the rooms' own. */}
          <div className="mt-5 max-lg:mt-0 max-lg:flex max-lg:items-center max-lg:gap-1">
            <button
              type="button"
              onClick={toggleArchive}
              aria-expanded={showArchive}
              className="column-label flex w-full items-center gap-2 px-5 py-1 text-left hover:text-plate-foreground max-lg:w-auto max-lg:px-3"
            >
              <span aria-hidden="true" className="inline-block w-2 text-[10px]">
                {showArchive ? "−" : "+"}
              </span>
              <span>Vecchio archivio</span>
              <span className="font-normal normal-case tracking-normal text-plate-foreground-soft/70">
                {ARCHIVE.length} in pensionamento
              </span>
            </button>
            {showArchive && (
              <div className="mt-1 opacity-80 max-lg:mt-0 max-lg:flex max-lg:items-center">
                {ARCHIVE.map((entry) => (
                  <NavRow key={entry.href} entry={entry} active={isActive(entry.href)} />
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* The registrar's own line at the foot of the page. */}
      <div className="relative border-t border-plate-rule px-5 py-4 max-lg:hidden">
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

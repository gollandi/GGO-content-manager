"use client";

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";

/**
 * Mounts the persistent AppShell (sidebar + main) from the root layout, so
 * the chrome survives navigations and room switches only swap the page
 * segment. The login screen is the one route that stays bare.
 */
export default function ShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}

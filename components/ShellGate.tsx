"use client";

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";

/**
 * Mounts the persistent AppShell (sidebar + main) from the root layout, so
 * the chrome survives navigations and room switches only swap the page
 * segment. The login and invitation screens stay bare: neither has a
 * session yet, and the shell would fetch the house state.
 */
export default function ShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname === "/invito") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}

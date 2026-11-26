"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Settings — today one real thing: who else may enter the cockpit.
 *
 * The page was a placeholder of invented controls (API keys "encrypted at
 * rest", schedules, notifications) that did nothing; a control that claims
 * to work and does not is worse than none, so they are gone.
 *
 * JJ invites a collaborator by email; the cockpit shows a one-time link he
 * sends them himself. They choose their own password on it. He can switch their
 * access off and back on; nothing is ever deleted from here.
 */

interface Collaborator {
  email: string;
  name: string;
  role: string;
  status: "active" | "invited" | "disabled";
  inviteExpiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

const ROLE_COPY: Record<string, string> = {
  social: "Social media — the social queue (comment, mark ready, send back with a note) and media upload. Never approves or publishes.",
};

/** The quiet act on paper: act-quiet is drawn for the dark plate and vanishes here. */
const onPaper = { color: "var(--paper-fg)", borderColor: "var(--paper-edge)" };

const field =
  "w-full border border-paper-edge bg-transparent px-3 py-2 text-sm text-paper-foreground outline-none focus:border-engraving-ink";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [users, setUsers] = useState<Collaborator[] | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState<{ email: string; url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/collaborators", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Could not read the collaborators.");
    else setUsers(data.users);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) load();
  }, [status, isAdmin, load]);

  const invite = async (target: { email: string; name: string }, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target.email, name: target.name, role: "social" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "The invitation failed.");
      setLink({ email: data.user.email, url: data.link, expiresAt: data.expiresAt });
      setEmail("");
      setName("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const setAccess = async (u: Collaborator, disabled: boolean) => {
    const question = disabled
      ? `Switch off ${u.name}'s access now? Their next request is refused. Nothing is deleted.`
      : `Switch ${u.name}'s access back on?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/collaborators/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u.email, disabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "The change failed.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <p className="column-label p-8">Opening…</p>;
  if (!isAdmin) {
    return (
      <div className="p-8">
        <h1 className="page-title">Settings</h1>
        <p className="mt-2 text-sm">Only the cockpit&apos;s owner manages access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8 max-sm:p-4">
      <header className="page-header">
        <div>
          <h1 className="page-title">Collaborators</h1>
          <p className="page-subtitle">Who else may enter the cockpit, and what they may do there.</p>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 border border-seal px-3 py-2 text-[13px] text-seal">{error}</p>}

      <section className="paper mb-6 border border-paper-edge p-5">
        <h2 className="column-label column-label-paper mb-3">Invite</h2>
        <p className="mb-4 text-sm text-paper-foreground">{ROLE_COPY.social}</p>
        <form
          onSubmit={(e) => { e.preventDefault(); invite({ email, name }); }}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="block text-sm">
            <span className="column-label column-label-paper mb-1 block">Name</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          <label className="block text-sm">
            <span className="column-label column-label-paper mb-1 block">Email</span>
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button type="submit" disabled={busy} className="act-seal">Create link</button>
        </form>

        {link && (
          <div className="mt-5 border border-engraving-ink p-4 text-sm text-paper-foreground">
            <p className="mb-2">
              Send this link to <strong>{link.email}</strong> yourself (message or email). It works once and
              expires {new Date(link.expiresAt).toLocaleString("en-GB")}. It is shown only now.
            </p>
            <div className="flex gap-2 max-sm:flex-col">
              <input readOnly className={field} value={link.url} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="act-void" style={onPaper} onClick={() => navigator.clipboard?.writeText(link.url)}>Copy</button>
            </div>
          </div>
        )}
      </section>

      <section className="paper border border-paper-edge p-5">
        <h2 className="column-label column-label-paper mb-3">People</h2>
        {users === null ? (
          <p className="text-sm">Reading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm">No collaborators yet. You are the only person with access.</p>
        ) : (
          <ul className="divide-y divide-paper-edge">
            {users.map((u) => (
              <li key={u.email} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="text-paper-foreground">{u.name} <span className="text-paper-foreground-soft">· {u.email}</span></div>
                  <div className="column-label column-label-paper mt-1">
                    {u.role} · {u.status === "invited"
                      ? (u.inviteExpiresAt ? `invited, link valid until ${new Date(u.inviteExpiresAt).toLocaleString("en-GB")}` : "invited, link expired")
                      : u.status}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className="act-void" style={onPaper}
                    onClick={() => invite({ email: u.email, name: u.name },
                      u.status === "disabled"
                        ? `${u.name}'s access is switched off. A new link lets them back in once they use it to set a new password. Continue?`
                        : `Create a new link for ${u.name}? Their current password keeps working until the new link is used.`)}>
                    New link
                  </button>
                  {u.status === "disabled" ? (
                    <button type="button" disabled={busy} className="act-void" style={onPaper} onClick={() => setAccess(u, false)}>Switch on</button>
                  ) : (
                    <button type="button" disabled={busy} className="act-void" style={onPaper} onClick={() => setAccess(u, true)}>Switch off</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

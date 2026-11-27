"use client";

import { useEffect, useState } from "react";
import { Plate } from "../../components/Plate";
import Onboarding from "../../components/onboarding/Onboarding";
import type { ContractView } from "../../lib/contracts/store";
import type { AcceptanceInput } from "../../lib/contracts/accept";

/**
 * A collaborator's invitation. JJ sends them a link of the form
 * /invito#<token>; they choose their own password here and the link is spent.
 * The token lives in the #fragment, which browsers never send to a server,
 * and reaches the API only in a POST body.
 *
 * Before the password: a short welcome, how we work, and the agreement read
 * and signed (JJ, 26 Nov 2026: "il contratto deve fare parte del cockpit").
 * The signature travels with the password: no access before the agreement.
 */
type Phase =
  | { kind: "checking" }
  | { kind: "invalid"; message: string }
  | { kind: "agreement"; email: string; name: string; min: number; view: ContractView }
  | { kind: "ready"; email: string; name: string; min: number; acceptance: AcceptanceInput }
  | { kind: "done"; email: string };

const field =
  "w-full border border-paper-edge bg-transparent px-3 py-2.5 text-sm text-paper-foreground outline-none transition-colors placeholder:text-paper-foreground-soft focus:border-engraving-ink";

export default function InvitationPage() {
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.location.hash.replace(/^#/, "");
    setToken(t);
    if (!t) {
      setPhase({ kind: "invalid", message: "Questa pagina ha bisogno del link completo del tuo invito." });
      return;
    }
    fetch("/api/auth-invite/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setPhase({ kind: "invalid", message: data.error || "Questo link non è più valido." });
        const c = await fetch("/api/auth-invite/contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        });
        const cdata = await c.json().catch(() => ({}));
        if (!c.ok) return setPhase({ kind: "invalid", message: cdata.error || "Non riesco ad aprire il tuo accordo." });
        setPhase({ kind: "agreement", email: data.email, name: data.name, min: data.minPasswordLength ?? 12, view: cdata.view });
      })
      .catch(() => setPhase({ kind: "invalid", message: "Non riesco a raggiungere il cockpit. Riprova tra un minuto." }));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "ready") return;
    setError("");
    if (password.length < phase.min) return setError(`Usa almeno ${phase.min} caratteri.`);
    if (password !== confirm) return setError("Le due password non coincidono.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth-invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, acceptance: phase.acceptance }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Non sono riuscito a impostare la password.");
      } else {
        // Spend the fragment too, so the link is not left in the address bar.
        window.history.replaceState(null, "", "/invito");
        setPhase({ kind: "done", email: data.email });
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === "agreement") {
    const p = phase;
    return (
      <Onboarding view={p.view} mode="invite" onSigned={async (acceptance) => {
        setPhase({ kind: "ready", email: p.email, name: p.name, min: p.min, acceptance });
        return null;
      }} />
    );
  }

  return (
    <Plate>
      <div className="paper border border-paper-edge">
        <div className="border-b-[3px] border-double border-paper-edge px-8 pb-5 pt-7 text-center">
          <p className="column-label column-label-paper">Invito</p>
          <h1 className="document-title mt-2 text-[26px] text-paper-foreground">GGO Med</h1>
        </div>
        <div className="px-8 py-7 text-sm text-paper-foreground">
          {phase.kind === "checking" && <p className="column-label text-center">Controllo il tuo link…</p>}

          {phase.kind === "invalid" && (
            <p role="alert" className="border border-seal px-3 py-2 text-[13px] text-seal">{phase.message}</p>
          )}

          {phase.kind === "ready" && (
            <form onSubmit={submit}>
              <p className="mb-4">
                Ultimo passo, {phase.name}: scegli la password con cui accederai come <strong>{phase.email}</strong>.
                La conoscerai solo tu. La tua firma viene registrata quando la salvi.
              </p>
              <label className="column-label column-label-paper mb-1.5 block" htmlFor="invite-password">
                Nuova password (almeno {phase.min} caratteri)
              </label>
              <input id="invite-password" type="password" autoComplete="new-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
              <label className="column-label column-label-paper mb-1.5 mt-4 block" htmlFor="invite-confirm">
                Ripetila
              </label>
              <input id="invite-confirm" type="password" autoComplete="new-password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
              {error && <p role="alert" className="mt-3 border border-seal px-3 py-2 text-[13px] text-seal">{error}</p>}
              <button type="submit" disabled={busy} className="act-seal mt-6 w-full">
                {busy ? "Salvo…" : "Firma e imposta la mia password"}
              </button>
            </form>
          )}

          {phase.kind === "done" && (
            <div>
              <p>Grazie: il tuo accordo è firmato e la password è impostata. Accedi con <strong>{phase.email}</strong>. La tua copia firmata è nella Guida.</p>
              <a href="/login?callbackUrl=/guida" className="act-void mt-6 flex w-full" style={{ color: "var(--paper-fg)", borderColor: "var(--paper-edge)" }}>Vai all&apos;accesso</a>
            </div>
          )}
        </div>
        <div className="perforation-x" />
        <p className="px-8 py-3 text-center text-[11px] text-paper-foreground-soft">
          Il link funziona una sola volta e scade 72 ore dopo l&apos;invio.
        </p>
      </div>
    </Plate>
  );
}

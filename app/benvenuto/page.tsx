"use client";

import { useEffect, useState } from "react";
import Onboarding from "../../components/onboarding/Onboarding";
import type { ContractView } from "../../lib/contracts/store";

/**
 * Welcome — for a signed-in collaborator whose agreement is not signed yet:
 * a link redeemed before the onboarding existed, or a new version. The rest
 * of the cockpit stays closed (the server refuses data) until it is signed.
 */
type State =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "required"; view: ContractView }
    | { kind: "accepted"; version: string; countersigned: boolean }
    | { kind: "unassigned" }
    | { kind: "owner" };

export default function WelcomePage() {
    const [state, setState] = useState<State>({ kind: "loading" });
    useEffect(() => {
        fetch("/api/onboarding", { cache: "no-store" })
            .then(async (r) => {
                const j = await r.json().catch(() => ({}));
                setState(r.ok ? j : { kind: "error", message: j.error || "Non riesco ad aprire l'accordo." });
            })
            .catch(() => setState({ kind: "error", message: "Non riesco a raggiungere il cockpit." }));
    }, []);

    if (state.kind === "loading") return <p className="column-label p-8">Apro…</p>;
    if (state.kind === "required") {
        return (
            <Onboarding view={state.view} mode="session" onSigned={async (acceptance) => {
                const r = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptance }) });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) return j.error || "Non firmato. Riprova.";
                window.location.assign("/guida");
                return null;
            }} />
        );
    }
    const box = "paper mx-auto mt-8 max-w-xl border border-paper-edge p-6 text-[15px] text-paper-foreground";
    if (state.kind === "accepted") {
        return (
            <div className={box}>
                <p>Il tuo accordo (versione {state.version}) è firmato.{state.countersigned ? " GGO Med lo ha controfirmato." : " In attesa della firma di GGO Med."}</p>
                <p className="mt-3"><a className="underline" href="/api/contract/signed">Scarica la tua copia firmata</a> · <a className="underline" href="/review">Vai alla coda social</a></p>
            </div>
        );
    }
    if (state.kind === "unassigned") return <div className={box}><p>Il tuo accordo è ancora in preparazione. GGO Med ti contatterà; il cockpit si apre quando è firmato.</p></div>;
    if (state.kind === "owner") return <div className={box}><p>The owner has no agreement to sign here. Collaborators&apos; signatures are in Settings.</p></div>;
    return <div className={box}><p role="alert">{state.message}</p></div>;
}

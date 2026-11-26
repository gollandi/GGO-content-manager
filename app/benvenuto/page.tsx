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
                setState(r.ok ? j : { kind: "error", message: j.error || "The agreement could not be opened." });
            })
            .catch(() => setState({ kind: "error", message: "The cockpit could not be reached." }));
    }, []);

    if (state.kind === "loading") return <p className="column-label p-8">Opening…</p>;
    if (state.kind === "required") {
        return (
            <Onboarding view={state.view} mode="session" onSigned={async (acceptance) => {
                const r = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptance }) });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) return j.error || "Not signed. Try again.";
                window.location.assign("/guida");
                return null;
            }} />
        );
    }
    const box = "paper mx-auto mt-8 max-w-xl border border-paper-edge p-6 text-[15px] text-paper-foreground";
    if (state.kind === "accepted") {
        return (
            <div className={box}>
                <p>Your agreement (version {state.version}) is signed.{state.countersigned ? " GGO Med has countersigned it." : " Awaiting GGO Med's signature."}</p>
                <p className="mt-3"><a className="underline" href="/api/contract/signed">Download your signed copy</a> · <a className="underline" href="/review">Go to the social queue</a></p>
            </div>
        );
    }
    if (state.kind === "unassigned") return <div className={box}><p>Your agreement is still being prepared. GGO Med will be in touch; the cockpit opens once it is signed.</p></div>;
    if (state.kind === "owner") return <div className={box}><p>The owner has no agreement to sign here. Collaborators&apos; signatures are in Settings.</p></div>;
    return <div className={box}><p role="alert">{state.message}</p></div>;
}

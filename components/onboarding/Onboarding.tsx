"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractView } from "../../lib/contracts/store";
import type { AcceptanceInput } from "../../lib/contracts/accept";

/**
 * The welcome a collaborator meets first: who we are and how we work, the
 * agreement section by section in plain English with the exact clauses
 * underneath, the whole text, and the signature. Used by the invitation
 * (/invito, where the password follows) and by /benvenuto (signed in, when the
 * agreement was not signed with the invitation or a new version arrived).
 *
 * The page records what the person did and when — ticks, sections read,
 * reaching the end, downloading — and sends it with the signature; the server
 * checks it against the text it rendered and records the time itself.
 */

const panel = "paper border border-paper-edge p-6 text-[15px] leading-relaxed text-paper-foreground max-sm:p-4";
const label = "column-label column-label-paper mb-2";
const onPaper = { color: "var(--paper-fg)", borderColor: "var(--paper-edge)" };

type Step = { kind: "welcome" } | { kind: "how" } | { kind: "card"; i: number } | { kind: "full" } | { kind: "sign" };

export interface OnboardingProps {
    view: ContractView;
    /** The last step's button: "invite" moves on to the password; "session" signs at once. */
    mode: "invite" | "session";
    onSigned: (acceptance: AcceptanceInput) => Promise<string | null>;
}

export default function Onboarding({ view, mode, onSigned }: OnboardingProps) {
    const [step, setStep] = useState<Step>({ kind: "welcome" });
    const [viewed, setViewed] = useState<{ key: string; at: string }[]>([]);
    const [reachedEndAt, setReachedEndAt] = useState<string | null>(null);
    const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
    const [ticks, setTicks] = useState<(string | null)[]>(view.acceptance.checkboxes.map(() => null));
    const [typed, setTyped] = useState("");
    const [open, setOpen] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    const total = view.cards.length + 4;
    const position = step.kind === "welcome" ? 1 : step.kind === "how" ? 2 : step.kind === "card" ? 3 + step.i : step.kind === "full" ? total - 1 : total;
    const seen = (key: string) => setViewed((v) => (v.some((x) => x.key === key) ? v : [...v, { key, at: new Date().toISOString() }]));

    useEffect(() => {
        if (step.kind !== "full" || reachedEndAt || !endRef.current) return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) setReachedEndAt(new Date().toISOString());
        });
        io.observe(endRef.current);
        return () => io.disconnect();
    }, [step, reachedEndAt]);

    const download = () => {
        const blob = new Blob([view.text], { type: "text/markdown;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${view.contractId}-v${view.version}.md`;
        a.click();
        URL.revokeObjectURL(a.href);
        setDownloadedAt((d) => d ?? new Date().toISOString());
    };

    const ready = view.signable && ticks.every(Boolean) && typed.trim().length > 1 && !!reachedEndAt;
    const sign = async () => {
        setBusy(true); setError("");
        try {
            const msg = await onSigned({
                contractId: view.contractId, version: view.version, sha256: view.sha256, acceptanceSha256: view.acceptanceSha256,
                typedName: typed, checkboxes: ticks.map((t) => ({ checkedAt: t! })), viewedSections: viewed, reachedEndAt, downloadedAt,
            });
            if (msg) setError(msg);
        } finally { setBusy(false); }
    };

    const nav = (back: Step | null, next: Step | null, nextLabel = "Avanti") => (
        <div className="mt-5 flex justify-between gap-3">
            {back ? <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep(back)}>Indietro</button> : <span />}
            {next && <button type="button" className="act-void" style={onPaper} onClick={() => setStep(next)}>{nextLabel}</button>}
        </div>
    );

    const body = useMemo(() => {
        switch (step.kind) {
            case "welcome":
                return (
                    <>
                        <h1 className="document-title text-[24px]">Ti diamo il benvenuto</h1>
                        <p className="mt-3">{view.welcome}</p>
                        {nav(null, { kind: "how" }, "Inizia")}
                    </>
                );
            case "how":
                return (
                    <>
                        <div className={label}>Come lavoriamo</div>
                        <ul className="list-disc space-y-2 pl-5">{view.howWeWork.map((t) => <li key={t}>{t}</li>)}</ul>
                        <div className="mt-4 border-t border-paper-edge pt-3 text-[14px]">
                            <div className={label}>Nel cockpit puoi</div>
                            <ul className="list-disc space-y-1 pl-5">
                                <li>rivedere la coda social e segnare i post pronti per JJ, o chiedere modifiche;</li>
                                <li>dare brief agli agenti della casa e impostare la strategia social;</li>
                                <li>suggerire risposte ai commenti su YouTube;</li>
                                <li>leggere i numeri e ogni pagina del sito;</li>
                                <li>caricare video.</li>
                            </ul>
                            <p className="mt-2"><strong>Cosa aspetta JJ:</strong> la pubblicazione, in ogni forma — un post, una risposta a un commento, una pagina del sito, una newsletter. Niente diventa pubblico senza il suo sì.</p>
                        </div>
                        {nav({ kind: "welcome" }, { kind: "card", i: 0 }, "Leggi l'accordo")}
                    </>
                );
            case "card": {
                const card = view.cards[step.i];
                const last = step.i === view.cards.length - 1;
                return (
                    <>
                        <div className={label}>L&apos;accordo · {step.i + 1} di {view.cards.length}</div>
                        <h2 className="document-title text-[20px]">{card.title}</h2>
                        <p className="mt-3">{card.summary}</p>
                        <button type="button" className="mt-3 text-[13px] underline" onClick={() => setOpen(open === step.i ? null : step.i)} aria-expanded={open === step.i}>
                            {open === step.i ? "Nascondi la clausola completa" : "Leggi la clausola completa"}
                        </button>
                        {open === step.i && (
                            <div className="mt-2 max-h-[45vh] overflow-y-auto border-l-2 border-paper-edge pl-3 text-[13px]">
                                {card.clauses.map((c) => (
                                    <div key={c.key} className="mb-3"><div className="font-semibold">{c.heading}</div><p className="whitespace-pre-wrap">{c.text}</p></div>
                                ))}
                            </div>
                        )}
                        <div className="mt-5 flex justify-between gap-3">
                            <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep(step.i === 0 ? { kind: "how" } : { kind: "card", i: step.i - 1 })}>Indietro</button>
                            <button type="button" className="act-void" style={onPaper} onClick={() => { seen(card.title); setOpen(null); setStep(last ? { kind: "full" } : { kind: "card", i: step.i + 1 }); }}>Ho capito</button>
                        </div>
                    </>
                );
            }
            case "full":
                return (
                    <>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className={label}>L&apos;accordo completo · versione {view.version}</div>
                            <button type="button" className="act-void" style={onPaper} onClick={download}>Scarica una copia</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap border border-paper-edge p-3 text-[13px]" tabIndex={0} aria-label="L'accordo">
                            {view.text}
                            <div ref={endRef} aria-hidden="true">· fine dell&apos;accordo ·</div>
                        </div>
                        <p className="mt-2 text-[12px]">{reachedEndAt ? "Hai raggiunto la fine." : "Scorri fino alla fine per continuare."}</p>
                        <div className="mt-5 flex justify-between gap-3">
                            <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep({ kind: "card", i: view.cards.length - 1 })}>Indietro</button>
                            <button type="button" className="act-void" style={onPaper} disabled={!reachedEndAt} onClick={() => setStep({ kind: "sign" })}>Continua</button>
                        </div>
                    </>
                );
            case "sign":
                return (
                    <>
                        <h2 className="document-title text-[20px]">{view.acceptance.heading}</h2>
                        {!view.signable && <p className="mt-3 border border-paper-edge p-3 text-[14px]" role="status">{view.notSignableReason}</p>}
                        <div className="mt-3 space-y-3">
                            {view.acceptance.checkboxes.map((t, i) => (
                                <label key={i} className="flex gap-2">
                                    <input type="checkbox" checked={!!ticks[i]} disabled={!view.signable}
                                        onChange={(e) => setTicks((x) => x.map((v, j) => (j === i ? (e.target.checked ? new Date().toISOString() : null) : v)))} />
                                    <span>{t}</span>
                                </label>
                            ))}
                        </div>
                        <label className="mt-4 block">
                            <span className="block text-[14px]">{view.acceptance.namePrompt}</span>
                            <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!view.signable} autoComplete="name"
                                className="mt-1 w-full border border-paper-edge bg-transparent px-3 py-2" placeholder={view.signatoryName} />
                        </label>
                        <p className="mt-3 text-[13px]">{view.acceptance.intent}</p>
                        {error && <p className="mt-3 text-[14px]" role="alert">{error}</p>}
                        <div className="mt-5 flex justify-between gap-3">
                            <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep({ kind: "full" })}>Indietro</button>
                            <button type="button" className="act-seal" disabled={!ready || busy} onClick={sign}>
                                {mode === "invite" ? `${view.acceptance.button}, poi scegli una password` : view.acceptance.button}
                            </button>
                        </div>
                    </>
                );
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, open, reachedEndAt, ticks, typed, error, busy, view, mode, ready]);

    return (
        <div className="mx-auto max-w-2xl p-6 max-sm:p-3">
            <div className="mb-3 h-1 w-full bg-plate-rule" aria-hidden="true"><div className="h-1 bg-engraving-ink" style={{ width: `${(position / total) * 100}%` }} /></div>
            <section className={panel}>{body}</section>
        </div>
    );
}

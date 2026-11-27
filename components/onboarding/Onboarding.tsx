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

    const nav = (back: Step | null, next: Step | null, nextLabel = "Next") => (
        <div className="mt-5 flex justify-between gap-3">
            {back ? <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep(back)}>Back</button> : <span />}
            {next && <button type="button" className="act-void" style={onPaper} onClick={() => setStep(next)}>{nextLabel}</button>}
        </div>
    );

    const body = useMemo(() => {
        switch (step.kind) {
            case "welcome":
                return (
                    <>
                        <h1 className="document-title text-[24px]">Welcome</h1>
                        <p className="mt-3">{view.welcome}</p>
                        {nav(null, { kind: "how" }, "Start")}
                    </>
                );
            case "how":
                return (
                    <>
                        <div className={label}>How we work</div>
                        <ul className="list-disc space-y-2 pl-5">{view.howWeWork.map((t) => <li key={t}>{t}</li>)}</ul>
                        <div className="mt-4 border-t border-paper-edge pt-3 text-[14px]">
                            <div className={label}>In the cockpit you can</div>
                            <ul className="list-disc space-y-1 pl-5">
                                <li>review the social queue and mark posts ready for JJ, or ask for changes;</li>
                                <li>brief the house&apos;s agents and set the social strategy;</li>
                                <li>suggest replies to YouTube comments;</li>
                                <li>read the numbers and every page of the website;</li>
                                <li>upload footage.</li>
                            </ul>
                            <p className="mt-2"><strong>What waits for JJ:</strong> publishing, in every form — a post, a reply to a comment, a website page, a newsletter. Nothing goes public without his yes.</p>
                        </div>
                        {nav({ kind: "welcome" }, { kind: "card", i: 0 }, "Read the agreement")}
                    </>
                );
            case "card": {
                const card = view.cards[step.i];
                const last = step.i === view.cards.length - 1;
                return (
                    <>
                        <div className={label}>The agreement · {step.i + 1} of {view.cards.length}</div>
                        <h2 className="document-title text-[20px]">{card.title}</h2>
                        <p className="mt-3">{card.summary}</p>
                        <button type="button" className="mt-3 text-[13px] underline" onClick={() => setOpen(open === step.i ? null : step.i)} aria-expanded={open === step.i}>
                            {open === step.i ? "Hide the full clause" : "Read the full clause"}
                        </button>
                        {open === step.i && (
                            <div className="mt-2 max-h-[45vh] overflow-y-auto border-l-2 border-paper-edge pl-3 text-[13px]">
                                {card.clauses.map((c) => (
                                    <div key={c.key} className="mb-3"><div className="font-semibold">{c.heading}</div><p className="whitespace-pre-wrap">{c.text}</p></div>
                                ))}
                            </div>
                        )}
                        <div className="mt-5 flex justify-between gap-3">
                            <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep(step.i === 0 ? { kind: "how" } : { kind: "card", i: step.i - 1 })}>Back</button>
                            <button type="button" className="act-void" style={onPaper} onClick={() => { seen(card.title); setOpen(null); setStep(last ? { kind: "full" } : { kind: "card", i: step.i + 1 }); }}>Got it</button>
                        </div>
                    </>
                );
            }
            case "full":
                return (
                    <>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className={label}>The whole agreement · version {view.version}</div>
                            <button type="button" className="act-void" style={onPaper} onClick={download}>Download a copy</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap border border-paper-edge p-3 text-[13px]" tabIndex={0} aria-label="The agreement">
                            {view.text}
                            <div ref={endRef} aria-hidden="true">· end of the agreement ·</div>
                        </div>
                        <p className="mt-2 text-[12px]">{reachedEndAt ? "You have reached the end." : "Scroll to the end to continue."}</p>
                        <div className="mt-5 flex justify-between gap-3">
                            <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep({ kind: "card", i: view.cards.length - 1 })}>Back</button>
                            <button type="button" className="act-void" style={onPaper} disabled={!reachedEndAt} onClick={() => setStep({ kind: "sign" })}>Continue</button>
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
                            <button type="button" className="act-quiet" style={onPaper} onClick={() => setStep({ kind: "full" })}>Back</button>
                            <button type="button" className="act-seal" disabled={!ready || busy} onClick={sign}>
                                {mode === "invite" ? `${view.acceptance.button}, then choose a password` : view.acceptance.button}
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

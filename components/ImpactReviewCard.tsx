"use client";

import { useState } from "react";

/**
 * JJ's impact verdict on one Content Need — the PIF "measuring impact"
 * verification: was the success definition achieved?
 */
export default function ImpactReviewCard(props: {
    id: string;
    need: string;
    successDefinition: string;
    reviewDate: string | null;
}) {
    const [outcome, setOutcome] = useState("Achieved");
    const [evidence, setEvidence] = useState("");
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

    async function submit() {
        setState("saving");
        try {
            const res = await fetch("/api/notion/impact-review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: props.id, outcome, evidence }),
            });
            if (!res.ok) throw new Error(await res.text());
            setState("saved");
        } catch {
            setState("error");
        }
    }

    if (state === "saved") {
        return (
            <li className="py-2.5 text-xs text-emerald-600">✓ Verdetto registrato: {props.need} — {outcome}</li>
        );
    }

    return (
        <li className="py-2.5">
            <div className="text-sm font-medium">{props.need}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
                Successo definito: {props.successDefinition || "(non definito)"}
                {props.reviewDate ? ` · review dovuta ${props.reviewDate}` : ""}
            </div>
            <div className="flex gap-2 mt-2 max-lg:flex-col">
                <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-border-default bg-white text-xs"
                >
                    {["Achieved", "Partially achieved", "Not achieved", "Pending"].map((o) => (
                        <option key={o} value={o}>{o}</option>
                    ))}
                </select>
                <input
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="Evidenza — feedback ricevuti, osservazione clinica…"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border-default bg-white text-xs"
                />
                <button
                    onClick={() => void submit()}
                    disabled={state === "saving"}
                    className="px-4 py-1.5 rounded-lg bg-engraving-ink text-paper text-xs font-semibold disabled:opacity-50"
                >
                    {state === "saving" ? "…" : "Registra verdetto"}
                </button>
            </div>
            {state === "error" && <div className="text-xs text-red-600 mt-1">Errore — riprova</div>}
        </li>
    );
}

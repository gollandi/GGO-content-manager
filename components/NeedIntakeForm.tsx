"use client";

import { useState } from "react";

/**
 * Patient/clinical need intake — il primum movens del ciclo contenuti.
 * Creates a Content Needs row (Action Status: To do) that Berenice and
 * La Casa di Ernesto pick up downstream.
 */
export default function NeedIntakeForm() {
    const [need, setNeed] = useState("");
    const [source, setSource] = useState("Patient");
    const [details, setDetails] = useState("");
    const [successDefinition, setSuccessDefinition] = useState("");
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

    async function submit() {
        setState("saving");
        try {
            // Review suggerita a +3 mesi — si verifica quando il contenuto ha vissuto
            const review = new Date();
            review.setMonth(review.getMonth() + 3);
            const res = await fetch("/api/notion/content-needs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    need,
                    source,
                    details,
                    successDefinition,
                    impactReviewDate: successDefinition.trim() ? review.toISOString().slice(0, 10) : undefined,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            setNeed("");
            setDetails("");
            setSuccessDefinition("");
            setState("saved");
            setTimeout(() => setState("idle"), 2500);
        } catch {
            setState("error");
        }
    }

    return (
        <div className="p-3 rounded-xl bg-paper-shade border border-paper-edge mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-paper-foreground-soft mb-2">
                + Registra un need (paziente/clinica)
            </div>
            <div className="flex gap-2 max-lg:flex-col">
                <input
                    value={need}
                    onChange={(e) => setNeed(e.target.value)}
                    placeholder='Es. "I pazienti chiedono se la BNI compromette la fertilità"'
                    className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-white text-sm"
                />
                <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border-default bg-white text-xs"
                >
                    {["Patient", "Clinical", "Search", "Internal", "Compliance"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <button
                    onClick={() => void submit()}
                    disabled={state === "saving" || !need.trim()}
                    className="px-4 py-2 rounded-lg bg-engraving-ink text-paper text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                >
                    {state === "saving" ? "…" : "Registra"}
                </button>
            </div>
            <input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Dettagli/contesto (opzionale)"
                className="w-full mt-2 px-3 py-2 rounded-lg border border-border-default bg-white text-xs"
            />
            <input
                value={successDefinition}
                onChange={(e) => setSuccessDefinition(e.target.value)}
                placeholder='Definizione di successo — es. "i pazienti smettono di chiederlo in clinica" (imposta la review a +3 mesi)'
                className="w-full mt-2 px-3 py-2 rounded-lg border border-ggo-teal/40 bg-white text-xs"
            />
            {state === "saved" && <div className="text-xs text-emerald-600 mt-1.5">✓ Registrato — entra nel ciclo</div>}
            {state === "error" && <div className="text-xs text-red-600 mt-1.5">Errore — riprova (o controlla i log)</div>}
        </div>
    );
}

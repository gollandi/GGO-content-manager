"use client";

import { useEffect, useState } from "react";

/**
 * Two freshness sockets for the Portineria: the last time production made
 * something, and the week the performance snapshot reached. Both come from
 * the house state — the same read model the Atrio shows — so the room and
 * the entrance never disagree on what "stale" means. The decision queue is
 * NOT repeated here: it lives at Il Cancello and in the Atrio's strip.
 */
interface HousePulseState {
    night: { lastProductiveAt: string | null; zeroOutputStreak: number } | null;
    snapshot: { latestWeekOf: string | null; ageDays: number | null } | null;
    errors: string[];
}

type Tone = "ok" | "amber" | "seal";

const THRESHOLDS = {
    produce: { amber: 3, seal: 7 }, // days since last productive slot
    snapshot: { amber: 8, seal: 15 }, // days since the latest snapshot week
};

function daysSince(value: string | null): number | null {
    if (!value) return null;
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function tone(value: number | null, limits: { amber: number; seal: number }): Tone {
    if (value === null) return "seal";
    if (value >= limits.seal) return "seal";
    if (value >= limits.amber) return "amber";
    return "ok";
}

const TONE_CLASS: Record<Tone, string> = {
    ok: "border-paper-edge",
    amber: "border-[var(--sepia)] text-[var(--sepia)]",
    seal: "border-seal text-seal",
};

export default function HousePulse() {
    const [state, setState] = useState<HousePulseState | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetch("/api/house/state", { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) throw new Error(`house state ${res.status}`);
                const json = (await res.json()) as HousePulseState;
                if (alive) setState(json);
            })
            .catch((err: unknown) => alive && setError(String(err)));
        return () => {
            alive = false;
        };
    }, []);

    const produceDays = daysSince(state?.night?.lastProductiveAt ?? null);
    const cards: { label: string; value: string; note: string; tone: Tone }[] = state
        ? [
              {
                  label: "Ultima produzione",
                  value: !state.night ? "—" : produceDays === null ? "mai" : produceDays === 0 ? "oggi" : `${produceDays} gg fa`,
                  note: !state.night
                      ? "il registro delle run non risponde"
                      : state.night.zeroOutputStreak > 0
                        ? `${state.night.zeroOutputStreak} slot consecutivi a zero`
                        : "ultimo slot produce con output",
                  tone: !state.night ? "seal" : tone(produceDays, THRESHOLDS.produce),
              },
              {
                  label: "Snapshot performance",
                  value: state.snapshot?.latestWeekOf ? `settimana del ${state.snapshot.latestWeekOf.slice(0, 10)}` : "assente",
                  note: state.snapshot?.ageDays != null ? `${state.snapshot.ageDays} gg fa` : "nessuna settimana letta",
                  tone: tone(state.snapshot?.ageDays ?? null, THRESHOLDS.snapshot),
              },
          ]
        : [];

    return (
        <section className="mb-5">
            <div className="column-label mb-2">Polso della casa</div>
            {error && <p className="text-xs text-seal">{error}</p>}
            {!state && !error && <p className="text-xs text-plate-foreground-soft">Leggo il polso…</p>}
            {state && (
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    {cards.map((c) => (
                        <div key={c.label} className={`paper border px-3 py-2 text-paper-foreground ${TONE_CLASS[c.tone]}`}>
                            <div className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">{c.label}</div>
                            <div className="mt-0.5 text-sm font-bold">{c.value}</div>
                            {c.note && <div className="text-[11px] text-paper-foreground-soft">{c.note}</div>}
                        </div>
                    ))}
                </div>
            )}
            {state?.errors.length ? <p className="mt-1 text-[11px] text-seal">{state.errors.join(" · ")}</p> : null}
        </section>
    );
}

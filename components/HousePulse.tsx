"use client";

import { useEffect, useState } from "react";

/**
 * Three freshness sockets for the Portineria: the last time production made
 * something, the length and age of the decision queue, the week the
 * performance snapshot reached. Amber and oxblood thresholds are written
 * here once so the room and the operator agree on what "stale" means.
 */

interface Pulse {
    produce: { lastRunAt: string | null; lastProductiveAt: string | null; zeroOutputStreak: number };
    desk: { pending: number; pendingOldestDays: number | null; approvedUnclaimed: number };
    snapshot: { latestWeekOf: string | null; ageDays: number | null };
    errors: string[];
}

type Tone = "ok" | "amber" | "seal";

const THRESHOLDS = {
    produce: { amber: 3, seal: 7 }, // days since last productive slot
    snapshot: { amber: 8, seal: 15 }, // days since the latest snapshot week
    deskPending: { amber: 30, seal: 60 }, // rows awaiting a decision
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
    const [pulse, setPulse] = useState<Pulse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetch("/api/ernesto/pulse", { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) throw new Error(`pulse ${res.status}`);
                const json = (await res.json()) as Pulse;
                if (alive) setPulse(json);
            })
            .catch((err: unknown) => alive && setError(String(err)));
        return () => {
            alive = false;
        };
    }, []);

    const produceDays = daysSince(pulse?.produce.lastProductiveAt ?? null);
    const cards: { label: string; value: string; note: string; tone: Tone }[] = pulse
        ? [
              {
                  label: "Ultima produzione",
                  value: produceDays === null ? "mai" : produceDays === 0 ? "oggi" : `${produceDays} gg fa`,
                  note:
                      pulse.produce.zeroOutputStreak > 0
                          ? `${pulse.produce.zeroOutputStreak} slot consecutivi a zero`
                          : "ultimo slot produce con output",
                  tone: tone(produceDays, THRESHOLDS.produce),
              },
              {
                  label: "Coda decisioni",
                  value: String(pulse.desk.pending),
                  note:
                      (pulse.desk.pendingOldestDays !== null ? `la più vecchia da ${pulse.desk.pendingOldestDays} gg` : "") +
                      (pulse.desk.approvedUnclaimed > 0 ? ` · ${pulse.desk.approvedUnclaimed} approvate mai reclamate` : ""),
                  tone: tone(pulse.desk.pending, THRESHOLDS.deskPending),
              },
              {
                  label: "Snapshot performance",
                  value: pulse.snapshot.latestWeekOf ? `settimana del ${pulse.snapshot.latestWeekOf.slice(0, 10)}` : "assente",
                  note: pulse.snapshot.ageDays !== null ? `${pulse.snapshot.ageDays} gg fa` : "nessuna settimana letta",
                  tone: tone(pulse.snapshot.ageDays, THRESHOLDS.snapshot),
              },
          ]
        : [];

    return (
        <section className="mb-5">
            <div className="column-label mb-2">Polso della casa</div>
            {error && <p className="text-xs text-seal">{error}</p>}
            {!pulse && !error && <p className="text-xs text-plate-foreground-soft">Leggo il polso…</p>}
            {pulse && (
                <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                    {cards.map((c) => (
                        <div key={c.label} className={`paper border px-3 py-2 text-paper-foreground ${TONE_CLASS[c.tone]}`}>
                            <div className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">{c.label}</div>
                            <div className="mt-0.5 text-sm font-bold">{c.value}</div>
                            {c.note && <div className="text-[11px] text-paper-foreground-soft">{c.note}</div>}
                        </div>
                    ))}
                </div>
            )}
            {pulse?.errors.length ? <p className="mt-1 text-[11px] text-seal">{pulse.errors.join(" · ")}</p> : null}
        </section>
    );
}

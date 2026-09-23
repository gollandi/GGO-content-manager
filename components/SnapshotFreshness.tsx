import type { SnapshotFreshness as Freshness } from "../lib/cockpit/snapshots";

export function SnapshotFreshness({ value }: { value?: Freshness }) {
    if (!value?.stale) return null;
    return <span role="status" className="text-seal"> · dati salvati {Math.max(1, Math.floor(value.ageSeconds / 60))} min fa
        {value.refreshing ? "; aggiornamento in corso" : "; aggiornamento da riprovare"}</span>;
}

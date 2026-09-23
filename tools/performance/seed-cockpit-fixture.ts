/** Local-only synthetic projections for production HTTP/restart checks. */
import { snapshot } from "../../lib/cockpit/snapshots";
if (!process.env.COCKPIT_SNAPSHOT_DIR?.startsWith("/tmp/ggo-cockpit-fixture-")) throw new Error("Use an isolated /tmp/ggo-cockpit-fixture- directory");
async function main() {
const generatedAt = new Date().toISOString();
const desk = [{ rowId: "fixture", title: "Verificare il calendario editoriale", type: "question", status: "Pending",
    priority: "Normal", due: null, correction: "", body: "Synthetic local test data", videos: [], media: [], url: "" }];
await snapshot("cancello", async () => ({ generatedAt, cached: false, desk, wall: [], calendar: [], website: [], warnings: [] }),
    { ttlMs: 300_000, valid: () => true });
await snapshot("house", async () => ({ generatedAt,
    awaiting: { total: 0, social: 0, desk: 0, website: 0, impact: 0, oldestDays: null, scheduled: 0, needsOpen: 0,
        questions: 1, questionsByKind: { question: 1 }, questionsOldestDays: null },
    night: { runs: 0, ok: 0, attention: 0, failed: [], lastProductiveAt: null, zeroOutputStreak: 0 },
    week: { weekOf: "2026-09-07", lanes: [], total: 0, published: 0, target: null },
    editorial: { live: 0, stale: 0, oldestStaleDays: null, pifLit: 0 },
    pif: { rows: 0, lit: 0, unlit: 0, overdue: 0, nextReviewDate: null, nextReviewInDays: null },
    runs: { active: 0, failed: 0 }, retros: 0, ambrogioPending: 0,
    snapshot: { latestWeekOf: null, ageDays: null }, errors: [],
}), { ttlMs: 300_000, valid: () => true });

}
void main();

import { withFreshReads } from "../cache";
import { getMorningBrief } from "../notion/brief";
import { getDailyReports } from "./reports";

/** Reuses the existing read-only VPS timer. Failure must not take the cockpit down. */
export async function warmBriefings() {
    const results = await withFreshReads(() => Promise.allSettled([getMorningBrief({ wait: true }), getDailyReports({ wait: true })]));
    let ready = 0; let unavailable = 0;
    for (const result of results) {
        if (result.status === "rejected") { unavailable += 1; continue; }
        const narratives = "days" in result.value ? result.value.days.map((day) => day.narrative) : [result.value.narrative];
        for (const narrative of narratives) {
            if (narrative?.status === "ready") ready += 1;
            else if (narrative) unavailable += 1;
        }
    }
    return { ready, unavailable };
}

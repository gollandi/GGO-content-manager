import type { CancelloState } from "./state";
import { visibleCancelloSections } from "../auth/permissions";
import type { Role } from "../auth/roles";

/**
 * What a role is shown of the register. The service token and unrestricted
 * roles get the whole state, unchanged; the social media manager gets the
 * Content Calendar rows only — never the Desk, the wall or website patches.
 */
export function viewFor(state: CancelloState, role: Role | null): CancelloState {
    if (!role) return state;
    const show = visibleCancelloSections(role);
    return {
        ...state,
        wall: show.wall ? state.wall : [],
        desk: show.desk ? state.desk : [],
        calendar: show.calendar ? state.calendar : [],
        website: show.website ? state.website : [],
        warnings: show.desk && show.website ? state.warnings : [],
    };
}

/**
 * The recorded media paths of the calendar rows a role is shown. The media
 * route serves any file under the media root by path; for the social media
 * manager it serves only these, so Desk, wall and website assets hidden
 * from the register cannot be fetched by guessing a path.
 */
export function calendarMediaPaths(state: CancelloState): Set<string> {
    const out = new Set<string>();
    for (const row of state.calendar) {
        for (const m of row.media ?? []) {
            const q = m.url.indexOf("?");
            if (q < 0) continue;
            const p = new URLSearchParams(m.url.slice(q + 1)).get("path");
            if (p) out.add(p);
        }
    }
    return out;
}

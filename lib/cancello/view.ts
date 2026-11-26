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

// @vitest-environment node
// voices.ts reaches the server-only Sanity client through the views layer,
// which refuses to load where `window` exists.
import { describe, it, expect } from "vitest";
import { VOICES } from "../lib/citofono/voices";
import { depositaProposta } from "../lib/citofono/tools/deposita-proposta";

/**
 * The deposit tool moved out of voices.ts so that file could hold no Notion
 * write token (see ambrogio-no-write.test.ts). Moving code is exactly when a
 * behaviour quietly changes, so the distribution it had is asserted here
 * rather than assumed.
 */

const toolNames = (voice: keyof typeof VOICES) => VOICES[voice].tools.map((t) => t.name);

describe("Il Citofono tool distribution", () => {
    it("keeps the deposit tool out of Ambrogio's hands", () => {
        expect(toolNames("ambrogio")).not.toContain("deposita_proposta");
    });

    it("leaves Ambrogio with reads only", () => {
        expect(toolNames("ambrogio")).toEqual(["leggi_audit", "leggi_proposte", "leggi_activity_log"]);
    });

    it("still gives it to the voices that had it", () => {
        expect(toolNames("edmondo")).toContain("deposita_proposta");
        expect(toolNames("ettore")).toContain("deposita_proposta");
    });

    it("is the same tool object, not a copy that could drift", () => {
        const fromRegistry = VOICES.edmondo.tools.find((t) => t.name === "deposita_proposta");
        expect(fromRegistry).toBe(depositaProposta);
    });
});

describe("deposita_proposta", () => {
    it("refuses a session without the writer role, and records nothing", async () => {
        const result = await depositaProposta.run(
            { need: "A proposal", details: "why" },
            { isWriter: false, voice: "edmondo" }
        );
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/writer role/);
    });

    it("requires a title before it will write", async () => {
        const result = await depositaProposta.run(
            { need: "   ", details: "why" },
            { isWriter: true, voice: "edmondo" }
        );
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/need is required/);
    });
});

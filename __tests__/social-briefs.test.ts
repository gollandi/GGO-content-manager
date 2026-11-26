// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applySync, readBoard, readBoardFor, submit, COLLABORATOR_DAILY_CAP } from "../lib/board/store";
import { BriefError, routeRecipients, slugify, toCompose, STRATEGY_OUTLINE } from "../lib/social/briefs";
import type { BoardEvent } from "../lib/board/types";

const ALLOWED = ["ernesto", "samantha", "ginevra", "greta", "titti", "natascia", "jj"];
const NOW = new Date("2026-11-26T10:00:00Z");
const BODY = "Please plan three reels for December on varicocele, with the talk recap as the first one.";

let root: string;
beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "ggo-briefs-test-"));
    process.env.COCKPIT_BOARD_DIR = root;
});
afterEach(() => {
    delete process.env.COCKPIT_BOARD_DIR;
    rmSync(root, { recursive: true, force: true });
    vi.resetModules();
    vi.doUnmock("../lib/auth/api-guard");
});

describe("a brief becomes a board event", () => {
    it("routes a specialist with no slot through Ernesto, and a strategy to Ernesto always", () => {
        expect(routeRecipients(["samantha"], "brief", ALLOWED)).toEqual(["ernesto", "samantha"]);
        expect(routeRecipients(["ginevra"], "brief", ALLOWED)).toEqual(["ginevra"]);
        expect(routeRecipients(["natascia"], "strategy", ALLOWED)).toEqual(["ernesto", "natascia"]);
        expect(() => routeRecipients(["house"], "brief", ALLOWED)).toThrow(BriefError);
        expect(() => routeRecipients(["ambrogio"], "brief", ALLOWED)).toThrow(/cannot address/);
        expect(() => routeRecipients([], "brief", ALLOWED)).toThrow(/at least one/);
    });

    it("makes a valid thread id and tags a strategy", () => {
        expect(slugify("Décembre: reels — varicocele!")).toBe("decembre-reels-varicocele");
        const c = toCompose({ mode: "open", kind: "strategy", title: "Q1 growth", to: [], body: STRATEGY_OUTLINE }, "diletta", ALLOWED, NOW);
        expect(c.threadId).toMatch(/^strategy-diletta-q1-growth-20261126$/);
        expect(c.tags).toEqual(["strategy", "social"]);
        expect(c.to).toEqual(["ernesto"]);
        expect(c.lang).toBe("en");
        expect(() => toCompose({ mode: "open", title: "x", to: ["ernesto"], body: BODY }, "diletta", ALLOWED, NOW)).toThrow(/title/);
        expect(() => toCompose({ mode: "open", title: "Reels", to: ["ernesto"], body: " " }, "diletta", ALLOWED, NOW)).toThrow(/Write/);
    });
});

const open = (over = {}) => toCompose({ mode: "open", kind: "brief", title: "December reels", to: ["ernesto"], body: BODY, ...over }, "diletta", ALLOWED, NOW);

describe("the store writes as the collaborator, held by the house's own writer", () => {
    it("signs the event with the handle, whatever the client says", async () => {
        const r = await submit({ ...open(), from: "jj" } as never, NOW, "diletta");
        expect(r.queued).toBe(true);
        expect(r.entry.event.from).toBe("diletta");
    });

    it("refuses a handle that is not on the house's collaborator roster", async () => {
        await expect(submit(open(), NOW, "ernesto")).rejects.toThrow(/not on the house's collaborator roster/);
        await expect(submit(open(), NOW, "greta")).rejects.toThrow(/not on the house's collaborator roster/);
    });

    it("refuses a recipient outside the social team and JJ", async () => {
        await expect(submit({ ...open(), to: "house" }, NOW, "diletta")).rejects.toThrow(/writes to/);
        await expect(submit({ ...open(), to: "ambrogio" }, NOW, "diletta")).rejects.toThrow(/writes to/);
    });

    it("stops at the daily cap", async () => {
        for (let i = 0; i < COLLABORATOR_DAILY_CAP; i++) {
            await submit({ ...open(), id: `diletta-${i}`, threadId: `brief-diletta-n${i}-20261126` }, NOW, "diletta");
        }
        await expect(submit({ ...open(), id: "diletta-x", threadId: "brief-diletta-over-20261126" }, NOW, "diletta")).rejects.toThrow(/limit/);
        // JJ is never capped.
        await expect(submit({ mode: "open", id: "jj-1", date: NOW.toISOString(), threadId: "jj-note", to: "ernesto", lang: "en", body: BODY }, NOW)).resolves.toMatchObject({ queued: true });
    });
});

const agent = (over: Partial<BoardEvent>): BoardEvent => ({
    id: "e-1", threadId: "t", date: "2026-11-25T08:00:00.000Z", kind: "message", from: "ernesto", to: "jj", lang: "en",
    body: "The weekly plan is ready for your review and steer when you have the time.", ...over,
});

describe("what a collaborator reads", () => {
    it("only threads they opened or are addressed in, and only their own refusals", async () => {
        await applySync({ events: [
            agent({ id: "a", threadId: "jj-private" }),
            agent({ id: "b", threadId: "ambrogio-audit", from: "ambrogio", to: "ettore" }),
            agent({ id: "c", threadId: "to-diletta", to: "diletta" }),
        ] }, NOW);
        await submit(open(), NOW, "diletta");
        const mine = readBoardFor("diletta").threads.map((t) => t.threadId).sort();
        expect(mine).toEqual(["brief-diletta-december-reels-20261126", "to-diletta"]);
        expect(readBoard().threads).toHaveLength(4);
        expect(readBoardFor("diletta").roster).toEqual([]);
    });
});

describe("/api/social/briefs", () => {
    const guard = (result: unknown) => vi.doMock("../lib/auth/api-guard", () => ({ requireAuth: async () => result }));
    const post = (body: unknown) => new Request("http://x/api/social/briefs", { method: "POST", body: JSON.stringify(body) });

    it("is for collaborators with a house name only", async () => {
        guard({ authenticated: true, email: "o@x", name: "JJ", role: "admin", houseHandle: null });
        let route = await import("../app/api/social/briefs/route");
        expect((await route.GET()).status).toBe(403);
        vi.resetModules();
        guard({ authenticated: true, email: "d@x", name: "Diletta", role: "social", houseHandle: null });
        route = await import("../app/api/social/briefs/route");
        const res = await route.GET();
        expect(res.status).toBe(409);
        expect((await res.json()).error).toMatch(/not set up/);
    });

    it("queues a brief signed by the collaborator, and refuses a thread that is not theirs", async () => {
        guard({ authenticated: true, email: "d@x", name: "Diletta", role: "social", houseHandle: "diletta" });
        await applySync({ events: [agent({ id: "a", threadId: "jj-private" })] }, NOW);
        const route = await import("../app/api/social/briefs/route");
        const ok = await route.POST(post({ mode: "open", kind: "brief", title: "December reels", to: ["samantha"], body: BODY }) as never);
        expect(ok.status).toBe(201);
        const { entry } = await ok.json();
        expect(entry.event.from).toBe("diletta");
        expect(entry.event.to).toEqual(["ernesto", "samantha"]);
        const theirs = await route.POST(post({ mode: "reply", threadId: "jj-private", to: ["ernesto"], body: BODY }) as never);
        expect(theirs.status).toBe(403);
        const close = await route.POST(post({ mode: "close", threadId: "jj-private" }) as never);
        expect(close.status).toBe(403);
    });
});

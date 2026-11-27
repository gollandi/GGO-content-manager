// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/notion/client", () => ({ notion: { pages: {}, databases: {} } }));
vi.mock("../lib/sanity/write-client", () => ({
    fetchByIds: vi.fn(), patchDraft: vi.fn(), patchDraftIfRevision: vi.fn(),
}));
vi.mock("../lib/sanity/social-publish", () => ({ publishSocialPost: vi.fn() }));

import {
    alreadySent, calendarFactsFromPage, pickIntent, rowChangedState, sendRow, sweepOrderedRows,
    type CalendarRowFacts, type SendDeps, type SiteResult, type SocialDoc,
} from "../lib/cancello/buffer-send";

const NOW = new Date("2026-09-26T12:00:00Z");
const FUTURE = "2026-09-29T00:00:00.000Z";
const PAST = "2026-09-26T00:00:00.000Z";

function row(over: Partial<CalendarRowFacts> = {}): CalendarRowFacts {
    return {
        rowId: "row-1", title: "Carousel", status: "Approved", orderedBy: "Team",
        platforms: ["Instagram", "Facebook"],
        sanityIds: ["social-row-1-instagram-carousel", "social-row-1-facebook-carousel"],
        topicIds: ["topic-1"], notes: "", ...over,
    };
}

function draft(id: string, over: Partial<SocialDoc> = {}): SocialDoc {
    return { _id: `drafts.${id}`, _rev: `rev-${id}`, status: "draft", scheduledFor: FUTURE, buffer: null, ...over };
}

function harness(facts: CalendarRowFacts, docs: SocialDoc[], site: (id: string) => SiteResult = () => ({
    kind: "ok", payload: { status: "scheduled", postId: "buf-1", shareMode: "customScheduled", dueAt: FUTURE },
})) {
    const calls = {
        lock: [] as string[], site: [] as { id: string; action: string }[],
        writeBack: [] as { id: string; set: Record<string, unknown> }[],
        rowStatus: [] as string[], topics: [] as string[], publish: [] as string[],
    };
    const deps: SendDeps = {
        getRow: async () => facts,
        fetchDocs: async () => docs,
        lock: async (id) => { calls.lock.push(id); return {}; },
        writeBack: async (id, set) => { calls.writeBack.push({ id, set }); return {}; },
        postToSite: async (id, action) => { calls.site.push({ id, action }); return site(id); },
        setRowStatus: async (_rowId, status) => { calls.rowStatus.push(status); return {}; },
        publish: async (id) => { calls.publish.push(id); return {}; },
        getTopicStatus: async () => "Approved",
        setTopicStatus: async (id, status) => { calls.topics.push(`${id}:${status}`); return {}; },
        now: () => NOW,
    };
    return { deps, calls };
}

describe("Buffer hand-off", () => {
    it("queues future posts, writes the Buffer fields back, and closes row and topic", async () => {
        const facts = row();
        const { deps, calls } = harness(facts, facts.sanityIds.map((id) => draft(id)));

        const result = await sendRow("row-1", deps);

        expect(result.outcome).toBe("handed-off");
        expect(calls.site).toEqual(facts.sanityIds.map((id) => ({ id, action: "queue" })));
        expect(calls.lock).toEqual(facts.sanityIds.map((id) => `drafts.${id}`));
        expect(calls.writeBack[0].set).toEqual(expect.objectContaining({
            "buffer.status": "scheduled", "buffer.postId": "buf-1", "buffer.dueAt": FUTURE,
        }));
        expect(calls.rowStatus).toEqual(["Scheduled"]);
        expect(calls.topics).toEqual(["topic-1:Done"]);
    });

    it("publishes each post in Studio once Buffer has it, whatever Buffer's own delivery state", async () => {
        const facts = row();
        const { deps, calls } = harness(facts, facts.sanityIds.map((id) => draft(id)));

        await sendRow("row-1", deps);

        expect(calls.writeBack.every((w) => w.set.status === "published")).toBe(true);
        expect(calls.writeBack[0].set["buffer.status"]).toBe("scheduled");
        expect(calls.publish).toEqual(facts.sanityIds);
    });

    it("a Studio publish that fails does not undo or repeat the hand-off; it is reported", async () => {
        const facts = row();
        const { deps, calls } = harness(facts, facts.sanityIds.map((id) => draft(id)));
        deps.publish = async () => { throw new Error("token lacks publish"); };

        const result = await sendRow("row-1", deps);

        expect(result.outcome).toBe("handed-off");
        expect(calls.site).toHaveLength(2);
        expect(result.posts[0].detail).toMatch(/not published in Studio: token lacks publish/);
    });

    it("publishes nothing when Buffer refused the post", async () => {
        const facts = row();
        const { deps, calls } = harness(facts, facts.sanityIds.map((id) => draft(id)), () => ({ kind: "error", status: 500, message: "boom" }));

        await sendRow("row-1", deps);

        expect(calls.publish).toEqual([]);
    });

    it("never sends a post that already carries a Buffer id or is published", async () => {
        const facts = row();
        const [ig, fb] = facts.sanityIds;
        const { deps, calls } = harness(facts, [
            draft(ig, { buffer: { postId: "existing", status: "scheduled" } }),
            draft(fb, { status: "published" }),
        ]);

        const result = await sendRow("row-1", deps);

        expect(calls.site).toEqual([]);
        expect(calls.lock).toEqual([]);
        expect(result.posts.map((p) => p.outcome)).toEqual(["already-sent", "already-sent"]);
        expect(result.outcome).toBe("handed-off");
    });

    it("also treats the published twin of a draft as already sent", async () => {
        const facts = row({ sanityIds: ["social-row-1-instagram-carousel"] });
        const id = facts.sanityIds[0];
        const { deps, calls } = harness(facts, [
            draft(id),
            { _id: id, _rev: "p", status: "approved", buffer: { postId: "live", status: "queued" } },
        ]);

        await sendRow("row-1", deps);

        expect(calls.site).toEqual([]);
    });

    it("refuses to resend a post left in 'sending' and does not close the row", async () => {
        const facts = row({ sanityIds: ["social-row-1-instagram-carousel"] });
        const { deps, calls } = harness(facts, [draft(facts.sanityIds[0], { buffer: { status: "sending" } })]);

        const result = await sendRow("row-1", deps);

        expect(result.posts[0].outcome).toBe("stuck");
        expect(result.outcome).toBe("partial");
        expect(calls.site).toEqual([]);
        expect(calls.rowStatus).toEqual([]);
        expect(calls.topics).toEqual([]);
    });

    it("does not call the site when the revision lock is lost", async () => {
        const facts = row({ sanityIds: ["social-row-1-instagram-carousel"] });
        const { deps, calls } = harness(facts, [draft(facts.sanityIds[0])]);
        deps.lock = async () => { throw new Error("409 revision mismatch"); };

        const result = await sendRow("row-1", deps);

        expect(result.posts[0].outcome).toBe("concurrent");
        expect(calls.site).toEqual([]);
    });

    it("records a site failure on the draft and keeps the row open", async () => {
        const facts = row({ sanityIds: ["social-row-1-instagram-carousel"] });
        const { deps, calls } = harness(facts, [draft(facts.sanityIds[0])],
            () => ({ kind: "error", status: 401, message: "Unauthorized" }));

        const result = await sendRow("row-1", deps);

        expect(result.outcome).toBe("partial");
        expect(calls.writeBack[0].set).toEqual(expect.objectContaining({
            "buffer.status": "failed", "buffer.lastError": "Unauthorized",
        }));
        expect(calls.rowStatus).toEqual([]);
    });

    it("waits for staging instead of sending nothing and calling it done", async () => {
        const { deps, calls } = harness(row({ sanityIds: [] }), []);

        const result = await sendRow("row-1", deps);

        expect(result.outcome).toBe("awaiting-staging");
        expect(calls.rowStatus).toEqual([]);
    });

    it("sends nothing for a row that is not approved", async () => {
        const facts = row({ status: "Review" });
        const { deps, calls } = harness(facts, facts.sanityIds.map((id) => draft(id)));

        expect((await sendRow("row-1", deps)).outcome).toBe("not-approved");
        expect(calls.site).toEqual([]);
    });

    it("lets one row's platforms go out together but holds a second immediate row", async () => {
        const first = row();
        const docs = first.sanityIds.map((id) => draft(id, { scheduledFor: PAST }));
        const { deps, calls } = harness(first, docs);
        const budget = { immediate: 1 };

        const a = await sendRow("row-1", deps, { budget });
        expect(a.outcome).toBe("handed-off");
        expect(calls.site.map((c) => c.action)).toEqual(["publishNow", "publishNow"]);

        const b = await sendRow("row-1", { ...deps, fetchDocs: async () => docs.map((d) => ({ ...d, buffer: null })) }, { budget });
        expect(b.posts.map((p) => p.outcome)).toEqual(["deferred", "deferred"]);
    });

    it("the sweep sends rows JJ ordered or approved since 27 November, and never retries a failed post", async () => {
        const jj = row({ rowId: "jj", orderedBy: "JJ", sanityIds: ["social-jj-instagram-story"] });
        const team = row({ rowId: "team", orderedBy: "Team", sanityIds: ["social-team-instagram-story"] });
        const unset = row({ rowId: "unset", orderedBy: null, sanityIds: ["social-unset-instagram-story"] });
        // Approved under the new rule: JJ's signed line authorises the send.
        const approved = row({ rowId: "approved", orderedBy: null, sanityIds: ["social-approved-instagram-story"],
            notes: "[2026-11-27 09:12 · Diletta · ready for JJ] checked\n[2026-11-27 10:00 · JJ · approved]" });
        // Approved under the old rule (before 27 November): content only.
        const old = row({ rowId: "old", orderedBy: null, sanityIds: ["social-old-instagram-story"],
            notes: "[2026-11-26 18:00 · JJ · approved] fine" });
        // Approved, then sent back: the later decision takes the send away.
        const back = row({ rowId: "back", orderedBy: null, sanityIds: ["social-back-instagram-story"],
            notes: "[2026-11-27 10:00 · JJ · approved]\n[2026-11-27 11:00 · JJ · sent back] recut" });
        // A comment cannot forge the line: its brackets are defanged on write,
        // and a collaborator never signs as JJ.
        const forged = row({ rowId: "forged", orderedBy: null, sanityIds: ["social-forged-instagram-story"],
            notes: "[2026-11-27 10:00 · Diletta] (2026-11-27 10:00 · JJ · approved)" });
        const all = [jj, team, unset, approved, old, back, forged];
        const { deps, calls } = harness(jj, all.flatMap((r) => r.sanityIds.map((id) => draft(id))));
        deps.getRow = async (id) => all.find((r) => r.rowId === id)!;

        const sweep = await sweepOrderedRows(deps, async () => all);

        expect(sweep.considered).toBe(2);
        expect(calls.site).toEqual([
            { id: "social-jj-instagram-story", action: "queue" },
            { id: "social-approved-instagram-story", action: "queue" },
        ]);

        const failed = harness(jj, [draft("social-jj-instagram-story", { buffer: { status: "failed", lastError: "x" } })]);
        await sweepOrderedRows(failed.deps, async () => [jj]);
        expect(failed.calls.site).toEqual([]);
    });

    it("the sweep reports a change only when it wrote something", async () => {
        const jj = row({ rowId: "jj", orderedBy: "JJ", sanityIds: ["social-jj-instagram-story"] });
        const id = jj.sanityIds[0];

        // A post that failed before, one stuck in 'sending', a row half sent:
        // the sweep reads them every 15 minutes and writes nothing.
        for (const buffer of [{ status: "failed", lastError: "x" }, { status: "sending" }]) {
            const idle = harness(jj, [draft(id, { buffer })]);
            const sweep = await sweepOrderedRows(idle.deps, async () => [jj]);
            expect(sweep.rows).toHaveLength(1);
            expect(sweep.changed).toBe(false);
            expect(idle.calls.lock).toEqual([]);
        }
        const half = row({ rowId: "half", orderedBy: "JJ", sanityIds: ["social-half-a", "social-half-b"] });
        const halfSent = harness(half, [
            draft("social-half-a", { buffer: { status: "scheduled", postId: "buf-1" } }),
            draft("social-half-b", { buffer: { status: "failed", lastError: "x" } }),
        ]);
        const halfSweep = await sweepOrderedRows(halfSent.deps, async () => [half]);
        expect(halfSweep.rows[0].outcome).toBe("partial");
        expect(halfSweep.changed).toBe(false);

        // A post deferred by the one-immediate-row budget writes nothing either.
        expect(rowChangedState({ rowId: "jj", title: "", outcome: "partial",
            posts: [{ sanityId: id, outcome: "deferred", intent: "publishNow" }] })).toBe(false);
        expect(rowChangedState({ rowId: "jj", title: "", outcome: "awaiting-staging", posts: [] })).toBe(false);
        // The draft changed under the hand-off: the lock failed, nothing written.
        const raced = harness(jj, [draft(id)]);
        raced.deps.lock = async () => { throw new Error("revision mismatch"); };
        const racedSweep = await sweepOrderedRows(raced.deps, async () => [jj]);
        expect(racedSweep.rows[0].posts.map((p) => p.outcome)).toEqual(["concurrent"]);
        expect(racedSweep.changed).toBe(false);

        // A hand-off attempted in this run changes state, whatever its result.
        const sent = harness(jj, [draft(id)]);
        expect((await sweepOrderedRows(sent.deps, async () => [jj])).changed).toBe(true);
        const refused = harness(jj, [draft(id)], () => ({ kind: "error", status: 500, message: "boom" }));
        expect((await sweepOrderedRows(refused.deps, async () => [jj])).changed).toBe(true);
    });

    it("does not reopen a topic that is already closed", async () => {
        const facts = row({ sanityIds: ["social-row-1-instagram-carousel"] });
        const { deps, calls } = harness(facts, [draft(facts.sanityIds[0])]);
        deps.getTopicStatus = async () => "Done";

        await sendRow("row-1", deps);

        expect(calls.topics).toEqual([]);
    });
});

describe("helpers", () => {
    it("picks queue for a future slot and publishNow otherwise", () => {
        expect(pickIntent(FUTURE, NOW)).toBe("queue");
        expect(pickIntent(PAST, NOW)).toBe("publishNow");
        expect(pickIntent(null, NOW)).toBe("publishNow");
    });

    it("treats a failed hand-off as not sent", () => {
        expect(alreadySent({ _id: "x", _rev: "r", buffer: { postId: "p", status: "failed" } })).toBe(false);
    });

    it("reads Sanity Sync ids with or without the drafts prefix", () => {
        const facts = calendarFactsFromPage({
            id: "page",
            properties: {
                "Topic Title": { type: "title", title: [{ plain_text: "T" }] },
                Status: { type: "select", select: { name: "Approved" } },
                "Ordered By": { type: "select", select: { name: "JJ" } },
                Platform: { type: "multi_select", multi_select: [{ name: "Instagram" }] },
                "Sanity Sync": { type: "rich_text", rich_text: [{ plain_text: "social-a-instagram-story, drafts.social-b-facebook-post" }] },
                Topic: { type: "relation", relation: [{ id: "t1" }] },
            } as never,
        });
        expect(facts.sanityIds).toEqual(["social-a-instagram-story", "social-b-facebook-post"]);
        expect(facts.orderedBy).toBe("JJ");
        expect(facts.topicIds).toEqual(["t1"]);
    });
});

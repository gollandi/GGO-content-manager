// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/notion/client", () => ({ notion: { pages: {}, databases: {} } }));
vi.mock("../lib/sanity/write-client", () => ({
    fetchByIds: vi.fn(), patchDraft: vi.fn(), patchDraftIfRevision: vi.fn(),
}));

import {
    alreadySent, calendarFactsFromPage, pickIntent, sendRow, sweepOrderedRows,
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
        topicIds: ["topic-1"], ...over,
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
        rowStatus: [] as string[], topics: [] as string[],
    };
    const deps: SendDeps = {
        getRow: async () => facts,
        fetchDocs: async () => docs,
        lock: async (id) => { calls.lock.push(id); return {}; },
        writeBack: async (id, set) => { calls.writeBack.push({ id, set }); return {}; },
        postToSite: async (id, action) => { calls.site.push({ id, action }); return site(id); },
        setRowStatus: async (_rowId, status) => { calls.rowStatus.push(status); return {}; },
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

    it("the sweep sends only rows JJ ordered and never retries a failed post", async () => {
        const jj = row({ rowId: "jj", orderedBy: "JJ", sanityIds: ["social-jj-instagram-story"] });
        const team = row({ rowId: "team", orderedBy: "Team", sanityIds: ["social-team-instagram-story"] });
        const unset = row({ rowId: "unset", orderedBy: null, sanityIds: ["social-unset-instagram-story"] });
        const { deps, calls } = harness(jj, [draft("social-jj-instagram-story")]);
        deps.getRow = async (id) => [jj, team, unset].find((r) => r.rowId === id)!;

        const sweep = await sweepOrderedRows(deps, async () => [jj, team, unset]);

        expect(sweep.considered).toBe(1);
        expect(calls.site).toEqual([{ id: "social-jj-instagram-story", action: "queue" }]);

        const failed = harness(jj, [draft("social-jj-instagram-story", { buffer: { status: "failed", lastError: "x" } })]);
        await sweepOrderedRows(failed.deps, async () => [jj]);
        expect(failed.calls.site).toEqual([]);
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

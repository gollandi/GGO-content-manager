// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { createPageCache } from "../lib/cancello/page-cache";

const MIN = 60_000;
const page = (id: string, db = "assets-db", location = "file:///a.png") => ({
    id, object: "page", last_edited_time: "2026-11-16T10:00:00.000Z",
    parent: { type: "database_id", database_id: db },
    properties: { "File Location": { type: "rich_text", rich_text: [{ plain_text: location }] } },
}) as unknown as PageObjectResponse;

function clock(start = Date.parse("2026-11-16T10:00:00.000Z")) {
    let t = start;
    return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("Cancello page cache", () => {
    it("serves an unchanged page from the previous crawl after one changed-since query per database", async () => {
        const c = clock();
        const cache = createPageCache({ now: c.now });
        cache.reader().store(page("a"), c.now());
        cache.reader().store(page("b", "needs-db"), c.now());
        c.advance(10 * MIN);

        const changedSince = vi.fn(async () => [] as PageObjectResponse[]);
        await cache.validate(changedSince);

        expect(changedSince).toHaveBeenCalledTimes(2);
        // Since the page was fetched, less a margin for Notion's minute-rounded timestamps.
        expect(changedSince).toHaveBeenCalledWith("assetsdb", "2026-11-16T09:55:00.000Z");
        expect(cache.reader().get("a")).toMatchObject({ id: "a" });
    });

    it("replaces a page Notion reports as changed with the fresh copy", async () => {
        const c = clock();
        const cache = createPageCache({ now: c.now });
        cache.reader().store(page("a"), c.now());
        c.advance(10 * MIN);
        await cache.validate(async () => [page("a", "assets-db", "file:///b.png")]);
        const fresh = cache.reader().get("a") as PageObjectResponse;
        expect((fresh.properties["File Location"] as { rich_text: { plain_text: string }[] }).rich_text[0].plain_text)
            .toBe("file:///b.png");

        // The next check starts from the last successful one, not from the first fetch.
        c.advance(10 * MIN);
        const changedSince = vi.fn(async () => [] as PageObjectResponse[]);
        await cache.validate(changedSince);
        expect(changedSince).toHaveBeenCalledWith("assetsdb", "2026-11-16T10:05:00.000Z");
    });

    it("drops a database's pages when it cannot be checked", async () => {
        const cache = createPageCache();
        cache.reader().store(page("a"), Date.now());
        await cache.validate(async () => { throw Object.assign(new Error("forbidden"), { status: 403 }); });
        expect(cache.reader().get("a")).toBeUndefined();
    });

    it("remembers a page Notion does not share for a while, then asks again", async () => {
        const c = clock();
        const cache = createPageCache({ now: c.now, missTtlMs: 30 * MIN });
        cache.reader().storeMissing("gone");
        expect(cache.reader().get("gone")).toBe("missing");
        c.advance(31 * MIN);
        expect(cache.reader().get("gone")).toBeUndefined();
    });

    it("never keeps a page past its maximum age, checked or not", async () => {
        const c = clock();
        const cache = createPageCache({ now: c.now, maxAgeMs: 60 * MIN });
        cache.reader().store(page("a"), c.now());
        c.advance(61 * MIN);
        await cache.validate(async () => []);
        expect(cache.reader().get("a")).toBeUndefined();
    });

    it("a fenced crawl neither reads nor writes the cache, and an interrupted check does not count", async () => {
        const c = clock();
        const cache = createPageCache({ now: c.now });
        const before = cache.reader();
        cache.reader().store(page("a"), c.now());
        cache.fence();
        before.store(page("late"), c.now());
        expect(before.get("a")).toBeUndefined();
        expect(cache.reader().get("late")).toBeUndefined();
        expect(cache.reader().get("a")).toMatchObject({ id: "a" });

        c.advance(10 * MIN);
        await cache.validate(async () => { cache.fence(); return [page("a", "assets-db", "file:///stale.png")]; });
        const kept = cache.reader().get("a") as PageObjectResponse;
        expect((kept.properties["File Location"] as { rich_text: { plain_text: string }[] }).rich_text[0].plain_text)
            .toBe("file:///a.png");
        const changedSince = vi.fn(async () => [] as PageObjectResponse[]);
        await cache.validate(changedSince);
        expect(changedSince).toHaveBeenCalledWith("assetsdb", "2026-11-16T09:55:00.000Z");
    });

    it("does not cache pages that live outside a database", () => {
        const cache = createPageCache();
        cache.reader().store({ ...page("loose"), parent: { type: "page_id", page_id: "p" } } as unknown as PageObjectResponse, Date.now());
        expect(cache.reader().get("loose")).toBeUndefined();
    });

    it("clear forgets everything", () => {
        const cache = createPageCache();
        cache.reader().store(page("a"), Date.now());
        cache.clear();
        expect(cache.reader().get("a")).toBeUndefined();
    });
});

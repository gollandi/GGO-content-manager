// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { query, retrieve, blocks } = vi.hoisted(() => ({ query: vi.fn(), retrieve: vi.fn(), blocks: vi.fn() }));
vi.mock("../lib/notion/client", () => ({ notion: { databases: { query }, pages: { retrieve }, blocks: { children: { list: blocks } } } }));
vi.mock("../lib/config", () => ({ notionConfig: { dbs: {
  ernestoDesk: () => "desk", contentCalendar: () => "calendar", contentAssetHouse: () => "website",
} } }));
vi.mock("../lib/sanity/clients", () => ({ ggomedRawClient: { fetch: vi.fn().mockResolvedValue([]) } }));
vi.mock("../lib/cancello/patches", () => ({ findPatchForAsset: () => null, patchAlreadyApplied: () => false, operationViews: () => [] }));
import { invalidateCancelloCache, loadCancelloState } from "../lib/cancello/state";

const REVISION = "2026-09-08T10:00:00.000Z";
const select = (name: string) => ({ type: "select", select: { name } });
const text = (value: string) => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
const relations = (...ids: string[]) => ({ type: "relation", relation: ids.map((id) => ({ id })) });
const page = (id: string, extra: object = {}) => ({
  id, object: "page", last_edited_time: REVISION, created_time: REVISION, url: "",
  parent: { type: "database_id", database_id: "desk" },
  properties: { Item: text(id), Type: select("question"), Status: select("Pending"), ...extra },
});
let rows: ReturnType<typeof page>[];
beforeEach(() => {
  invalidateCancelloCache();
  vi.useFakeTimers();
  query.mockReset(); retrieve.mockReset(); blocks.mockReset();
  rows = Array.from({ length: 233 }, (_, index) => page(`desk-${index}`, { "Media Assets": relations("shared-asset") }));
  query.mockImplementation(async ({ database_id, start_cursor }: { database_id: string; start_cursor?: string }) => {
    const all = database_id === "desk" ? rows : [];
    const start = Number(start_cursor ?? 0);
    return { results: all.slice(start, start + 100), next_cursor: start + 100 < all.length ? String(start + 100) : null };
  });
  retrieve.mockResolvedValue(page("shared-asset", { "File Location": text("") }));
  blocks.mockResolvedValue({ results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "Fixture body" }] } }], next_cursor: null });
});
afterEach(() => { invalidateCancelloCache(); vi.useRealTimers(); });

describe("Cancello request volume and freshness", () => {
  it("reads a shared asset once and reuses unchanged bodies on the next snapshot", async () => {
    const first = await loadCancelloState();
    expect(first.desk).toHaveLength(233);
    expect(blocks).toHaveBeenCalledTimes(233);
    expect(retrieve).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    const second = await loadCancelloState();
    expect(second.cached).toBe(false);
    expect(second.desk).toEqual(first.desk);
    expect(blocks).toHaveBeenCalledTimes(233);
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(10);
  });

  it("re-reads only edited bodies, while always re-reading current statuses and relations", async () => {
    await loadCancelloState();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    rows[0] = { ...rows[0], last_edited_time: "2026-09-08T10:02:00.000Z", properties: { ...rows[0].properties, Status: select("Approved") } };
    blocks.mockResolvedValue({ results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "Edited body" }] } }], next_cursor: null });
    const state = await loadCancelloState();
    expect(blocks).toHaveBeenCalledTimes(234);
    expect(state.desk[0]).toMatchObject({ status: "Approved", body: "Edited body" });
    expect(state.desk[1].body).toBe("Fixture body");
  });

  it("an explicit refresh re-reads all bodies and concurrent refreshes share one crawl", async () => {
    await loadCancelloState();
    const results = await Promise.all([loadCancelloState({ refresh: true }), loadCancelloState({ refresh: true })]);
    expect(results[0]).toEqual(results[1]);
    expect(blocks).toHaveBeenCalledTimes(466);
    expect(query).toHaveBeenCalledTimes(10);
  });

  it("an invalidated crawl cannot resurrect the old state or cache later queued bodies", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    blocks.mockImplementationOnce(async () => { await pending; return { results: [], next_cursor: null }; });
    const old = loadCancelloState();
    await vi.advanceTimersByTimeAsync(0);
    invalidateCancelloCache();
    rows = [page("replacement")];
    const current = await loadCancelloState();
    release();
    await old;
    const cached = await loadCancelloState();
    expect(cached.desk).toEqual(current.desk);
    expect(cached.desk[0].rowId).toBe("replacement");
  });

  it("keeps a linked calendar preview while reusing a page already returned by its query", async () => {
    const calendarId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    rows = [page("desk", { "Calendar Row": relations(calendarId) })];
    const calendar = { ...page(calendarId, { Status: select("Review"), "Card URL": { type: "url", url: "https://ggomed.co.uk/fixture-card" } }),
      parent: { type: "database_id", database_id: "calendar" } };
    query.mockImplementation(async ({ database_id }: { database_id: string }) => ({ results: database_id === "desk" ? rows : database_id === "calendar" ? [calendar] : [], next_cursor: null }));
    const result = await loadCancelloState();
    expect(result.desk[0].media).toEqual([{ kind: "image", url: "https://ggomed.co.uk/fixture-card" }]);
    expect(result.calendar[0].media).toEqual(result.desk[0].media);
    expect(retrieve).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { query, retrieve, blocks } = vi.hoisted(() => ({ query: vi.fn(), retrieve: vi.fn(), blocks: vi.fn() }));
vi.mock("../lib/notion/client", () => ({ notion: { databases: { query }, pages: { retrieve }, blocks: { children: { list: blocks } } } }));
vi.mock("../lib/config", () => ({ notionConfig: { dbs: {
  ernestoDesk: () => "desk", contentCalendar: () => "calendar", contentAssetHouse: () => "website",
} } }));
vi.mock("../lib/sanity/clients", () => ({ ggomedRawClient: { fetch: vi.fn().mockResolvedValue([]) } }));
// Any fixture path counts as one of JJ's media trees; existence is still real.
vi.mock("../lib/cancello/paths", async (original) => ({
  ...(await original<typeof import("../lib/cancello/paths")>()), isPathWithinRoots: () => true,
}));
vi.mock("../lib/cancello/patches", () => ({ findPatchForAsset: () => null, patchAlreadyApplied: () => false, operationViews: () => [] }));
import {
  CancelloStateTimeoutError, invalidateCancelloCache, loadCancelloState, loadCancelloStateWithin, resetCancelloCaches,
} from "../lib/cancello/state";

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
let changed: ReturnType<typeof page>[];
beforeEach(() => {
  resetCancelloCaches();
  vi.useFakeTimers();
  query.mockReset(); retrieve.mockReset(); blocks.mockReset();
  rows = Array.from({ length: 233 }, (_, index) => page(`desk-${index}`, { "Media Assets": relations("shared-asset") }));
  changed = [];
  query.mockImplementation(async ({ database_id, start_cursor, filter }: { database_id: string; start_cursor?: string; filter?: { timestamp?: string } }) => {
    // The page cache's "edited since" check: only what the test says changed.
    if (filter?.timestamp === "last_edited_time") return { results: changed, next_cursor: null };
    const all = database_id === "desk" ? rows : [];
    const start = Number(start_cursor ?? 0);
    return { results: all.slice(start, start + 100), next_cursor: start + 100 < all.length ? String(start + 100) : null };
  });
  retrieve.mockResolvedValue(page("shared-asset", { "File Location": text("") }));
  blocks.mockResolvedValue({ results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "Fixture body" }] } }], next_cursor: null });
});
afterEach(() => { resetCancelloCaches(); vi.useRealTimers(); });

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
    // The shared asset is confirmed by one "edited since" query, not re-read.
    expect(retrieve).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(11);
  });

  it("uses the fresh copy of a linked page Notion reports as edited", async () => {
    retrieve.mockResolvedValue(page("shared-asset", { "File Location": text("") }));
    await loadCancelloState();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    const still = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cancello-")), "fresh.png");
    fs.writeFileSync(still, "");
    changed = [page("shared-asset", { "File Location": text(`file://${still}`) })];
    const next = await loadCancelloState();
    expect(retrieve).toHaveBeenCalledOnce();
    expect(next.desk[0].media).toEqual([{ kind: "image", url: `/media?path=${encodeURIComponent(still)}` }]);
    expect(query.mock.calls.some(([args]) => (args as { filter?: { timestamp?: string } }).filter?.timestamp === "last_edited_time")).toBe(true);
  });

  it("asks for a page Notion does not share once, not on every crawl, and does not call it a failed read", async () => {
    retrieve.mockRejectedValue(Object.assign(new Error("object_not_found"), { status: 404 }));
    const first = await loadCancelloState();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    const second = await loadCancelloState();
    expect(retrieve).toHaveBeenCalledOnce();
    expect(first.warnings).toEqual([]);
    expect(second.warnings).toEqual([]);
  });

  it("a decision keeps the caches: the next crawl re-reads only what changed", async () => {
    await loadCancelloState();
    invalidateCancelloCache();
    rows[0] = { ...rows[0], last_edited_time: "2026-09-08T10:02:00.000Z", properties: { ...rows[0].properties, Status: select("Approved") } };
    const after = await loadCancelloState();
    expect(after.desk[0].status).toBe("Approved");
    expect(blocks).toHaveBeenCalledTimes(234);
    expect(retrieve).toHaveBeenCalledOnce();
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

  it("a crawl that outlives its deadline fails loud by name, and the crawl still lands", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const original = query.getMockImplementation()!;
    query.mockImplementationOnce(async (args: never) => { await pending; return original(args); });
    const slow = loadCancelloStateWithin(20_000);
    const failure = expect(slow).rejects.toBeInstanceOf(CancelloStateTimeoutError);
    await vi.advanceTimersByTimeAsync(20_000);
    await failure;
    await expect(slow).rejects.toMatchObject({ name: "CancelloStateTimeoutError", timeoutMs: 20_000 });
    release();
    await vi.advanceTimersByTimeAsync(0);
    // The abandoned wait does not abandon the work: the next read is served
    // from the crawl that was already running, not from a fresh one.
    const state = await loadCancelloStateWithin(20_000);
    expect(state.desk).toHaveLength(233);
    expect(blocks).toHaveBeenCalledTimes(233);
    // One crawl in all (desk 3 pages, calendar, website): the retry joined it.
    expect(query).toHaveBeenCalledTimes(5);
  });

  it("a crawl within its deadline returns the state", async () => {
    const state = await loadCancelloStateWithin(20_000);
    expect(state.desk).toHaveLength(233);
  });

  it("a decision during a crawl leaves it on the caches, so the crawl a fenced snapshot waits for stays quick", async () => {
    await loadCancelloState();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const original = query.getMockImplementation()!;
    query.mockImplementationOnce(async (args: never) => { await pending; return original(args); });
    const crawl = loadCancelloState();
    await vi.advanceTimersByTimeAsync(0);
    invalidateCancelloCache();
    release();
    await crawl;
    await loadCancelloState();
    expect(retrieve).toHaveBeenCalledOnce();
    expect(blocks).toHaveBeenCalledTimes(233);
  });

  it("a desk card reads a linked Calendar row from the fresh Calendar query, not from an older cached copy", async () => {
    // Assets are attached to a Calendar row from the asset's side; whether
    // Notion then bumps the row's last_edited_time is not something to rely on.
    const calendarId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    rows = [page("desk", { Type: select("publish-approval"), "Calendar Row": relations(calendarId) })];
    const asCalendar = (extra: object) => ({ ...page(calendarId, extra), parent: { type: "database_id", database_id: "calendar" } });
    let active: ReturnType<typeof asCalendar>[] = [];
    retrieve.mockResolvedValue(asCalendar({ Status: select("Published") }));
    query.mockImplementation(async ({ database_id, filter }: { database_id: string; filter?: { timestamp?: string } }) => {
      if (filter?.timestamp === "last_edited_time") return { results: [], next_cursor: null };
      // The Calendar query answers last, as the bigger one does in practice.
      if (database_id === "calendar") await new Promise((resolve) => setTimeout(resolve, 1000));
      return { results: database_id === "desk" ? rows : database_id === "calendar" ? active : [], next_cursor: null };
    });
    const settle = async <T>(work: Promise<T>) => { await vi.advanceTimersByTimeAsync(1000); return work; };
    const first = await settle(loadCancelloState());
    expect(first.desk[0].media).toEqual([]);
    expect(retrieve).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5 * 60_000 + 1);
    active = [asCalendar({ Status: select("Review"), "Card URL": { type: "url", url: "https://ggomed.co.uk/fresh-card" } })];
    const second = await settle(loadCancelloState());
    expect(second.desk[0].media).toEqual([{ kind: "image", url: "https://ggomed.co.uk/fresh-card" }]);
    expect(second.calendar[0].media).toEqual(second.desk[0].media);
    expect(retrieve).toHaveBeenCalledOnce();
  });
});

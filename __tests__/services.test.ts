import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Notion client before importing services
vi.mock("../lib/notion/client", () => ({
  notion: {
    databases: {
      query: vi.fn(),
    },
    pages: {
      retrieve: vi.fn(),
    },
  },
  isNotionConfigured: () => true,
}));

// Mock cache to pass through
vi.mock("../lib/cache", () => ({
  cached: vi.fn((_key: string, fetcher: () => Promise<unknown>) => fetcher()),
  invalidateCache: vi.fn(),
}));

import { notion } from "../lib/notion/client";
import {
  getContentAssets,
  getEvidenceSources,
  getKeywords,
  getSchemaValidations,
  getPatientJourneys,
  getContentAsset,
} from "../lib/notion/services";

const mockQuery = vi.mocked(notion.databases.query);
const mockRetrieve = vi.mocked(notion.pages.retrieve);

function makeMockPage(id: string, properties: Record<string, unknown> = {}) {
  return {
    id,
    object: "page",
    created_time: "2024-01-01T00:00:00.000Z",
    last_edited_time: "2024-06-01T00:00:00.000Z",
    created_by: { object: "user", id: "u1" },
    last_edited_by: { object: "user", id: "u1" },
    cover: null,
    icon: null,
    parent: { type: "database_id", database_id: "db1" },
    archived: false,
    in_trash: false,
    url: `https://notion.so/${id}`,
    public_url: null,
    properties: {
      Title: { type: "title", title: [{ plain_text: `Page ${id}` }] },
      ...properties,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getContentAssets", () => {
  it("fetches all pages with pagination", async () => {
    mockQuery
      .mockResolvedValueOnce({
        type: "page",
        page: {},
        object: "list",
        results: [makeMockPage("p1"), makeMockPage("p2")],
        next_cursor: "cursor-2",
        has_more: true,
      } as ReturnType<typeof notion.databases.query> extends Promise<infer R> ? R : never)
      .mockResolvedValueOnce({
        type: "page",
        page: {},
        object: "list",
        results: [makeMockPage("p3")],
        next_cursor: null,
        has_more: false,
      } as ReturnType<typeof notion.databases.query> extends Promise<infer R> ? R : never);

    const items = await getContentAssets();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Page p1");
    expect(items[2].title).toBe("Page p3");
  });

  it("returns empty array for empty database", async () => {
    mockQuery.mockResolvedValueOnce({
      type: "page",
      page: {},
      object: "list",
      results: [],
      next_cursor: null,
      has_more: false,
    } as ReturnType<typeof notion.databases.query> extends Promise<infer R> ? R : never);

    const items = await getContentAssets();
    expect(items).toEqual([]);
  });
});

describe("getEvidenceSources", () => {
  it("fetches and maps evidence items", async () => {
    mockQuery.mockResolvedValueOnce({
      type: "page",
      page: {},
      object: "list",
      results: [
        makeMockPage("ev1", {
          "Source Name": { type: "title", title: [{ plain_text: "NICE NG83" }] },
          Organisation: { type: "select", select: { name: "NICE" } },
        }),
      ],
      next_cursor: null,
      has_more: false,
    } as ReturnType<typeof notion.databases.query> extends Promise<infer R> ? R : never);

    const items = await getEvidenceSources();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("NICE NG83");
    expect(items[0].organisation).toBe("NICE");
  });
});

describe("getContentAsset (single)", () => {
  it("retrieves and maps a single page", async () => {
    mockRetrieve.mockResolvedValueOnce(makeMockPage("single-1") as Awaited<ReturnType<typeof notion.pages.retrieve>>);

    const item = await getContentAsset("single-1");
    expect(item.id).toBe("single-1");
    expect(item.title).toBe("Page single-1");
    expect(mockRetrieve).toHaveBeenCalledWith({ page_id: "single-1" });
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterPages, pageUrl, summariseWeek, toPublicPage } from "../lib/social/views";
import { mapReport } from "../lib/notion/natascia";
import type { ContentItem } from "../lib/notion/types";
import type { PerformanceSnapshotRow } from "../lib/notion/editorial";

const row = (over: Partial<PerformanceSnapshotRow>): PerformanceSnapshotRow => ({
    id: "r", title: "t", channel: null, weekOf: null, source: null, impressions: null, clicks: null,
    ctr: null, averagePosition: null, sessions: null, engagementRate: null, assetIds: [], ...over,
});

describe("the Performance room", () => {
    it("sums only the latest week, by source", () => {
        const s = summariseWeek([
            row({ id: "a", weekOf: "2026-11-16", source: "GA4", sessions: 10 }),
            row({ id: "b", weekOf: "2026-11-16", source: "GA4", sessions: 5 }),
            row({ id: "c", weekOf: "2026-11-16", source: "Meta Graph", impressions: 300 }),
            row({ id: "d", weekOf: "2026-11-09", source: "GA4", sessions: 999 }),
        ]);
        expect(s.latest).toBe("2026-11-16");
        expect(Object.fromEntries(s.bySource)).toEqual({
            GA4: { rows: 2, impressions: 0, clicks: 0, sessions: 15 },
            "Meta Graph": { rows: 1, impressions: 300, clicks: 0, sessions: 0 },
        });
    });

    it("says there is no week rather than inventing one", () => {
        expect(summariseWeek([]).latest).toBeNull();
    });
});

describe("the Website room", () => {
    it("links only to ggomed.co.uk", () => {
        expect(pageUrl("treatments/varicocele")).toBe("https://www.ggomed.co.uk/treatments/varicocele");
        expect(pageUrl("/about")).toBe("https://www.ggomed.co.uk/about");
        expect(pageUrl("https://evil.example/x")).toBeNull();
        expect(pageUrl("https://www.ggomed.co.uk.evil.example/x")).toBeNull();
        expect(pageUrl("https://www.ggomed.co.uk@evil.example/")).toBeNull();
        expect(pageUrl("https://www.ggomed.co.ukfoo/x")).toBeNull();
        expect(pageUrl("javascript:alert(1)")).toBeNull();
        expect(pageUrl("http://www.ggomed.co.uk/x")).toBeNull();
        expect(pageUrl("https://ggomed.co.uk/costs")).toBe("https://ggomed.co.uk/costs");
        expect(pageUrl("www.ggomed.co.uk/costs")).toBe("https://www.ggomed.co.uk/costs");
        expect(pageUrl("  ")).toBeNull();
    });

    it("filters by state and by title or address", () => {
        const items = [
            { id: "1", title: "Varicocele", slug: "varicocele", status: "✅ Live" },
            { id: "2", title: "Circumcision", slug: "circumcision", status: "⚠️ Needs Update" },
        ] as ContentItem[];
        expect(filterPages(items, "", "All").map((i) => i.id)).toEqual(["2", "1"]);
        expect(filterPages(items, "vari", "All").map((i) => i.id)).toEqual(["1"]);
        expect(filterPages(items, "", "⚠️ Needs Update").map((i) => i.id)).toEqual(["2"]);
    });
});

describe("the registry as the social role reads it", () => {
    it("drops reviewers, relations and notes", () => {
        const full = { id: "1", title: "T", contentType: "Page", status: "✅ Live", slug: "t", lastReviewed: null, lastEditedTime: "2026-11-01",
            reviewedBy: ["Someone"], metaDescription: "m", evidenceSourceIds: ["e"] } as unknown as ContentItem;
        expect(Object.keys(toPublicPage(full)).sort()).toEqual(["contentType", "id", "lastEditedTime", "lastReviewed", "slug", "status", "title"]);
    });
});

describe("Natascia's weekly reading", () => {
    const page = {
        id: "p1", url: "https://notion.so/p1",
        properties: {
            Title: { type: "title", title: [{ plain_text: "Weekly report — 2026-11-16" }] },
            "Week Of": { type: "date", date: { start: "2026-11-16" } },
            Summary: { type: "rich_text", rich_text: [{ plain_text: "A quiet week." }] },
            Editorial: { type: "rich_text", rich_text: [{ plain_text: "Darling, the reels carried it." }] },
            Anomaly: { type: "rich_text", rich_text: [] },
            "Silent Pages": { type: "rich_text", rich_text: [] },
        },
    };

    it("maps the properties and keeps the body", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = mapReport(page as any, "## Reading\nMore.");
        expect(r).toMatchObject({ title: "Weekly report — 2026-11-16", weekOf: "2026-11-16", summary: "A quiet week.", body: "## Reading\nMore.", bodyTruncated: false });
        expect("url" in r).toBe(false);
    });

    it("says when the body was cut", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = mapReport(page as any, "x".repeat(20_000));
        expect(r.bodyTruncated).toBe(true);
        expect(r.body.length).toBe(12_000);
    });
});

describe("GET /api/natascia/weekly", () => {
    beforeEach(() => vi.resetModules());

    it("refuses without a session", async () => {
        vi.doMock("../lib/auth/api-guard", () => ({
            requireAuth: async () => ({ authenticated: false, response: new Response(null, { status: 401 }) }),
        }));
        const { GET } = await import("../app/api/natascia/weekly/route");
        expect((await GET()).status).toBe(401);
    });

    it("reports a Notion refusal as an error, never as an empty list", async () => {
        vi.doMock("../lib/auth/api-guard", () => ({
            requireAuth: async () => ({ authenticated: true, email: "d@example.com", name: "Diletta", role: "social" }),
        }));
        vi.doMock("../lib/notion/natascia", () => ({
            getNatasciaReports: async () => { throw new Error("Could not find database with ID"); },
        }));
        const { GET } = await import("../app/api/natascia/weekly/route");
        const res = await GET();
        expect(res.status).toBe(502);
        expect((await res.json()).error).toMatch(/not shared/);
    });
});

describe("GET /api/social/pages", () => {
    beforeEach(() => vi.resetModules());

    it("refuses a switched-off collaborator", async () => {
        vi.doMock("../lib/auth/api-guard", () => ({
            requireAuth: async () => ({ authenticated: false, response: new Response(null, { status: 401 }) }),
        }));
        const { GET } = await import("../app/api/social/pages/route");
        expect((await GET()).status).toBe(401);
    });

    it("returns only the public fields, never cached by the browser", async () => {
        vi.doMock("../lib/auth/api-guard", () => ({
            requireAuth: async () => ({ authenticated: true, email: "d@example.com", name: "Diletta", role: "social" }),
        }));
        vi.doMock("../lib/cache", () => ({ cached: (_k: string, f: () => unknown) => f() }));
        vi.doMock("../lib/notion/services", () => ({
            getContentAssets: async () => [{ id: "1", title: "T", contentType: "Page", status: "✅ Live", slug: "t", lastReviewed: null,
                lastEditedTime: "2026-11-01", reviewedBy: ["Someone"], metaDescription: "m" }],
        }));
        const { GET } = await import("../app/api/social/pages/route");
        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("private, no-store");
        const body = await res.json();
        expect(body[0].reviewedBy).toBeUndefined();
        expect(body[0].metaDescription).toBeUndefined();
    });
});

describe("GET /api/notion/performance-snapshot", () => {
    beforeEach(() => vi.resetModules());

    it("re-reads the store: a switched-off collaborator is refused", async () => {
        vi.doMock("../lib/auth/api-guard", () => ({
            requireAuth: async () => ({ authenticated: false, response: new Response(null, { status: 401 }) }),
        }));
        const { GET } = await import("../app/api/notion/performance-snapshot/route");
        expect((await GET()).status).toBe(401);
    });

    it("is never stored by a browser or a proxy", async () => {
        vi.doMock("../lib/auth/api-guard", () => ({
            requireAuth: async () => ({ authenticated: true, email: "d@example.com", name: "Diletta", role: "social" }),
        }));
        vi.doMock("../lib/notion/editorial", () => ({ getPerformanceSnapshot: async () => [] }));
        const { GET } = await import("../app/api/notion/performance-snapshot/route");
        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("private, no-store");
    });
});

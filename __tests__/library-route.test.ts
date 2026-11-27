// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: mocks.requireAuth }));
import { GET } from "../app/api/social/library/[doc]/route";
import { LIBRARY } from "../lib/library/store";

let dir: string;
const saved = process.env.COCKPIT_LIBRARY_DIR;
const call = (doc: string) => GET(new NextRequest(`http://localhost/api/social/library/${doc}`), { params: Promise.resolve({ doc }) });
const as = (role: string) => mocks.requireAuth.mockResolvedValue({ authenticated: true, email: "someone@example.org", role });

beforeEach(() => {
    vi.resetAllMocks();
    dir = mkdtempSync(path.join(os.tmpdir(), "library-route-"));
    process.env.COCKPIT_LIBRARY_DIR = dir;
    writeFileSync(path.join(dir, LIBRARY["social-media-guide"].file), "<!doctype html><title>guide</title>");
    writeFileSync(path.join(dir, LIBRARY["social-media-guide.pdf"].file), "%PDF-1.4");
});
afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.COCKPIT_LIBRARY_DIR; else process.env.COCKPIT_LIBRARY_DIR = saved;
});

it("answers what the guard answers when there is no session, and reads nothing", async () => {
    mocks.requireAuth.mockResolvedValue({ authenticated: false, response: new Response(null, { status: 401 }) });
    const res = await call("social-media-guide");
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
});

it("refuses the viewer role", async () => {
    as("viewer");
    const res = await call("social-media-guide");
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("guide</title>");
});

it("serves the guide to the social role, in the browser, under a policy with no network", async () => {
    as("social");
    const res = await call("social-media-guide");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>guide</title>");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="GGO-Med-Social-Media-Guide.html"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const policy = res.headers.get("content-security-policy") ?? "";
    for (const directive of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) {
        expect(policy).toContain(directive);
    }
    expect(policy).not.toMatch(/https?:|\*/);
});

it("serves the PDF as a download", async () => {
    as("admin");
    const res = await call("social-media-guide.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="GGO-Med-Social-Media-Guide.pdf"');
});

it("answers 404 for an id that is not in the table and for a listed file that is absent", async () => {
    as("social");
    expect((await call("users.json")).status).toBe(404);
    rmSync(path.join(dir, LIBRARY["social-media-guide.pdf"].file));
    const res = await call("social-media-guide.pdf");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/non è ancora sul server/);
});

it("answers 503, not 404, when the file is there and cannot be read", async () => {
    as("social");
    const file = path.join(dir, LIBRARY["social-media-guide"].file);
    rmSync(file);
    mkdirSync(file); // a directory where the file should be: present, unreadable as a file
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call("social-media-guide")).status).toBe(503);
    err.mockRestore();
    chmodSync(file, 0o700);
});

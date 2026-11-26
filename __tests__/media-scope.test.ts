// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ requireAuth: vi.fn(), requireUploader: vi.fn(), listInbox: vi.fn(), listJobs: vi.fn(), readManifest: vi.fn(), abortUpload: vi.fn() }));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: m.requireAuth, requireUploader: m.requireUploader }));
vi.mock("../lib/media/jobs", () => ({ listJobs: m.listJobs }));
vi.mock("../lib/media/inbox", async (orig) => ({
    ...(await orig<typeof import("../lib/media/inbox")>()),
    listInbox: m.listInbox, readManifest: m.readManifest, abortUpload: m.abortUpload,
}));

import { GET as listUploads } from "../app/api/media/uploads/route";
import { GET as listJobsRoute } from "../app/api/media/jobs/route";
import { DELETE as abandon, GET as readUpload } from "../app/api/media/uploads/[id]/route";

const social = { authenticated: true, email: "d@example.com", name: "Diletta", role: "social" };
const admin = { authenticated: true, email: "owner@example.com", name: "JJ", role: "admin" };
const inbox = [{ id: "mine", operator: "D@example.com" }, { id: "jjs", operator: "owner@example.com" }];
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
    for (const f of Object.values(m)) f.mockReset();
    m.listInbox.mockResolvedValue(inbox);
    m.listJobs.mockResolvedValue([{ id: "mine" }, { id: "jjs" }]);
    m.readManifest.mockImplementation(async (id: string) => inbox.find((u) => u.id === id) ?? null);
});

describe("Il Carico for the social media manager", () => {
    it("lists only their own uploads and the worker's output for them", async () => {
        m.requireAuth.mockResolvedValue(social);
        const uploads = await (await listUploads(new NextRequest("http://x/api/media/uploads"))).json();
        expect(uploads.uploads.map((u: { id: string }) => u.id)).toEqual(["mine"]);
        const jobs = await (await listJobsRoute(new NextRequest("http://x/api/media/jobs"))).json();
        expect(jobs.jobs.map((j: { id: string }) => j.id)).toEqual(["mine"]);
    });

    it("can neither read nor abandon JJ's upload", async () => {
        m.requireUploader.mockResolvedValue(social);
        expect((await readUpload(new NextRequest("http://x"), ctx("jjs"))).status).toBe(403);
        expect((await abandon(new NextRequest("http://x"), ctx("jjs"))).status).toBe(403);
        expect(m.abortUpload).not.toHaveBeenCalled();
        expect((await abandon(new NextRequest("http://x"), ctx("mine"))).status).toBe(200);
    });

    it("leaves JJ's view of the inbox whole", async () => {
        m.requireAuth.mockResolvedValue(admin);
        const uploads = await (await listUploads(new NextRequest("http://x/api/media/uploads"))).json();
        expect(uploads.count).toBe(2);
    });
});

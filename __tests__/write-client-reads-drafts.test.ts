// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn(async () => []) }));
vi.mock("@sanity/client", () => ({ createClient: () => ({ fetch }) }));

describe("write client reads", () => {
    it("reads drafts: the raw perspective is explicit, never the published default", async () => {
        process.env.SANITY_GGOMED_WRITE_TOKEN ||= "test-token";
        const { fetchByIds } = await import("../lib/sanity/write-client");

        await fetchByIds(["drafts.social-x"], "{_id}");

        expect(fetch).toHaveBeenCalledWith("*[_id in $ids]{_id}", { ids: ["drafts.social-x"] }, { perspective: "raw" });
    });
});

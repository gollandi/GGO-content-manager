// @vitest-environment node
import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), load: vi.fn() }));
vi.mock("../lib/auth/api-guard", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("../lib/pipeline/health", () => ({ loadPipelineHealth: mocks.load }));
import { GET } from "../app/api/pipeline/health/route";
beforeEach(() => vi.resetAllMocks());
it("does not query GitHub without a session", async () => {
  mocks.requireAuth.mockResolvedValue({
    authenticated: false,
    response: new Response(null, { status: 401 }),
  });
  expect((await GET()).status).toBe(401);
  expect(mocks.load).not.toHaveBeenCalled();
});
it("returns read-only state with private no-store headers", async () => {
  mocks.requireAuth.mockResolvedValue({
    authenticated: true,
    email: "viewer@example.org",
    role: "viewer",
  });
  mocks.load.mockResolvedValue({ configured: false, workflows: [] });
  const result = await GET();
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(await result.json()).toEqual({ configured: false, workflows: [] });
});

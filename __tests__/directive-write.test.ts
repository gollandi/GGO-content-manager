// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("../lib/notion/client", () => ({
  notion: { pages: { create } },
}));
vi.mock("../lib/config", () => ({
  notionConfig: { dbs: { ernestoDesk: () => "desk-db" } },
}));

import { createDeskDirective } from "../lib/notion/directive-write";

describe("desk directives", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: "desk-row" });
  });

  it("files a precise instruction as Pending without approving it", async () => {
    await createDeskDirective({
      title: "Check clip handover",
      instruction: "Use take B and return one review-ready cut.",
      agent: "Greta - video",
      type: "recommendation",
      priority: "Urgent",
      mediaAssetIds: ["media-1"],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: { database_id: "desk-db" },
        properties: expect.objectContaining({
          Status: { select: { name: "Pending" } },
          Priority: { select: { name: "Urgent" } },
          "Media Assets": { relation: [{ id: "media-1" }] },
        }),
      })
    );
    expect(create.mock.calls[0][0].children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paragraph: expect.objectContaining({
            rich_text: expect.arrayContaining([
              expect.objectContaining({
                text: expect.objectContaining({
                  content: expect.stringContaining("Greta - video"),
                }),
              }),
            ]),
          }),
        }),
      ])
    );
  });

  it("rejects an invalid Desk type before writing", async () => {
    await expect(
      createDeskDirective({
        title: "Invalid",
        instruction: "Do not write this.",
        agent: "Ernesto",
        type: "not-a-real-type" as "recommendation",
        priority: "Normal",
      })
    ).rejects.toThrow("invalid directive type");
    expect(create).not.toHaveBeenCalled();
  });
});

import { it, expect } from "vitest";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { hydrateEvidenceRelations } from "../lib/notion/evidence-relations";
import { mapPifValidationItem } from "../lib/notion/mappers";
const refs = (start: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `source-${start + i}` }));
const page = {
  id: "pif-1",
  properties: {
    "Evidence Sources Used": {
      id: "primary",
      type: "relation",
      relation: refs(0, 25),
      has_more: true,
    },
    "Evidence Sources Used (ETL 2)": {
      id: "overflow",
      type: "relation",
      relation: refs(100, 6),
      has_more: false,
    },
  },
} as unknown as PageObjectResponse;
it("hydrates paginated primary and overflow into all 106 evidence IDs", async () => {
  const hydrated = await hydrateEvidenceRelations(page, async (_page, property, cursor) => {
    expect(property).toBe("primary");
    return {
      results: refs(cursor ? 50 : 0, 50).map((relation) => ({ type: "relation", relation })),
      has_more: !cursor,
      next_cursor: cursor ? null : "next",
    };
  });
  const result = mapPifValidationItem(hydrated);
  expect(result.evidenceSourceIds).toEqual(refs(0, 106).map((ref) => ref.id));
  expect(
    page.properties["Evidence Sources Used"].type === "relation" &&
      page.properties["Evidence Sources Used"].relation
  ).toHaveLength(25);
});
it("does not turn failed pagination into an incomplete successful list", async () => {
  await expect(
    hydrateEvidenceRelations(page, async () => {
      throw new Error("429");
    })
  ).rejects.toThrow("429");
  await expect(
    hydrateEvidenceRelations(page, async () => ({ results: [], has_more: true, next_cursor: null }))
  ).rejects.toThrow("cursor");
});

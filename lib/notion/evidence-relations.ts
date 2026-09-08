import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export function isEvidenceRelation(name: string): boolean {
  return (
    name === "Evidence Sources Used" ||
    /^Evidence Sources Used \(ETL ([2-9]|1[0-9]|20)\)$/.test(name)
  );
}

/** Database query responses truncate relations at 25. Read every property item
 * before mapping; a failed page must not be reported as a complete evidence set. */
export async function hydrateEvidenceRelations(
  page: PageObjectResponse,
  retrieve: (
    pageId: string,
    propertyId: string,
    cursor?: string
  ) => Promise<{
    results: { type: string; relation?: { id: string } }[];
    has_more: boolean;
    next_cursor: string | null;
  }>
): Promise<PageObjectResponse> {
  const properties = { ...page.properties };
  for (const [name, property] of Object.entries(properties)) {
    if (
      !isEvidenceRelation(name) ||
      property.type !== "relation" ||
      !(property as typeof property & { has_more?: boolean }).has_more
    )
      continue;
    const relation: { id: string }[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const result = await retrieve(page.id, property.id, cursor);
      for (const item of result.results) {
        if (item.type !== "relation" || !item.relation?.id)
          throw new Error("Incomplete evidence relation response");
        relation.push(item.relation);
      }
      if (!result.has_more) break;
      if (!result.next_cursor || seen.has(result.next_cursor))
        throw new Error("Invalid evidence pagination cursor");
      seen.add(result.next_cursor);
      cursor = result.next_cursor;
    } while (true);
    const complete = { ...property, relation, has_more: false };
    properties[name] = complete;
  }
  return { ...page, properties };
}

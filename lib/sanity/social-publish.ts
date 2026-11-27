/**
 * The one publish path in the cockpit: a socialPost, after JJ approved it and
 * Buffer accepted it (JJ, 27 November 2026 — approving a post is publishing
 * it, and "published" is a Studio state, so the site's Social Planner shows
 * it as published).
 *
 * Kept apart from write-client.ts, which stays drafts-only for everything
 * else the cockpit and its runner write. Only a socialPost, only from its
 * draft; any other type or id is refused before anything is written. The
 * trip-wire in __tests__/drafts-only.test.ts holds this module to that.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { sanityGgomedConfig, sanityGgomedWriteConfig } from "../config";

if (typeof window !== "undefined") {
    throw new Error("social-publish.ts is server-only");
}

const PUBLISHABLE_TYPE = "socialPost";

let client: SanityClient | null = null;
function publishClient(): SanityClient {
    if (!client) {
        client = createClient({
            projectId: sanityGgomedConfig.projectId,
            dataset: sanityGgomedConfig.dataset,
            apiVersion: sanityGgomedConfig.apiVersion,
            token: sanityGgomedWriteConfig.writeToken,
            useCdn: false,
        });
    }
    return client;
}

export class PublishRefusedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PublishRefusedError";
    }
}

/**
 * Publish one socialPost the way Studio does: the draft's content becomes the
 * published document and the draft goes, in one transaction.
 */
export async function publishSocialPost(bareId: string, sanity: SanityClient = publishClient()): Promise<void> {
    if (!/^social-[A-Za-z0-9_-]+$/.test(bareId)) throw new PublishRefusedError(`refusing to publish "${bareId}": not a social post id`);
    const draftId = `drafts.${bareId}`;
    const [draft] = await sanity.fetch<Record<string, unknown>[]>(`*[_id == $id]`, { id: draftId }, { perspective: "raw" });
    if (!draft) throw new PublishRefusedError(`no draft to publish for ${bareId}`);
    if (draft._type !== PUBLISHABLE_TYPE) throw new PublishRefusedError(`refusing to publish ${bareId}: it is a ${String(draft._type)}, not a ${PUBLISHABLE_TYPE}`);
    const content: Record<string, unknown> = { ...draft };
    delete content._rev;
    delete content._updatedAt;
    await sanity
        .transaction()
        .createOrReplace({ ...content, _id: bareId, _type: PUBLISHABLE_TYPE })
        .delete(draftId)
        .commit();
}

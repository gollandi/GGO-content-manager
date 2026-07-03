/**
 * Drafts-only write access to the GGOMed site project (gxyjgvr0) —
 * La Casa di Ernesto, Family A (spec §0.0 decision 4).
 *
 * HARD BOUNDARIES, enforced in code, not by convention:
 *  - Writes target gxyjgvr0 ONLY. m05ykm6e (Patient-Compass) has no write
 *    client anywhere in this app.
 *  - Every document id MUST be under the `drafts.` prefix. Publishing is
 *    JJ's click in the ggomed Studio — nothing auto-publishes, ever.
 *  - No delete, no publish, no patch of published documents.
 *
 * If a test points here, do not weaken the guard — fix the caller.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { sanityGgomedConfig, sanityGgomedWriteConfig } from "../config";

if (typeof window !== "undefined") {
    throw new Error("write-client.ts is server-only");
}

let client: SanityClient | null = null;

function writeClient(): SanityClient {
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

export class NonDraftWriteError extends Error {
    constructor(id: string) {
        super(
            `Refusing to write "${id}" — the cockpit writes drafts.* only; publishing is JJ's gate`
        );
        this.name = "NonDraftWriteError";
    }
}

const assertDraftId = (id: string): void => {
    if (!id.startsWith("drafts.")) throw new NonDraftWriteError(id);
};

export interface DraftDoc {
    _id: string;
    _type: string;
    [key: string]: unknown;
}

/** Create (or replace, for same-run idempotency) a draft document. */
export async function createDraft(doc: DraftDoc): Promise<string> {
    assertDraftId(doc._id);
    const created = await writeClient().createOrReplace(doc);
    return created._id;
}

/** Patch a draft created earlier in the same run. */
export async function patchDraft(
    id: string,
    set: Record<string, unknown>
): Promise<void> {
    assertDraftId(id);
    await writeClient().patch(id).set(set).commit();
}

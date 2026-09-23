/**
 * Read-only Sanity clients — server-side only.
 *
 * Two projects, two clients, NO cross-project join (GROQ cannot join across
 * projects — spec §4.1). All cockpit reads are live GROQ; there is no mirror.
 *
 * - ggomedClient      → gxyjgvr0/production — GGOMed site content + PIF
 *                        assessment. Needs SANITY_VIEWER_TOKEN for the
 *                        private medicalInterventionEntity docs (R14).
 * - compassPifClient  → m05ykm6e/production — the PIF traceability slice
 *                        ONLY. Nothing else from Patient-Compass is read.
 *
 * Neither client holds a write token. The cockpit observes; it never writes
 * to Sanity (writes are Phase 2, and live elsewhere).
 */
import { createClient, type SanityClient } from "@sanity/client";
import { sanityGgomedConfig, sanityCompassConfig } from "../config";

if (typeof window !== "undefined") {
    throw new Error("lib/sanity/clients.ts is server-only — do not import from client components");
}

export const ggomedClient: SanityClient = createClient({
    projectId: sanityGgomedConfig.projectId,
    dataset: sanityGgomedConfig.dataset,
    apiVersion: sanityGgomedConfig.apiVersion,
    token: sanityGgomedConfig.viewerToken,
    // CDN edge reads: the views layer already caches for 5 minutes, so the
    // CDN's short cache adds no staleness the cockpit hasn't accepted.
    useCdn: true,
    perspective: "published",
});

/**
 * Raw-perspective GGOMed client — sees drafts too (still read-only).
 * Used by the runner to re-read its own drafts.* documents; the published
 * client above stays the default for every cockpit view.
 */
export const ggomedRawClient: SanityClient = createClient({
    projectId: sanityGgomedConfig.projectId,
    dataset: sanityGgomedConfig.dataset,
    apiVersion: sanityGgomedConfig.apiVersion,
    token: sanityGgomedConfig.viewerToken,
    useCdn: false,
    perspective: "raw",
});

export const compassPifClient: SanityClient = createClient({
    projectId: sanityCompassConfig.projectId,
    dataset: sanityCompassConfig.dataset,
    apiVersion: sanityCompassConfig.apiVersion,
    token: sanityCompassConfig.viewerToken,
    useCdn: true,
    perspective: "published",
});

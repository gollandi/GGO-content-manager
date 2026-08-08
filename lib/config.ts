/**
 * Central 12-factor configuration for the GGOMed Operator Cockpit.
 *
 * Single source of truth for every env-derived value. No hardcoded loopback
 * URLs; deployment target is decided entirely by env (local Mac now, remote
 * control-plane later — spec §2.4).
 *
 * Notion database ids are resolved LAZILY (getter per id) so that:
 *  - env loading order never bites (ids read at call time, not import time);
 *  - the app boots even when an optional editorial DB id is absent — the
 *    error surfaces only when that DB is actually queried, with a clear name.
 */

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Missing required environment variable ${name} — see .env.example`
        );
    }
    return value;
}

function lazyDb(name: string): () => string {
    return () => required(name);
}

/** Notion — API key + every database id the cockpit reads. */
export const notionConfig = {
    get apiKey(): string {
        return required("NOTION_API_KEY");
    },
    isConfigured(): boolean {
        return !!process.env.NOTION_API_KEY;
    },
    dbs: {
        // ── Legacy mirror DBs (doomed — Phase 3 retires them; legacy pages
        //    still read them until then, spec §6.1a) ──────────────────────
        contentAssets: lazyDb("NOTION_CONTENT_ASSETS_DB"),
        pifTickCompliance: lazyDb("NOTION_PIF_TICK_COMPLIANCE_DB"),
        evidenceSources: lazyDb("NOTION_EVIDENCE_SOURCES_DB"),
        schemaValidation: lazyDb("NOTION_SCHEMA_VALIDATION_DB"),

        // ── Native / external-API DBs that STAY ─────────────────────────
        keywords: lazyDb("NOTION_KEYWORDS_DB"),
        patientJourneys: lazyDb("NOTION_PATIENT_JOURNEYS_DB"),
        stakeholderFeedback: lazyDb("NOTION_STAKEHOLDER_FEEDBACK_DB"),
        annualReviewLog: lazyDb("NOTION_ANNUAL_REVIEW_LOG_DB"),
        contentRequests: lazyDb("NOTION_CONTENT_REQUESTS_DB"),

        // ── Editorial workflow state (ernesto-agents-house DBs; env names
        //    match ernesto's .env.example verbatim) ──────────────────────
        contentCalendar: lazyDb("NOTION_CONTENT_CALENDAR_DB"),
        topicPool: lazyDb("NOTION_TOPIC_POOL_DB"),
        mediaAssets: lazyDb("NOTION_MEDIA_ASSETS_DB"),
        contentNeeds: lazyDb("NOTION_CONTENT_NEEDS_DB"),
        newsletterItems: lazyDb("NOTION_NEWSLETTER_ITEMS_DB"),
        publishQueue: lazyDb("NOTION_PUBLISH_QUEUE_DB"),
        ernestoDesk: lazyDb("NOTION_ERNESTO_DESK_DB"),
        // The website registry read by Il Cancello. Ernesto's .env calls it
        // NOTION_CONTENT_ASSET_DB; the cockpit has always held the same DB
        // as NOTION_CONTENT_ASSETS_DB (verified identical, 2026-08-08) — so
        // either name works and no new variable is required.
        contentAssetHouse: () =>
            process.env.NOTION_CONTENT_ASSET_DB || required("NOTION_CONTENT_ASSETS_DB"),
        agentsActivityLog: lazyDb("NOTION_AGENTS_ACTIVITY_LOG_DB"),
        performanceSnapshot: lazyDb("NOTION_PERFORMANCE_SNAPSHOT_DB"),

        // ── Ambrogio (READ-ONLY in the Shell — independence by
        //    construction; asserted by ambrogio-no-write test) ───────────
        ambrogioAudits: lazyDb("NOTION_AMBROGIO_AUDITS_DB"),
        ambrogioProposals: lazyDb("NOTION_AMBROGIO_PROPOSALS_DB"),
    },
} as const;

/** GGOMed marketing-site Sanity project (content + PIF assessment). */
export const sanityGgomedConfig = {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "gxyjgvr0",
    // JJ confirmed 2026-07-03: production dataset (spec §0.0 decision 1).
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-12-03",
    /** Read-only viewer token — private medicalInterventionEntity docs
     *  silently vanish from anonymous GROQ without it (spec R14). */
    get viewerToken(): string | undefined {
        return process.env.SANITY_VIEWER_TOKEN;
    },
} as const;

/** Patient-Compass Sanity project — PIF traceability slice ONLY (read-only). */
export const sanityCompassConfig = {
    projectId: process.env.SANITY_M05_PROJECT_ID || "m05ykm6e",
    dataset: process.env.SANITY_M05_DATASET || "production",
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-12-03",
    get viewerToken(): string | undefined {
        return process.env.SANITY_M05_VIEWER_TOKEN;
    },
    /** Tenant scope for the PIF slice — the PIF capability is GGOMED-only
     *  (ADR-0124); other tenants' docs are out of bounds. */
    tenantScope: process.env.SANITY_M05_TENANT_SCOPE || "ggomed",
} as const;

/** Base URL of the view HTTP API — loopback in Phase 1, remote in Phase 2. */
export const viewApiBaseUrl: string | undefined =
    process.env.VIEW_API_BASE_URL;

/** La Casa di Ernesto — the in-shell generative runner (Anthropic only). */
export const runnerConfig = {
    get anthropicApiKey(): string {
        return required("ANTHROPIC_API_KEY");
    },
    isConfigured(): boolean {
        return !!process.env.ANTHROPIC_API_KEY;
    },
    model: process.env.COCKPIT_RUNNER_MODEL || "claude-opus-4-8",
    /** Editorial skill bundles (SKILL.md) — canonical home is ~/.claude/skills. */
    skillsDir:
        process.env.COCKPIT_SKILLS_DIR ||
        `${process.env.HOME}/.claude/skills`,
    maxTurns: Number(process.env.COCKPIT_RUNNER_MAX_TURNS || 40),
} as const;

/**
 * GGOMed Sanity WRITE access — Family A only (copywriter → drafts).
 * Held server-side, injected into the runner, never in skill bundles
 * (spec §0.0 decision 4). The write client refuses non-drafts ids.
 */
export const sanityGgomedWriteConfig = {
    get writeToken(): string {
        return required("SANITY_GGOMED_WRITE_TOKEN");
    },
    isConfigured(): boolean {
        return !!process.env.SANITY_GGOMED_WRITE_TOKEN;
    },
} as const;

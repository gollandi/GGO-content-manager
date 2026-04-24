import { Client } from "@notionhq/client";

const REQUIRED_ENV = [
    "NOTION_API_KEY",
    "NOTION_CONTENT_ASSETS_DB",
    "NOTION_PIF_TICK_COMPLIANCE_DB",
    "NOTION_EVIDENCE_SOURCES_DB",
    "NOTION_KEYWORDS_DB",
    "NOTION_PATIENT_JOURNEYS_DB",
    "NOTION_SCHEMA_VALIDATION_DB",
    "NOTION_STAKEHOLDER_FEEDBACK_DB",
    "NOTION_ANNUAL_REVIEW_LOG_DB",
] as const;

// Fail-fast: check all required env vars at module load time (server-side only)
if (typeof window === "undefined") {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
            `Check .env.local against the REQUIRED_ENV list in lib/notion/client.ts`
        );
    }
}

export const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

export const isNotionConfigured = () => !!process.env.NOTION_API_KEY;

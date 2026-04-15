import { describe, it, expect } from "vitest";
import {
  mapContentItem,
  mapPifValidationItem,
  mapEvidenceItem,
  mapKeywordItem,
  mapPatientJourneyItem,
  mapSchemaValidationItem,
} from "../lib/notion/mappers";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Build a minimal PageObjectResponse mock.
 * Only the properties map and metadata fields matter for mapping.
 */
function mockPage(
  properties: Record<string, unknown>,
  overrides: Partial<PageObjectResponse> = {}
): PageObjectResponse {
  return {
    id: "page-id-123",
    object: "page",
    created_time: "2024-01-15T10:00:00.000Z",
    last_edited_time: "2024-06-01T12:00:00.000Z",
    created_by: { object: "user", id: "user-1" },
    last_edited_by: { object: "user", id: "user-1" },
    cover: null,
    icon: null,
    parent: { type: "database_id", database_id: "db-1" },
    archived: false,
    in_trash: false,
    url: "https://notion.so/page-id-123",
    public_url: null,
    properties: properties as PageObjectResponse["properties"],
    ...overrides,
  } as PageObjectResponse;
}

// ── Property value helpers ──

const title = (text: string) => ({
  type: "title",
  title: [{ plain_text: text }],
});

const richText = (text: string) => ({
  type: "rich_text",
  rich_text: [{ plain_text: text }],
});

const select = (name: string) => ({
  type: "select",
  select: { name },
});

const multiSelect = (...names: string[]) => ({
  type: "multi_select",
  multi_select: names.map((n) => ({ name: n })),
});

const date = (start: string) => ({
  type: "date",
  date: { start },
});

const checkbox = (val: boolean) => ({
  type: "checkbox",
  checkbox: val,
});

const url = (u: string) => ({
  type: "url",
  url: u,
});

const number = (n: number) => ({
  type: "number",
  number: n,
});

const relation = (...ids: string[]) => ({
  type: "relation",
  relation: ids.map((id) => ({ id })),
});

const people = (...names: string[]) => ({
  type: "people",
  people: names.map((n) => ({ name: n })),
});

const formula = (type: string, value: unknown) => ({
  type: "formula",
  formula: { type, [type]: value },
});

// ── Tests ──

describe("mapContentItem", () => {
  it("maps a fully populated content page", () => {
    const page = mockPage({
      Title: title("Vasectomy Reversal"),
      "Medical Category": select("Surgery/Procedure"),
      Status: select("✅ Live"),
      "Sanity Slug": richText("vasectomy-reversal"),
      "Last Reviewed": date("2024-03-15"),
      "Reviewed By": people("Dr Smith"),
      "Meta Title": richText("Vasectomy Reversal | GGO Med"),
      "Meta Description": richText("Expert vasectomy reversal surgery"),
      "PIF TICK Reviews": relation("pif-1"),
      "Evidence Sources": relation("ev-1", "ev-2"),
      "Schema Validation": relation("sv-1"),
      "Parent Page": relation("parent-1"),
      Platform: multiSelect("Website"),
      Pathway: multiSelect("Fertility"),
      "Interactive Elements": multiSelect("FAQ"),
      "Transcript Status": select("Complete"),
      "Content Location": select("Main Site"),
      "CTA Quality": select("Strong"),
      "Tone Score": select("Empathetic"),
      Duration: richText("5 min read"),
      "Has Disclaimer": checkbox(true),
      "YouTube Video ID": richText("abc123"),
      "Live URL": url("https://ggomed.co.uk/vasectomy-reversal"),
      "Sanity ID": richText("sanity-456"),
      Notes: richText("Reviewed and approved"),
    });

    const result = mapContentItem(page);

    expect(result.id).toBe("page-id-123");
    expect(result.title).toBe("Vasectomy Reversal");
    expect(result.contentType).toBe("Surgery/Procedure");
    expect(result.status).toBe("✅ Live");
    expect(result.slug).toBe("vasectomy-reversal");
    expect(result.lastReviewed).toBe("2024-03-15");
    expect(result.reviewedBy).toEqual(["Dr Smith"]);
    expect(result.pifReviewIds).toEqual(["pif-1"]);
    expect(result.evidenceSourceIds).toEqual(["ev-1", "ev-2"]);
    expect(result.platform).toEqual(["Website"]);
    expect(result.hasDisclaimer).toBe(true);
    expect(result.liveUrl).toBe("https://ggomed.co.uk/vasectomy-reversal");
    expect(result.createdTime).toBe("2024-01-15T10:00:00.000Z");
  });

  it("returns safe defaults for missing properties", () => {
    const page = mockPage({});
    const result = mapContentItem(page);

    expect(result.title).toBe("Untitled");
    expect(result.contentType).toBe("General Info");
    expect(result.status).toBe("📝 Draft");
    expect(result.slug).toBe("");
    expect(result.lastReviewed).toBeNull();
    expect(result.reviewedBy).toEqual([]);
    expect(result.pifReviewIds).toEqual([]);
    expect(result.platform).toEqual([]);
    expect(result.hasDisclaimer).toBe(false);
    expect(result.liveUrl).toBeNull();
  });
});

describe("mapPifValidationItem", () => {
  it("maps a PIF validation page with formula status", () => {
    const page = mockPage({
      "Content Asset 1": title("Vasectomy Reversal PIF Review"),
      "PIF Tick Status": formula("string", "✅ YES"),
      "Review Date": date("2024-04-01"),
      Reviewer: people("Dr Jones"),
      "Evidence-Based Review": checkbox(true),
      "Content Need Documented": checkbox(true),
      "Patient Readability": checkbox(true),
      "Inclusivity Assessment": checkbox(false),
      "Expert Peer Review": checkbox(true),
      "PIF TICK Declaration": checkbox(true),
      "Readability Tier 1": number(72),
      "Readability Tier 2": number(65),
      "Content Asset (relation)": relation("content-1"),
      "Evidence Sources Used": relation("ev-1"),
      "Automation Log": richText("Auto-checked"),
      "LLM Provisional Result": select("Pass"),
      "Patient Involvement Actions": richText("Survey conducted"),
      "Patient Involvement Method": select("Survey"),
      "Patient Involvement Sample Size": number(25),
      "Compliance Mismatch": checkbox(false),
      "Patient Involvement Done": checkbox(true),
      "Banner Allowed?": formula("string", "Yes"),
      "Inclusivity Notes": richText("Reviewed for inclusivity"),
      "Content Need Notes": richText("Identified patient need"),
      "Patient Involvement Output": richText("Positive feedback"),
    });

    const result = mapPifValidationItem(page);

    expect(result.title).toBe("Vasectomy Reversal PIF Review");
    expect(result.status).toBe("✅ YES");
    expect(result.reviewDate).toBe("2024-04-01");
    expect(result.evidenceBasedReview).toBe(true);
    expect(result.inclusivityAssessment).toBe(false);
    expect(result.readabilityTier1).toBe(72);
    expect(result.contentAssetId).toBe("content-1");
    expect(result.patientInvolvementDone).toBe(true);
  });

  it("defaults to ❌ NO when formula is missing", () => {
    const page = mockPage({ "Content Asset 1": title("Empty Review") });
    const result = mapPifValidationItem(page);
    expect(result.status).toBe("❌ NO");
  });
});

describe("mapEvidenceItem", () => {
  it("maps an evidence source page", () => {
    const page = mockPage({
      "Source Name": title("NICE NG83"),
      Organisation: select("NICE"),
      URL: url("https://nice.org.uk/ng83"),
      "Last Updated": date("2024-01-10"),
      "Date Published": date("2019-06-01"),
      "Currency Status": select("Current"),
      "Topics Covered": multiSelect("Fertility", "Urology"),
      "Guideline Code": richText("NG83"),
      Notes: richText("Key guideline"),
      "Content Assets": relation("c-1", "c-2"),
    });

    const result = mapEvidenceItem(page);

    expect(result.title).toBe("NICE NG83");
    expect(result.organisation).toBe("NICE");
    expect(result.url).toBe("https://nice.org.uk/ng83");
    expect(result.topicsCovered).toEqual(["Fertility", "Urology"]);
    expect(result.contentAssetIds).toEqual(["c-1", "c-2"]);
  });
});

describe("mapKeywordItem", () => {
  it("maps a keyword page", () => {
    const page = mockPage({
      Keyword: title("vasectomy reversal"),
      Volume: number(1200),
      "Search Volume": number(1500),
      Difficulty: number(45),
      Intent: multiSelect("Informational", "Transactional"),
      "Current Ranking": number(3),
      "Position Change": number(2),
      Traffic: number(800),
      CPC: number(4),
      "Competitive Density": number(60),
      Trend: richText("↑"),
      "SERP Features": multiSelect("FAQ", "Featured Snippet"),
      "Last Updated": date("2024-05-01"),
      "Last SEMrush Update": date("2024-04-28"),
      "SEMrush URL": url("https://semrush.com/kw/vasectomy-reversal"),
      Notes: richText("Primary keyword"),
      "Content Assets": relation("c-1"),
    });

    const result = mapKeywordItem(page);

    expect(result.keyword).toBe("vasectomy reversal");
    expect(result.volume).toBe(1200);
    expect(result.difficulty).toBe(45);
    expect(result.intent).toEqual(["Informational", "Transactional"]);
    expect(result.currentRanking).toBe(3);
  });
});

describe("mapPatientJourneyItem", () => {
  it("maps a patient journey page", () => {
    const page = mockPage({
      "Patient Language": title("Can I reverse my vasectomy?"),
      "Example Question": richText("Is vasectomy reversal possible?"),
      "Journey Stage": select("Awareness"),
      Urgency: select("High"),
      Pathway: select("Fertility"),
      "Medical Term(s)": richText("Vasovasostomy"),
      "Content Assets": relation("c-1"),
      Notes: richText("Common query"),
    });

    const result = mapPatientJourneyItem(page);

    expect(result.patientLanguage).toBe("Can I reverse my vasectomy?");
    expect(result.journeyStage).toBe("Awareness");
    expect(result.urgency).toBe("High");
    expect(result.medicalTerms).toBe("Vasovasostomy");
  });
});

describe("mapSchemaValidationItem", () => {
  it("maps a schema validation page", () => {
    const page = mockPage({
      Name: title("Vasectomy Reversal Schema"),
      Slug: richText("/vasectomy-reversal"),
      "Related Conditions": richText("Infertility"),
      "Schema Type": multiSelect("MedicalProcedure", "FAQPage"),
      "Has FAQ": checkbox(true),
      Validated: checkbox(true),
      "Related Procedures": richText("Vasectomy"),
      "Validation Errors": number(0),
      "Validation Warnings": number(1),
      "FAQ Count": number(5),
      "Parent Page": richText("Procedures"),
      "📄 Content Assets": relation("c-1"),
      URL: url("https://ggomed.co.uk/vasectomy-reversal"),
      "Page Type": select("Procedure"),
      Breadcrumbs: richText("Home > Procedures"),
      "Last Reviewed": date("2024-03-15"),
      "Date Modified": date("2024-05-01"),
      "Main Entity": richText("VasectomyReversal"),
      "Date Published": date("2023-01-01"),
      "JSON-LD Raw": richText('{"@type":"MedicalProcedure"}'),
      "FAQs Schema Types": multiSelect("Question"),
      Notes: richText("Valid schema"),
    });

    const result = mapSchemaValidationItem(page);

    expect(result.name).toBe("Vasectomy Reversal Schema");
    expect(result.hasFaq).toBe(true);
    expect(result.validated).toBe(true);
    expect(result.validationErrors).toBe(0);
    expect(result.validationWarnings).toBe(1);
    expect(result.schemaType).toEqual(["MedicalProcedure", "FAQPage"]);
  });
});

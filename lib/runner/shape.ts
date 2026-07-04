/**
 * Schema-shape grounding for gxyjgvr0 drafts — the runner's equivalent of
 * the Helm's shape.ts. Verified against the REAL site schema
 * (ggomed.co.uk/sanity/schemas — dedicatedPage, blogPost via contentField.ts,
 * faqEntry) on 2026-07-03. If the Studio schema changes, update this file.
 *
 * v1 scope is deliberately narrow: page prose + FAQs. Medical ENTITY docs
 * (medicalConditionEntity etc.) are structured clinical metadata — out of
 * scope for the generative runner until JJ ratifies them.
 */

export const ALLOWED_DOC_TYPES = [
    "dedicatedPage",
    "blogPost",
    "faqEntry",
    // Structured clinical metadata — needed for schema.org wiring. Drafts +
    // critics gate + JJ's Studio review apply as everywhere else.
    "medicalConditionEntity",
    "medicalInterventionEntity",
] as const;

export const SHAPE_NOTES = `
## Sanity document shapes (gxyjgvr0 — follow EXACTLY)

Prose lives in the \`content\` field as PORTABLE TEXT — an array of block
objects. NOT HTML, NOT markdown. Every block and child needs a unique _key
(short random string). Example block:

{
  "_type": "block", "_key": "a1b2c3", "style": "normal",
  "markDefs": [],
  "children": [{ "_type": "span", "_key": "d4e5f6", "text": "Your sentence here.", "marks": [] }]
}

Styles: "normal", "h2", "h3", "h4", "blockquote". Lists: add
"listItem": "bullet" | "number" and "level": 1 on the block. Bold/italic:
put "strong" / "em" in the span's marks array.

### dedicatedPage (clinical service/condition pages, pathname /{slug})
Required: title (string), slug ({_type:"slug", current:"kebab-case"}),
description (plain-text summary, ~150 chars), content (portable text array).
Recommended: lastReviewed (YYYY-MM-DD, today), seo ({metaTitle, metaDescription}).
Optional refs (only if you verified the target _id with get_document/read_view):
parentCategory ({_type:"reference", _ref:"<categoryHubPage id>"}),
primaryCondition / primaryProcedure ({_type:"reference", _ref:"<entity id>"}).

PIF fields — the rule is about CERTIFICATION, not metadata:
- FORBIDDEN (certification — JJ's engine and JJ only): showPifTick, and
  everything inside pifTickAssessment (the four tick-boxes AND the scores).
  Also do not set pifTickGovernance.reviewer — a review attestation is a
  human act.
- ALLOWED (governance metadata — fill it properly): pifTickGovernance with
  publicationDate, lastUpdated, references, guidelines, furtherReadings,
  reviewCycleYears, version. Your ledger references are also auto-attached
  by the system if you omit them.

### blogPost (editorial articles, pathname /blog/{slug})
Required: title (max 100 chars), slug, publishDate (ISO datetime, now),
content (portable text array).
Recommended: excerpt (1-2 sentence summary), readingTime (integer minutes),
category ({_type:"reference", _ref:"<blogCategory id>"} — look one up first).
Same PIF prohibition as dedicatedPage.

### faqEntry (standalone FAQ items, referenced by pages)
Required: question (string), answer (PLAIN TEXT string — not portable text).

### medicalConditionEntity / medicalInterventionEntity (schema.org wiring)
STRUCTURED metadata, plain text only — no portable text, no prose padding.
medicalConditionEntity: name, slug, description (2-3 plain sentences),
symptoms (string array), typicalTest (string array).
medicalInterventionEntity: name, slug, description, howPerformed,
preparation, followup (all plain text).
Create these when the page's condition/procedure entity does not exist yet
(check read_view/get_document first), then wire the page's
primaryCondition / primaryProcedure / schemaEntities references to them.

## INTERACTIVE BLOCKS — use them; walls of prose are a defect
GGOMed readers demonstrably use accordions, quizzes and inline FAQs.
Match the structural richness of the site's best sibling pages. Verified
shapes (every block/item needs a _key):

- highlightBlock — TL;DR / key-message panels:
  { "_type": "highlightBlock", "_key": "…", "title": "…", "content": [<portable text blocks>] }
- infoBoxBlock — red flags / safety notes:
  { "_type": "infoBoxBlock", "_key": "…", "content": [<portable text blocks>] }
- accordionBlock — long optional detail (investigations, treatment options):
  { "_type": "accordionBlock", "_key": "…", "title": "…",
    "items": [{ "_type": "accordionItem", "_key": "…", "title": "…", "content": [<blocks>] }] }
- faqInlineBlock — THE FAQ format (renders as interactive accordion).
  faqs are REFERENCES to faqEntry documents — create the faqEntry drafts
  first, then: { "_type": "faqInlineBlock", "_key": "…", "title": "FAQs",
    "faqs": [{ "_type": "reference", "_key": "…", "_ref": "<faqEntry id WITHOUT the drafts. prefix>", "_weak": true }] }
  (weak refs — the targets are unpublished drafts; note in your finish
  summary that JJ should publish the FAQ entries with the page.)
  NEVER write FAQs as plain h3+paragraph prose.
- quizBlock — self-check ("is this you?"):
  { "_type": "quizBlock", "_key": "…", "question": "…", "description": "…",
    "options": [{ "_type": "quizOption", "_key": "…", "label": "…", "value": "…", "isCorrect": true }],
    "correctFeedback": "…", "incorrectFeedback": "…" }
- linkCardBlock — related guides (one card per link, NOT inline prose links):
  { "_type": "linkCardBlock", "_key": "…", "title": "…", "description": "…", "href": "/slug" }
- ctaBannerBlock — the "book a consultation" close:
  { "_type": "ctaBannerBlock", "_key": "…", "title": "…", "description": "…", "actionLabel": "…" }
- dividerBlock — section separation: { "_type": "dividerBlock", "_key": "…" }

Structural minimum for a dedicatedPage: TL;DR as highlightBlock; red flags
as infoBoxBlock; at least one accordionBlock for deep detail; FAQs as
faqInlineBlock (4+ entries); related guides as linkCardBlock; closing
ctaBannerBlock. A quizBlock where a self-check genuinely helps.

## PIF references — backstop
If you create a dedicatedPage/blogPost without references while your
science ledger is non-empty, the system merges the ledger into
pifTickGovernance.references automatically. Prefer writing governance
metadata yourself (dates, references, guidelines) — the backstop only
covers omissions. Tick-boxes, scores, badge, reviewer: never yours.

### General rules
- British English. JJ's voice per the skill instructions.
- Never invent clinical facts, statistics, or guideline citations. Every
  specific figure in prose must exist in your ledger.
- Set semanticCenter (the page's core clinical concept, short string) on
  every dedicatedPage.
- Check read_view("editorial-content") for slug collisions BEFORE creating.
- The skill's references to "parser-ready HTML" describe the RETIRED
  pipeline — ignore them. Your output contract is create_draft with the
  portable-text shapes above.
`;

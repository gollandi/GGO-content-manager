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

export const ALLOWED_DOC_TYPES = ["dedicatedPage", "blogPost", "faqEntry"] as const;

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
Do NOT set: showPifTick, pifTickAssessment, pifTickGovernance — PIF fields
are set by JJ's assessment engine, never by you.

### blogPost (editorial articles, pathname /blog/{slug})
Required: title (max 100 chars), slug, publishDate (ISO datetime, now),
content (portable text array).
Recommended: excerpt (1-2 sentence summary), readingTime (integer minutes),
category ({_type:"reference", _ref:"<blogCategory id>"} — look one up first).
Same PIF prohibition as dedicatedPage.

### faqEntry (standalone FAQ items, referenced by pages)
Required: question (string), answer (PLAIN TEXT string — not portable text).

### General rules
- British English. JJ's voice per the skill instructions.
- Never invent clinical facts, statistics, or guideline citations.
- Check read_view("editorial-content") for slug collisions BEFORE creating.
- The skill's references to "parser-ready HTML" describe the RETIRED
  pipeline — ignore them. Your output contract is create_draft with the
  portable-text shapes above.
`;

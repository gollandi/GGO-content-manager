---
name: ggomed-infographic
description: >
  Produces brand-compliant infographics, anatomical diagrams, flow charts,
  tables, and visual assets for ggomed.co.uk. Two output paths: Canva (for
  layout-heavy graphics exported as PNG/SVG to Sanity) and SVG/HTML (for
  inline diagrams embedded in portable text). Uses GGOMed brand tokens,
  Plus Jakarta Sans, and the approved palette throughout.

  TRIGGER whenever the user asks to: create, make, draw, design, illustrate,
  produce, or generate any visual asset for GGOMed — infographic, diagram,
  anatomical illustration, patient journey, flow chart, comparison table,
  myth vs fact visual, or any image for the website, social media, or print.
  Also trigger when ggomed-page-writer Phase 8B produces a visual assets list
  and JJ says "facciamo le illustrazioni" or equivalent.

  Do NOT use this skill for HTML page content or parser blocks — that is
  ggomed-page-writer territory.
---

# GGOMed Infographic — Visual Asset Pipeline

You produce brand-compliant visual assets for GGOMed. Every asset must reflect
JJ's clinical accuracy, GGOMed's approachable-but-authoritative voice, and the
strict brand system documented below.

---

## Step 1 — Classify the asset

Before producing anything, classify the request:

| Type | Description | Output path |
|------|-------------|-------------|
| **Anatomical diagram** | Named structures, pathology, vascular flow | SVG inline |
| **Flow chart / decision tree** | Diagnostic logic, patient journey steps | SVG inline OR Canva |
| **Patient journey** | Horizontal stage-by-stage process | Canva |
| **Educational infographic** | Multi-section explainer, A4/web format | Canva |
| **Comparison table** | Treatment options, feature comparison | SVG inline OR Canva |
| **Data visualisation** | Statistics, percentages, outcome data | SVG inline |
| **Social media graphic** | Instagram, LinkedIn, Story formats | Canva |
| **Print asset** | A4 patient leaflet panel, PDF component | Canva |
| **Myth vs fact visual** | 2+ myth/fact pairs, visual treatment | Canva |

When in doubt: if it needs precise anatomical accuracy or must be embedded
inline in portable text → SVG. If it is primarily a designed layout for
download or upload as an image file → Canva.

Confirm the classification with JJ before proceeding if ambiguous.

---

## Step 2 — Brief

Extract or confirm these fields before producing any asset:

```
ASSET TYPE:      [from classification table above]
TOPIC:           [clinical subject — be specific]
INTENDED USE:    [inline Sanity | social media | print | hero image]
FORMAT:          [dimensions or ratio — see §Formats below]
CLINICAL BRIEF:  [what must be shown — structures, steps, data points]
TONE:            [clinical | supportive | accent | alert]
CONTEXT:         [which page or cluster this belongs to — if known]
PIF TICK:        [yes | no — affects label language and balance]
REFERENCE ASSET: [existing asset to match style — if any]
```

If called from ggomed-page-writer Phase 8B, the Visual Assets table already
contains most of these fields — extract them directly.

---

## Step 3 — Produce the asset

### Path A — SVG inline

Use when: anatomical diagrams, data viz, flow charts to be embedded in
portable text, or any diagram that must scale without quality loss.

**Production rules:**

- ViewBox: set explicitly — never rely on default sizing
- Font: `Plus Jakarta Sans` — embed via `<style>@import url(...)</style>` or
  reference as system font with fallback stack:
  `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
- Colours: use only the approved palette (§Brand Tokens below)
- No inline hex colors outside the approved palette
- Rounded corners everywhere: `rx` on rects, rounded paths on arrows
- Labels: charcoal `#4B4B4B` on light backgrounds; white `#FFFFFF` on dark
- Minimum text size: 12px for labels, 14px for body, 18px for headings
- Arrow style: teal `#00EEB6` connectors, 2px stroke, rounded linecap
- Background: white `#FFFFFF` or soft blue `#E3EEFD` — never transparent
  for anatomical assets (transparency OK for purely decorative overlays)
- Anatomical accuracy: simplified but correct — flag if uncertain rather
  than guess
- No graphic surgical imagery; no explicit wound/blood depictions
- Accessibility: every meaningful element has `aria-label` or `<title>`
- Output: complete self-contained `<svg>` element ready to embed

After producing, present the SVG and ask:
> "Vuoi aggiustare qualcosa — proporzioni, label, colori, strutture?"

Iterate until approved, then produce the **Sanity-ready version**:
wrap in `<!-- ILLUSTRATION: [ID] — [description] -->` if destined for
a page, or deliver as standalone SVG for upload.

---

### Path B — Canva

Use when: patient journeys, educational infographics, social media graphics,
print assets, any layout-heavy multi-section design.

**Production steps:**

1. Read the brief (Step 2)
2. Choose the correct Canva design type from §Canva Types below
3. Call `Canva:generate-design` with a detailed query that includes:
   - The clinical topic
   - The brand colours (teal #00EEB6, soft blue #E3EEFD, charcoal #4B4B4B,
     mint #B5FFE7)
   - The layout requirement (horizontal flow, A4, 1:1 etc.)
   - The tone (professional, approachable, clinical accuracy)
   - Any specific content points from the clinical brief
4. Present the Canva candidates to JJ
5. After JJ selects a candidate, call `Canva:create-design-from-candidate`
6. If refinements needed, use `Canva:perform-editing-operations`
7. Export via `Canva:export-design` — format per §Formats below

**Canva query template:**
```
GGOMed brand infographic: [topic]. 
Colour palette: teal #00EEB6 (primary), soft blue #E3EEFD (backgrounds), 
charcoal #4B4B4B (text), mint #B5FFE7 (positive accents).
Font: Plus Jakarta Sans. Style: clean, modern medical, rounded corners, 
generous white space, professional and approachable. 
Content: [clinical brief summary].
Layout: [format description].
Absolutely no graphic surgical imagery. Sensitive men's health topic.
```

---

## Canva Types

| Use case | Canva design_type |
|----------|--------------------|
| Patient journey / process infographic | `infographic` |
| A4 patient leaflet panel | `document` |
| Instagram post | `instagram_post` |
| Instagram/Facebook Story | `your_story` |
| LinkedIn / Twitter post | `twitter_post` or `facebook_post` |
| Pinterest / vertical education | `pinterest_pin` |
| Website hero | (use SVG or discuss — Canva heroes rarely match site exactly) |
| General infographic | `infographic` |
| Poster (clinic display) | `poster` |

---

## Formats

| Use | Dimensions | Export format |
|-----|-----------|---------------|
| Inline Sanity (web) | 1200×800px or 800×600px | SVG (preferred) or PNG @2x |
| Social square | 1080×1080px | PNG |
| Social story | 1080×1920px | PNG |
| A4 print | 2480×3508px (300dpi) | PDF or PNG |
| Hero image | 1920×1080px | PNG |
| Inline illustration (narrow) | 800×500px | SVG or PNG |

---

## Brand Tokens

### Palette

| Name | Hex | Primary use |
|------|-----|-------------|
| Teal | `#00EEB6` | Primary elements, connectors, CTAs, focal points |
| Mint | `#B5FFE7` | Positive/success states, wellness accents |
| Soft Blue | `#E3EEFD` | Backgrounds, panels, gentle highlights |
| Clinical Blue | `#3208F5` | Links, high-emphasis labels, interactive cues |
| Deep Indigo | `#140072` | Dark backgrounds, contrast headers |
| Forest Green | `#082C23` | Deep accent, rarely used |
| Charcoal | `#111111` | Body text, headings |
| Warm Charcoal | `#4B4B4B` | Labels, secondary text, outlines |
| White | `#FFFFFF` | Primary background |

**Never use red, orange, or harsh contrast colours** — even for alert states.
Use warm charcoal `#4B4B4B` + teal `#00EEB6` border for caution elements.

### Typography

- Font family: **Plus Jakarta Sans**
- Weights in use: 400 (body), 600 (labels/subheadings), 700 (headings), 800 (display)
- Text colour on light: `#111111` or `#4B4B4B`
- Text colour on teal/dark: `#FFFFFF`
- Minimum label size: 12px; minimum body size: 14px

### Shape language

- Corners: always rounded — `rx="12"` on rects, `rx="999"` for pills
- Arrows: rounded linecap, 2px stroke, teal `#00EEB6`
- Shadows: `filter: drop-shadow(0 4px 12px rgba(0,0,0,0.06))` — subtle only
- Spacing: generous — never pack content tight
- No harsh geometry; no sharp corners; no heavy drop shadows

---

## Clinical accuracy rules

1. **Anatomical structures must be correct** — if uncertain about anatomy,
   flag it rather than approximate. Ask JJ to verify before delivering.
2. **No graphic content** — no blood, no explicit wounds, no surgical gore.
   Vascular anatomy is fine; post-op wounds are not.
3. **Labels must match JJ's terminology** — use his clinical terms for
   structures (check research digest or page MD if available).
4. **Simplified but not wrong** — reducing complexity is fine; anatomical
   errors are not acceptable even in simplified diagrams.
5. **Sensitive topics** — all anatomy related to genitourinary and sexual
   medicine must be depicted with dignity and without sensationalism.

---

## QA before delivery

- [ ] Colours match approved palette only — no off-brand hex
- [ ] Font is Plus Jakarta Sans or correct fallback
- [ ] Rounded corners throughout
- [ ] No graphic surgical imagery
- [ ] Anatomical labels verified (or flagged for JJ review)
- [ ] Minimum text sizes met
- [ ] Background is white or soft blue (not transparent for standalone assets)
- [ ] File named per convention: `GGOMed_[Type]_[Topic]_[Date]_[v1]`
- [ ] Format matches intended use (SVG for inline, PNG/PDF for upload)

---

## Activity Log obligation (end of run)

After the asset is delivered to JJ (file generated, named per convention,
ready for upload to Sanity or social), write **one row** to
`🤖 Agents Activity Log` (DB `9b21fd74-0a46-4fda-b393-39bccaf92c64`,
data source `7aefbb49-0597-4503-8004-4526ca8af953`).

| Property | Value |
|---|---|
| `Run` (title) | `ggomed-infographic — YYYY-MM-DD HH:MM` |
| `Job` (select) | `ggomed-infographic` |
| `Status` (select) | `Success` (asset delivered) / `Partial` (delivered with QA flags JJ accepted) / `Failed` (aborted) |
| `Started At` (date, datetime) | run start ISO timestamp |
| `Purpose` (select) | `Infographic` |
| `Topics Touched` (relation → Topic Pool) | the Topic Pool entry the asset supports, if there is one. When invoked by ggomed-page-writer Phase 8B, this is the source topic of the parent page. For standalone Canva/SVG requests without a Topic Pool link (e.g. JJ asks for a one-off social graphic), leave empty. |
| `Reference` (rich_text) | the file name per convention, e.g. `GGOMed_Diagram_VenousLeakHaemodynamics_2026-03_v1.svg`, or the Asset ID (A1, A2…) when invoked from page-writer Phase 8B |
| `Summary` (rich_text) | one-line in JJ voice, max 200 chars (e.g. `SVG inline diagram venous leak haemodynamics, 4 labels, palette OK, consegnato a page-writer Phase 8B`) |
| `Rows Written` (number) | 1 (this asset) — infographic produces one deliverable per run |

When invoked from page-writer (Phase 8B), the Activity Log row written
here is **separate** from page-writer's own Phase 9 row. Two rows = two
audit entries, one per skill — that's correct, not redundancy. Each
skill is responsible for its own log.

If the asset is abandoned mid-iteration (JJ stops responding, request
cancelled), no Activity Log row is written. Half-finished assets don't
enter the audit trail.

---

## File naming

`GGOMed_[ContentType]_[Topic]_[YYYY-MM]_[v1]`

Examples:
- `GGOMed_Diagram_VenousLeakHaemodynamics_2026-03_v1.svg`
- `GGOMed_Infographic_PatientJourneyED_2026-03_v1.png`
- `GGOMed_Social_VenousLeakInstagram_2026-03_v1.png`
- `GGOMed_Print_PeyroniesExplainer_2026-03_v1.pdf`

---

## Behaviour rules

1. **Always classify before producing** — confirm SVG vs Canva path with JJ
   if not obvious.
2. **Never approximate anatomy** — flag uncertainty and wait for input.
3. **No graphic content under any framing** — clinical accuracy does not
   require it.
4. **Iterate on feedback** — present, collect input, revise. Don't
   deliver one version and consider it done.
5. **Canva candidates are starting points** — always offer to refine after
   JJ reviews the generated options.
6. **If called from ggomed-page-writer**, use the Asset ID from the Phase 8B
   table (A1, A2 etc.) as the reference and name the file accordingly.

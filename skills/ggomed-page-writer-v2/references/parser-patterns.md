# GGOMed Parser Patterns — Canonical HTML for Sanity Import

Source: parser-guidance.rtf + PARSER_RULES.txt (March 2026)

---

## Strict Parsing Rules (Non-Negotiable)

1. **Nesting limits:**
   - Maximum traversal depth: `3`
   - Maximum total traversed nodes: `5000`

2. **Hard drops (parser silently discards):**
   - `quizBlock` if fewer than 2 options or not exactly 1 correct
   - `mythBustersBlock` if fewer than 2 items
   - Invalid nested blocks inside `accordionBlock` or `cardBlock`

3. **Safe links only:**
   - Allowed: `#anchor`, `/relative-path`, `http(s)://`, `mailto:`, `tel:`
   - Anything else is discarded

4. **Semantic tones only:**
   - Valid: `clinical`, `supportive`, `accent`, `alert`
   - Invalid values forced to `clinical` with warnings

5. **No inline CSS, no custom hex in structural blocks**

6. **Forbidden in card/accordion content:**
   - quiz, feature cards, myth busters, cta banners, nested cards/accordions

---

## Core Text Blocks

```html
<h2>Section Title</h2>
<p>Clinical explanation paragraph.</p>
<ul>
  <li>Bullet one</li>
  <li>Bullet two</li>
</ul>

<ol>
  <li>Step one</li>
  <li>Step two</li>
</ol>

<blockquote>A patient quote or notable statement.</blockquote>

<hr>
```

Inline formatting allowed inside text:
`strong`, `b`, `em`, `i`, `code`, `a`, `span`, `br`

---

## Accordion (details/summary) — Most Common Pattern

```html
<details data-tone="supportive">
  <summary>What symptoms should I watch for?</summary>
  <p>Symptom details go here.</p>
  <ul>
    <li>Item one</li>
    <li>Item two</li>
  </ul>
</details>
```

Multiple `<details>` elements become individual accordion items.

### Accordion container (grouped)
```html
<div class="accordion" data-tone="clinical">
  <div class="accordion-item">
    <button class="accordion-button">Question</button>
    <div class="accordion-panel">
      <p>Answer text.</p>
    </div>
  </div>
  <div class="accordion-item">
    <button class="accordion-button">Second question</button>
    <div class="accordion-panel">
      <p>Second answer.</p>
    </div>
  </div>
</div>
```

---

## Inline Expand (Microcronica / long-form expandable)

Use for microcronache and detailed expandable sections:

```html
<details class="inline-expand" data-title="The Construction Worker Who Thought It Was Venous Leak">
  <summary>Read the full story</summary>
  <p>Patient narrative here. Plain paragraphs only inside.</p>
  <p>Second paragraph of the narrative.</p>
</details>
```

---

## Simple Card

```html
<section class="simple-card" data-tone="clinical" data-icon-name="shield">
  <h3>Card heading</h3>
  <p>Card body copy. Keep concise.</p>
  <a class="btn" href="/book">Book now</a>
</section>
```

Tone options: `clinical`, `supportive`, `accent`, `alert`
Icon names: use Lucide icon names (e.g. `shield`, `heart`, `alert-triangle`, `info`)

---

## Link Card

```html
<a class="link-card" href="/service" data-intent="accent" data-show-arrow="true">
  <h3 class="link-card-title">Explore treatment</h3>
  <p class="link-card-description">Learn about suitability and outcomes.</p>
</a>
```

---

## Feature Cards Block (equivalent options / service features)

```html
<section class="feature-cards"
  data-title="Key Benefits"
  data-eyebrow="Highlights"
  data-background-preset="#B5FFE7">
  <div class="feature-card" data-intent="clinical">
    <h3 class="feature-card-title">Fast access</h3>
    <p class="feature-card-description">Appointments within days.</p>
  </div>
  <div class="feature-card" data-intent="supportive">
    <h3 class="feature-card-title">Expert review</h3>
    <p class="feature-card-description">Consultant-led pathway.</p>
  </div>
</section>
```

`data-background-preset` must use approved brand palette values only (see colour-rules.md).

---

## CTA Banner

```html
<section
  class="cta-banner"
  data-title="Ready to book?"
  data-description="Speak with my team today."
  data-action-type="link"
  data-action-label="Book a consultation"
  data-action-href="/book"
  data-action-variant="outline"
  data-background-preset="#E3EEFD"
  data-text-color="forest">
  <a class="btn" href="/book">Book a consultation</a>
</section>
```

`data-action-variant`: `default | secondary | destructive | outline | ghost | link`
`data-text-color`: use brand enum values, not hex

---

## Myth Busters (minimum 2 items — hard drop if fewer)

```html
<section class="myth-busters" data-title="Myth vs Fact" data-layout="grid" data-theme="mint">
  <div class="myth-item" data-icon="sparkles">
    <p class="myth">Myth: Venous leak always means surgery.</p>
    <p class="fact">Fact: Most cases are managed without surgery. The diagnosis itself is often wrong.</p>
  </div>
  <div class="myth-item" data-icon="shield">
    <p class="myth">Myth: If your Doppler shows low blood flow, you have venous leak.</p>
    <p class="fact">Fact: Poor inflow mimics venous leak. Redosing is required before interpretation.</p>
  </div>
</section>
```

---

## Quiz (minimum 2 options, exactly 1 correct — hard drop otherwise)

```html
<section class="quiz">
  <h3>When is a penile Doppler interpretation reliable?</h3>
  <ul class="quiz-options">
    <li data-correct="false">After a single injection of prostaglandin</li>
    <li data-correct="true">After confirming adequate arterial inflow and redosing if needed</li>
    <li data-correct="false">Only when the patient reports a full erection</li>
  </ul>
  <p class="quiz-correct">Correct. Flow adequacy must be confirmed before interpreting resistance patterns.</p>
  <p class="quiz-incorrect">Not quite. The timing and dose-adequacy of the injection matters significantly.</p>
</section>
```

---

## Info Box

```html
<section class="info-box" data-background-color="blue">
  <p>Contact the clinic if symptoms worsen or you have questions before your appointment.</p>
</section>
```

`data-background-color`: `gray | blue | white` only.

---

## Highlight Block

```html
<section class="highlight" data-title="Key Point" data-border-color="brand">
  <p>This is the main clinical takeaway for patients to remember.</p>
</section>
```

`data-border-color`: `brand | gray` only.

---

## FAQ Group (PAA-targeting)

```html
<section class="faq-group" data-topics="General, Treatment">
  <div class="faq-item" data-topics="Diagnosis">
    <h3 class="faq-question">Can a venous leak heal itself?</h3>
    <div class="faq-answer"><p>In some cases, mild venous incompetence improves with lifestyle changes and treatment of the underlying cause. True venous leak from structural damage does not typically self-resolve.</p></div>
  </div>
  <div class="faq-item" data-topics="Diagnosis">
    <h3 class="faq-question">Does a venous leak get worse over time?</h3>
    <div class="faq-answer"><p>It depends on the cause. If the driver is vascular disease or Peyronie's, it can progress. If the cause is anxiety or temporary vascular dysfunction, it may stabilise or improve.</p></div>
  </div>
</section>
```

---

## Button Group

```html
<div class="button-group">
  <a class="btn" href="/book" data-variant="default">Book a consultation</a>
  <button data-button-type="dialog"
    data-consultation-url="https://example.com/iframe"
    data-dialog-title="Quick enquiry"
    data-variant="outline">
    Send an enquiry
  </button>
</div>
```

---

## Video Embed

```html
<section class="video-embed"
  data-video-url="https://www.youtube.com/watch?v=VIDEO_ID"
  data-title="Penile Doppler Ultrasound — What to Expect"
  data-aspect-ratio="16/9">
</section>
```

Or via iframe:
```html
<iframe
  src="https://www.youtube.com/embed/VIDEO_ID"
  title="Video title"
  data-aspect-ratio="16/9">
</iframe>
```

---

## Video Resource Reference (Sanity doc)

```html
<section class="video-resource" data-video-slug="penile-doppler-overview"></section>
```

---

## Questionnaire Button

```html
<button class="questionnaire-button"
  data-questionnaire-id="sanityQuestionnaireId"
  data-variant="outline">
  Start self-assessment
</button>
```

Note: use `data-questionnaire-id` only — slug-based not supported by importer.

---

## Decision Aid Block

```html
<section class="decision-aid"
  data-aid-key="ed-pathway"
  data-title="Which investigation do I need?">
</section>
```

---

## Composition Patterns (recommended sequences)

### Standard clinical spoke section
```html
<h2>Section Title</h2>
<p>Introduction paragraph.</p>
<details data-tone="clinical">
  <summary>Expandable detail</summary>
  <p>More detail here.</p>
</details>
<section class="info-box" data-background-color="blue">
  <p>Practical patient instruction.</p>
</section>
<section class="cta-banner" ... >
  <a class="btn" href="/book">Book a consultation</a>
</section>
```

### Comparison / options section
```html
<h2>Treatment options</h2>
<p>Brief framing paragraph.</p>
<section class="feature-cards" data-title="Options" data-background-preset="#E3EEFD">
  <div class="feature-card" data-intent="clinical">...</div>
  <div class="feature-card" data-intent="clinical">...</div>
</section>
<section class="highlight" data-title="My recommendation" data-border-color="brand">
  <p>Context-specific clinical recommendation.</p>
</section>
```

### Myth correction section
```html
<h2>What you may have been told — and what the evidence actually shows</h2>
<section class="myth-busters" data-title="Myth vs Fact" data-layout="grid" data-theme="mint">
  <!-- min 2 items -->
</section>
<section class="cta-banner" ... >
  <a class="btn" href="/book">Discuss your case</a>
</section>
```

---

## Invalid Patterns — Never Use

- Hex style hacks for structural blocks: `data-bg="#ff0000"`
- Complex blocks nested inside card/accordion content
  (quiz, feature cards, myth busters, CTA banners, nested cards/accordions)
- Quiz with 0/1 options or multiple correct answers
- Myth busters with 1 item
- Unsafe URLs: `javascript:...`
- Markdown syntax anywhere in the HTML output
- `<script>`, `<style>`, inline JS
- Custom CSS classes not in the canonical list

---

## Pre-Import QA Checklist

1. Myth busters: `>= 2` items
2. Quiz: `>= 2` options and exactly `1` correct
3. Tones: only `clinical`, `supportive`, `accent`, `alert`
4. Nesting: no interactive complex blocks inside card/accordion
5. Links: all anchors and URLs are safe and valid
6. Warnings: review `warningsV2` — fix all `error` severity before publish

## Troubleshooting Warning Codes

- `MIN_ITEMS_NOT_MET`: Add missing quiz/myth items
- `NESTING_EXCEEDED`: Flatten content, reduce depth
- `INVALID_COLOR`: Replace with valid semantic tone
- `UNSUPPORTED_TAG`: Replace custom tag with supported HTML
- `NODE_LIMIT_EXCEEDED`: Split large HTML into smaller imports

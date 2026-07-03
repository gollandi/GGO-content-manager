# Style Guide — Spoke Page

**Status: v0.4 — REVERSE-ENGINEERED + STYLE-SIGNATURE INTEGRATED + ICONS + JJ FEEDBACK**
**Source pages analysed:** `cant-get-hard-with-partner`, `venous-leak-treatment`,
`erectile-dysfunction-test` (mature, locked, live)
**Anti-pattern sources:** `understanding-luts`, `phimosis`, `balanitis`, `lieswt`
**Reference docs:** `parser-patterns.md`, `pif-tick.md`, `content-engine.md`,
`SKILL.md` (icon library)
**Last updated:** 2 May 2026
**Changelog v0.3 → v0.4:** §5 rule 2 broadened (tier 2 also adds academic /
optional depth, not only "enriches"); §10 expanded (FAQ valid in two
positions: end-of-page + mid-section); §13 added (custom icon selection
with semantic mapping table)

A spoke is a **narrow-intent page inside a hub-and-spoke cluster**. It answers
one specific question or covers one specific sub-topic, and relies on its hub
for broader context.

---

## 1. When a page is a spoke

A spoke page:

- Targets **one narrow search intent** (often emotional, symptomatic, or
  scenario-based)
- Lives **under a hub** — linked up to a parent condition or service pillar
- Has **1.500–2.500 words** of first-tier text (target — confirmed from live
  pages: 1.477 / 2.129 / 2.336 words)
- Does NOT try to be exhaustive — defers to its hub for pillar content
- Has a **strong emotional or practical hook** in the title

**Examples of mature spokes (reference quality):**
- `/cant-get-hard-with-partner` — emotional/relational pattern (2.336 words)
- `/venous-leak-treatment` — diagnostic-and-treatment pattern (2.129 words)
- `/erectile-dysfunction-test` — clinical-process pattern (1.477 words)

**Examples of under-developed spokes (avoid these patterns):**
- `/understanding-luts` (448 words, numbered H2s)
- `/balanitis` (416 words — block-stuffed)
- `/phimosis` (504 words, "What Is X, Exactly?" opener)
- `/lieswt` (688 words, marketing voice)

---

## 2. Structure (observed pattern)

A mature spoke uses a **narrative-led, then sectioned, progressively
disclosed** structure:

```
1. Hero — opening narrative or observation (200–400 words BEFORE first H2)
2. First H2 break — usually a mechanism, distinction, or pattern question
3. 4–9 H2 sections — each one a discrete angle, with selective H3 nesting
4. Closing prose section — patient-facing imperative ("What actually helps")
5. CTA banner — single, focused
6. FAQ inline group — at bottom (PAA targeting)
7. Related guides — link cards (1–4) to hub + sibling spokes
8. Optional: featureCardsBlock as routing matrix
```

The key observation: **prose carries the narrative arc; blocks decorate it
and disclose progressively**. Thin spokes invert this — too many blocks, not
enough prose.

---

## 3. Hero pattern — the most violated rule

The hero is **200–400 words of prose BEFORE the first H2**. It establishes
voice, hook, and angle without structural interruption.

### Three observed opening patterns

**A. Narrative scene** (used in `cant-get-hard-with-partner`):
Two characters introduced; specific scene with sensory detail; the dilemma
told inside the scene; then JJ's voice steps out and reframes what the
reader has just witnessed. ~400 words before first H2.

**B. Paradoxical observation** (used in `venous-leak-treatment`):
"Here's something I see constantly in clinic..." — a counter-intuitive
pattern of two patient groups with opposite assumptions, resolved via JJ's
clinical observation. ~350 words before first H2.

**C. Bold claim** (used in `erectile-dysfunction-test`):
"The most expensive mistake in [topic] is not [obvious answer]. It is
[counter-intuitive answer]." Justification with clinical examples. Map of
what the page covers. ~300 words before first H2.

### The anti-pattern

```
H1: What Is Phimosis?
H2: What Is Phimosis, Exactly?
[Generic clinical definition starts immediately]
```

This treats the spoke as a glossary entry rather than a clinical
conversation. Used in the under-developed spokes.

---

## 4. H2 voice — the conversational signature

H2s read like sentences from a person, not section titles from a textbook.

### Green flags

- "Why it works alone but fails with someone you care about"
- "Real venous leak versus the adrenaline impersonator"
- "What you may have been told — and what the evidence shows"
- "A reminder: medicine gets things wrong"
- "It used to work fine — what's changed?"
- "When the only realistic option is a penile prosthesis"

Common features: first-person or second-person where natural; em-dashes for
parenthetical clarification; previewing the *argument*, not just the topic.

### Red flags

- "1. " / "2. Symptom groups" / "6. FAQs" — numbered, document-like
- "What Is Phimosis, Exactly?" — generic explainer
- "Treatment: Your Options Explained" — marketing-pamphlet
- "Conditions We Treat with Li-ESWT" — third-person clinic-voice
- "How Tight Is Your Foreskin? The Grading System" — Title Case + jargon

### H3 use

H3s appear in 2 of 3 mature spokes (2–3 per page) to sub-divide an H2 that
genuinely needs it. Same conversational voice rules. Never use H3 to pad
structure.

---

## 5. Progressive Disclosure — JJ's signature style

This is the structural choice that makes a GGOMed spoke recognisable. It is
not a parser feature — it is a **clinical communication philosophy**: the
patient should be able to read the essential argument top-to-bottom in
plain English, and *opt in* to greater depth at the moments they want it.

### The three tiers

| Tier | Visible by default | Audience | Readability constraint |
|---|---|---|---|
| **Tier 1** — main prose | YES | Every reader | Year 11 (mandatory, see §15) |
| **Tier 2A** — inline-expand | NO (click to open) | Engaged reader who wants the story / extended reasoning | Free — JJ voice, can be richer |
| **Tier 2B** — accordion / FAQ | NO (click to open) | Specific-question reader | Free — clinical detail or PAA-style answer |

### Why this matters clinically

The professional, anxious, intelligent-non-specialist patient (per
`content-engine.md`) needs two things at once: a fast, complete grasp of
the situation, AND the option to go deeper without being made to wade
through technical detail to find it. Progressive disclosure is the formal
answer to that double demand.

### Three rules

1. **The argument must be complete in tier 1 alone.** A reader who never
   clicks anything must still come away with the correct mental model. If
   a clinical conclusion only makes sense once the accordion is open, it
   does not belong in an accordion.

2. **Tier 2 enriches, expands, or adds optional depth — but never
   withholds the essentials.** Tier 2 is the right home for:
   - Academic detail and evidence-base (citations, mechanisms, study
     specifics)
   - Optional deep-dives the engaged reader genuinely wants
   - Worked examples and case stories
   - Extended technical reasoning that distracts from tier 1 flow
   - Self-advocacy scripts, templates, longer practical guidance

   Tier 2 is **not** the place to hide:
   - Risks, complications, or red flags
   - The fact that a treatment option exists at all
   - Information needed to act ("when to see a urologist")
   - Anything required for genuinely informed consent

   These belong in tier 1, even if tier 1 ends up longer as a result.
   The test: would a reader who never clicks anything still be safe and
   informed? If yes, tier 2 is doing its job. If no, something has been
   hidden that shouldn't be.

3. **Tier 2 must signal its content honestly.** A summary like "Read more"
   is a parser fail. A summary like "The Construction Worker Who Thought
   It Was Venous Leak" or "Why the injection" tells the reader *what* they
   are choosing to read, so the click is informed.

---

## 6. Inline-expand vs Accordion — the semantic distinction

**Both render as `<details>` elements. They are not interchangeable.** The
choice is semantic and the v0.1 stub conflated them.

### Inline-expand — for narrative or extended reasoning

Use when the hidden content is a **continuous piece of prose** the reader
chooses to enter.

**Typical content:**
- Microcronaca (case story, 100–250 words)
- Extended technical reasoning that not every reader wants
- A worked example that supports an argument already made in tier 1
- A self-advocacy script or template

**Voice:** Same as tier 1 in tone, but freed from Year 11 — JJ's voice can
breathe wider, sentences can be longer, technical detail is fair game.

**Parser syntax (from `parser-patterns.md`):**
```html
<details class="inline-expand"
  data-title="The Construction Worker Who Thought It Was Venous Leak">
  <summary>Read the full story</summary>
  <p>Patient narrative paragraph one.</p>
  <p>Patient narrative paragraph two.</p>
</details>
```

**Notes:**
- `data-title` is the descriptive label shown in the page card.
- `<summary>` is the click-target text — keep it inviting and concrete.
- Plain `<p>` paragraphs only inside. No nested complex blocks.
- Use 1–3 inline-expand blocks per spoke.

### Accordion — for question-driven detail or grouped Q&A

Use when the hidden content answers a **specific, named question** or
provides **clinical detail complementary to** an H2 section.

**Typical content:**
- "Why the injection?" inside a diagnostic procedure section
- "If testosterone is low or borderline: LH and FSH" inside a tests section
- Short clinical clarifications attached to a parent section

**Voice:** Direct answer to the named question. Concise. Tier 1-adjacent
register, but freed from Year 11 strictness.

**Parser syntax — single accordion item:**
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

**Parser syntax — accordion container (grouped Q&A within a section):**
```html
<div class="accordion" data-tone="clinical">
  <div class="accordion-item">
    <button class="accordion-button">Question</button>
    <div class="accordion-panel"><p>Answer text.</p></div>
  </div>
  <div class="accordion-item">
    <button class="accordion-button">Second question</button>
    <div class="accordion-panel"><p>Second answer.</p></div>
  </div>
</div>
```

**Tone (`data-tone`):** `clinical` | `supportive` | `accent` | `alert`. Any
other value is silently forced to `clinical` by the parser. Use
`supportive` for empathic clarifications, `clinical` for procedural detail,
`alert` for red-flag content, `accent` for differentiating clinical claims.

**Forbidden inside accordion content** (parser hard-drop): quiz, feature
cards, myth busters, CTA banners, nested accordions, nested cards.

### Decision tree

```
Is the hidden content a continuous narrative or extended argument?
  → INLINE-EXPAND
Is the hidden content a Q&A pair or clinical complement to an H2?
  → ACCORDION
Is the hidden content a group of patient-search questions at end-of-page?
  → FAQ-GROUP (faqInlineBlock — see §10)
```

### Anti-patterns

- Wrapping the entire page in accordions to "make it scannable" — this
  defeats tier 1 by hiding the argument.
- Using inline-expand for a 30-word answer — accordion fits.
- Using accordion for a 400-word case story — inline-expand fits.
- Generic summaries ("Click to read more", "Details") — both blocks
  require honest, descriptive summary text.

---

## 7. Block density (revised)

Confirmed from live pages — the v0.1 stub significantly underestimated this:

| Block type | Target count | Placement |
|---|---|---|
| Prose blocks | 30–60 (majority) | Throughout |
| Accordion (single or grouped) | 1–5 | Q&A or clinical detail throughout |
| Inline-expand | 1–3 | Narrative or extended reasoning |
| Feature cards | 1–3 | Key claims, options, routing matrices |
| Link cards | 1–4 | At bottom — sibling spokes + hub return |
| Simple card | 0–2 | Quick check, red flags, key insight |
| Myth busters | 0–1 | When the spoke counters misinformation |
| Quiz | 0–2 | Self-assessment or myth-busting |
| CTA banner | 1 | Single, focused, near close |
| FAQ-group (faqInlineBlock) | 1 | At bottom — PAA targeting |
| Image / SVG | 0–4 | When clinical visualisation adds value |
| Divider | Optional | Sparingly (vl uses many; partner uses none) |

**Total interactive blocks:** 9–22 typical (partner=9, test=18, vl=22).

### Block density rule

Roughly **1 interactive block per 100–250 words of prose**. If you find
yourself adding more blocks than that, the prose is too sparse — write
more prose instead of decorating with more blocks.

---

## 8. Microcronaca — clarification

The v0.1 stub said "microcronaca = inline-expand block". This is partially
correct but incomplete.

### Two observed patterns

**Pattern A — Integrated narrative opening** (partner, vl):
The microcronaca is woven into the hero prose. Mark/Andrea is the *opening
narrative* of `/cant-get-hard-with-partner`, not an inline-expand. The two
patient groups in `/venous-leak-treatment` is observation prose, not a block.

**Pattern B — Inline-expand block** (test, partial use elsewhere):
A self-contained patient story used to illustrate a specific clinical
point mid-section, expandable on click.

### Rule of thumb

- **Spoke's central narrative** (the emotional or clinical hook) →
  integrated into hero prose, not in a block
- **Illustrative case story for a sub-section** → inline-expand block,
  shorter (100–250 words), expandable

A spoke can have both: a narrative hero + 1–2 illustrative inline-expand
microcronache later.

---

## 9. Hub-link and sibling cross-link patterns

Every spoke links **up** to its hub and **across** to sibling spokes.

### Up-link to hub

Three observed patterns — pick the one that fits the page rhythm:
- **Embedded prose link** in early section ("This is part of our full
  guide on [condition]")
- **"Where this page sits in the bigger picture"** section near close (vl
  uses this — clean, repeatable)
- **CTA banner** that doubles as hub return

### Sibling cross-links — parser syntax

Always at bottom under "Related guides" or equivalent heading. 2–4 cards.
More creates decision paralysis.

```html
<a class="link-card" href="/sibling-spoke-slug"
   data-intent="accent" data-show-arrow="true">
  <h3 class="link-card-title">Title (abbreviated H1 of target)</h3>
  <p class="link-card-description">One-line reason this reader might click.</p>
</a>
```

`data-intent` accepts `accent` (default sibling-link tone) or any of the
four semantic tones. Avoid generic descriptions ("Learn more about X").

---

## 10. FAQ pattern — parser syntax

FAQ-grouped questions appear in mature spokes in **two valid positions**:

**A. End-of-page faqInlineBlock (always present)** — this is the canonical
PAA-targeting closer, sitting before related guides and link cards. Always
exactly one per spoke.

**B. Mid-section inline FAQ (optional, topic-driven)** — the same
`faqInlineBlock` pattern can also be used inside a thematic section when
the section naturally generates patient questions. Example: a "Can [X]
cause ED?" cluster sitting inside the cardiovascular spoke as one inline
faq-group covering amlodipine, ramipril, diabetes, stress, etc. — instead
of (or in addition to) the closing FAQ.

When to use mid-section inline FAQ:
- The section has a clear cluster of patient questions on a single
  sub-topic
- The questions are PAA-grounded and benefit from being grouped visually
- Splitting them into separate accordions would feel fragmented

When to keep questions in standalone accordions instead:
- The questions are heterogeneous (no single sub-topic)
- They are clinical complements to the section, not patient-search Q&A
- They live alongside the prose flow rather than as a discrete cluster

### Parser syntax

```html
<section class="faq-group" data-topics="General, Treatment">
  <div class="faq-item" data-topics="Diagnosis">
    <h3 class="faq-question">Can a venous leak heal itself?</h3>
    <div class="faq-answer">
      <p>Mild venous incompetence can improve with lifestyle changes and
      treatment of the underlying cause. True venous leak from structural
      damage does not typically self-resolve.</p>
    </div>
  </div>
  <!-- 4–8 items typical -->
</section>
```

**Question selection (both positions):**
- Pull from PAA (People Also Asked) for the primary KW or sub-topic KW
- Match patient-language phrasing exactly
- Answer in 50–120 words each, snippet-ready

**Adjacent pattern:** Mature spokes also use **standalone accordions
throughout the page** to expand clinical detail without disrupting prose
flow. This is *different* from both faq-group positions. See §6 decision
tree.

---

## 11. CTA banner — parser syntax

Always present. Always single. Position varies.

```html
<section class="cta-banner"
  data-title="Ready to understand what is actually happening?"
  data-description="Speak with my team about a thorough assessment."
  data-action-type="link"
  data-action-label="Book a consultation"
  data-action-href="/contact-us"
  data-action-variant="outline"
  data-background-preset="#E3EEFD"
  data-text-color="forest">
  <a class="btn" href="/contact-us">Book a consultation</a>
</section>
```

`data-action-variant`: `default | secondary | destructive | outline | ghost
| link`
`data-text-color`: brand enum value, never hex (see colour-rules.md)
`data-background-preset`: must use approved brand palette only

**Avoid:** Two CTAs back-to-back. Promotional language ("Book today and
get…"). Generic titles ("Ready to book?").

---

## 12. Other parser-canonical blocks used in spokes

### Simple card

```html
<section class="simple-card" data-tone="alert" data-icon-name="alert-triangle">
  <h3>When to see a doctor urgently</h3>
  <p>Concise patient instruction.</p>
</section>
```

`data-tone`: `clinical | supportive | accent | alert`
`data-icon-name`: Lucide icon name

### Feature cards (options or service features)

```html
<section class="feature-cards"
  data-title="Treatment options"
  data-eyebrow="Options"
  data-background-preset="#B5FFE7">
  <div class="feature-card" data-intent="clinical">
    <h3 class="feature-card-title">PDE5 inhibitors</h3>
    <p class="feature-card-description">First-line oral therapy.</p>
  </div>
  <div class="feature-card" data-intent="supportive">
    <h3 class="feature-card-title">Vacuum device</h3>
    <p class="feature-card-description">Mechanical, non-pharmacological.</p>
  </div>
</section>
```

### Myth busters (minimum 2 items — hard drop if fewer)

```html
<section class="myth-busters" data-title="Myth vs Fact"
  data-layout="grid" data-theme="mint">
  <div class="myth-item" data-icon="sparkles">
    <p class="myth">Myth: Venous leak always means surgery.</p>
    <p class="fact">Fact: Most cases are managed without surgery.</p>
  </div>
  <div class="myth-item" data-icon="shield">
    <p class="myth">Myth: Low Doppler flow proves venous leak.</p>
    <p class="fact">Fact: Poor inflow mimics leak. Re-dosing is required
    before interpretation.</p>
  </div>
</section>
```

### Quiz (minimum 2 options, exactly 1 correct — hard drop otherwise)

```html
<section class="quiz">
  <h3>Which scenario points away from venous leak?</h3>
  <ul class="quiz-options">
    <li data-correct="true">Erections are reliable when alone, unreliable
    with a partner</li>
    <li data-correct="false">Erections fail in all contexts</li>
    <li data-correct="false">Lifelong inability to maintain rigidity</li>
  </ul>
  <p class="quiz-correct">Correct. Situational difficulty points to the
  adrenaline pathway, not structural leak.</p>
  <p class="quiz-incorrect">Not quite — re-read "Real venous leak versus
  the adrenaline impersonator".</p>
</section>
```

### Info box / Highlight

```html
<section class="info-box" data-background-color="blue">
  <p>Practical patient instruction.</p>
</section>

<section class="highlight" data-title="Key Point" data-border-color="brand">
  <p>The main clinical takeaway for patients to remember.</p>
</section>
```

`info-box` background: `gray | blue | white` only.
`highlight` border: `brand | gray` only.

### Forbidden / parser hard-drops

- Hex colours in structural blocks (`data-bg="#ff0000"`)
- Complex blocks nested inside card or accordion content (quiz, feature
  cards, myth busters, CTA banners, nested cards/accordions)
- Quiz with 0/1 options or multiple correct
- Myth busters with 1 item
- Unsafe URLs (`javascript:`, schemes other than `#`, `/`, `http(s)`,
  `mailto`, `tel`)
- Markdown syntax anywhere in HTML output
- `<script>`, `<style>`, inline JS
- Custom CSS classes outside the canonical list
- Nesting depth > 3
- Total traversed nodes > 5000

---

## 13. Custom icon selection — semantic matching

GGOMed has a **custom icon library** (16 categories) that sits alongside
the standard Lucide library. Icon choice is semantic, not decorative.

### Two icon systems — when to use which

| System | Where it lives | When to use |
|---|---|---|
| **Custom GGOMed icons** | 16 categories, brand-specific slugs (e.g. `doppler`, `e-ed`, `psa-blood`) | Brand-anchored sections, hero tiles, feature cards aligned to clinical concepts, link cards routing to clusters |
| **Lucide icons** | Standard library, generic names (e.g. `shield`, `alert-triangle`, `info`) | Parser-block `data-icon-name` and `data-icon` attributes (simple-card, myth-busters), generic UI affordances |

The two systems are not mutually exclusive in a single spoke. A page can
have a Lucide `alert-triangle` on a red-flag simple-card AND custom
`doppler` on a feature card about diagnostic options.

### The 16 custom categories — full inventory

01. **Navigation Core**: i-feel, i-need
02. **Clinical Anatomy**: penis, scrotum-testes, bladder, kidneys,
    prostate, peyronies, epididymis, urethra, seminal-vesicles,
    pelvic-floor, varicocele
03. **Symptoms**: pain, weak-flow, swelling, burning, frequency, nocturia,
    erectile-issues, fertility-worry, lump
04. **Fertility & Andrology**: ttc-fertility, testosterone, pde5,
    psychosexual
05. **Diagnostics**: psa-blood, uroflow, ultrasound, mri-scan,
    semen-analysis, genetics, cystoscopy, urine-test, doppler, biopsy,
    micro-tese, hydrocele, flow-rate, pvr-scanner, stockholm3, scrotal-us
06. **Procedures**: vasectomy, no-scalpel, shockwave, catheter,
    circumcision, implant-pump, aquablation-rezum, turp, orchidopexy,
    testicular-prosthesis, injection, wound-care, anaesthesia
07. **UI & Journey**: contact, consultation, video-consult, booking,
    location, patient-record, upload-send, fees, insurance, download,
    second-opinion
08. **Safety & Outcomes**: success, reminder, safe-protected, medication,
    recovery, healing, alert
09. **Trust & Transparency**: verification, trust, data-transparency,
    outcomes-data, audit, evidence-based, quality-mark, accreditation,
    privacy-gdpr, research, peer-reviewed
10. **Patient Experience**: satisfaction, timeline, follow-up, results,
    continuity
11. **Clinical Excellence**: expertise, innovation, precision,
    collaboration
12. **General Utility**: calendar, clock, menu, close, arrow-right,
    arrow-left, search, info, help, checkmark, warning
13. **Social & Contact**: social-youtube, social-instagram, social-tiktok,
    social-facebook, social-linkedin, social-researchgate, social-x,
    social-whatsapp, social-email, social-phone, social-website
14. **Metrics & Proof Points**: m-patients, m-appointments, m-completion,
    m-dna, m-return, m-remote, m-holistic-proof, m-completion-rate,
    m-low-dna, m-zero-adverse, m-patient-loyalty, m-fertility-success,
    m-verified-data, m-rapid-access, m-transparent-fees,
    m-iief-improvement
15. **Entry Points**: e-ed, e-urinary, e-testicular, e-pain, e-fertility,
    e-prostate, e-penile, e-haematuria
16. **Locations**: l-hospital, l-clinic

### Selection rules — semantic matching

The category determines the function. The slug must match the section's
clinical content, not its visual style.

**Mapping section type → category:**

| Section type | Primary category | Secondary fallback |
|---|---|---|
| Hero on a specific symptom | 03 Symptoms | 15 Entry Points |
| Hero on a specific anatomical condition | 02 Clinical Anatomy | 03 Symptoms |
| Hero on a hub entry point | 15 Entry Points | 02 Anatomy |
| Diagnostic procedure section (Doppler, USS, blood test) | 05 Diagnostics | — |
| Treatment / procedure section | 06 Procedures | 04 Fertility & Andrology |
| Investigation panel feature cards | 05 Diagnostics | 09 Trust & Transparency |
| Treatment options feature cards | 06 Procedures | 04 Fertility & Andrology |
| Red-flag / urgent-care simple-card | Use Lucide `alert-triangle` | 08 `alert` |
| Booking / consultation CTA | 07 UI & Journey | — |
| Evidence / guideline reference card | 09 Trust & Transparency | — |
| Stat / metric card | 14 Metrics & Proof Points | — |
| Sibling link cards routing across cluster | 15 Entry Points | 02 Anatomy |
| Hub return link card | 15 Entry Points | — |

### The hard rule — from SKILL.md

> "If no icon in the library fits a section, say so explicitly — do NOT
> suggest a close-but-wrong match."

This rule is non-negotiable. A close-but-wrong icon weakens the brand
system more than no icon at all. When pitching icons in Phase 8C
(Icon guidance), surface gaps explicitly so JJ can decide whether to
commission a new icon, fall back to Lucide, or omit.

### Icon density rule

Spokes typically use **3–8 custom icons per page**. Distribution:
- 1–2 in feature cards or hero tiles
- 1–3 in link cards (sibling routes + hub return)
- 0–2 in simple cards
- 0–1 on H2 sections (only when the section anchors a brand-recognised
  clinical concept like Doppler or Peyronie's)

**Avoid:** decorating every H2 with an icon. Icons earn their place by
adding clinical or brand semantic value, not by filling visual space.

### Phase 8C — Icon guidance deliverable format

When generating Phase 8C, format each icon proposal as:

```
SECTION / ELEMENT: [heading or block type, with anchor]
ICON: [slug] — [display name] — [category]
RATIONALE: [why this icon fits the clinical/brand semantics]
ALTERNATIVES: [if any close matches were considered and rejected]
```

If no library icon fits:
```
SECTION / ELEMENT: [heading or block type]
ICON: ❌ NO MATCH IN LIBRARY
RATIONALE: [what concept the section needs an icon for]
PROPOSAL: [commission new icon | fall back to Lucide [name] | omit]
```

---

## 14. Voice — inherited from long-form, narrowed for spoke

All long-form voice rules apply (see `content-engine.md`). Spoke-specific
narrowings:

- **Emotional hook earlier** — spoke titles often come from emotional
  patient language. The hero must match that register.
- **Redirect to hub for full context** — don't try to explain the whole
  condition; link up.
- **First-person JJ voice still standard** — "I take a full history",
  not "A full history is taken".
- **Direct reader address** — "you", "your", not "the patient".
- **Em-dashes are JJ's signature** — used liberally.
- **Anti-jargon, not anti-precision** — "the tunica albuginea — a thick,
  essentially inextensible layer" pairs the medical term with a
  description.
- **Honesty over reassurance** — "There is no cure that eliminates a
  structural venous leak entirely" sits next to "But here's what I also
  want you to hear: when it comes to erections, there is always a solution."

---

## 15. Length calibration — when to push back on JJ

If JJ briefs a spoke at **< 1.200 words**, push back. The under-developed
spokes (LUTS 448, balanitis 416, phimosis 504, lieswt 688) all share the
same problem: not enough prose to support the SEO play, not enough depth
to support the clinical play.

The minimum viable spoke is **~1.400 words of first-tier prose**. Below
that, the page either reads as marketing or fails to rank.

If the topic genuinely doesn't have 1.400 words of clinical substance
behind it, the question is whether it should be a spoke at all — it might
be a sub-section of a hub, a blog post, or an FAQ entry on an existing
spoke.

---

## 16. Year 11 readability — operative rules for tier 1

This applies to **every spoke**, not only PIF Tick spokes. Source rules
from `pif-tick.md`, applied to spoke production.

### Scope — what counts as tier 1

**First-tier text (Year 11 mandatory):**
- `<h2>`, `<h3>` headings
- `<p>` paragraphs at top level
- `<ul>` / `<ol>` items at top level
- Text inside `simple-card`, `feature-cards`, `cta-banner`, `highlight`,
  `info-box`
- Link card titles and descriptions
- `<summary>` text on inline-expand and accordion (the click-target itself
  is tier 1, even though what opens is not)

**Excluded from Year 11 check:**
- Content inside `<details>` panels (accordion bodies, inline-expand
  bodies)
- FAQ answers inside `.faq-answer`
- Quiz options and explanations
- Myth-busters body text
- Anything that requires a click to reveal

This split is precisely why progressive disclosure works: tier 1 stays
accessible to every reader; tier 2 carries the richer voice and detail
the engaged reader is choosing to enter.

### Operative rules

| Rule | Target |
|---|---|
| Flesch-Kincaid grade level | ≤ 10 (age 15–16) |
| Average sentence length | ≤ 20 words |
| Maximum single sentence | 30 words |
| Paragraphs | 2–4 sentences |
| Word choice | Anglo-Saxon over Latinate ("use" not "utilise"; "start" not "commence") |
| Technical terms | Plain-English explanation on first use |
| Subordinate clauses | No stacking (max one per sentence) |
| Nominalisation | Avoid ("we investigated" not "we conducted an investigation") |

### The technical-term-with-explanation pattern

This is the workhorse of GGOMed tier 1. Always pair the medical term with
a plain-English description on first use:

> "venous leak — a condition where blood drains out of the penis too
> quickly to maintain an erection"
>
> "the tunica albuginea — a thick, essentially inextensible layer that
> wraps the erectile tissue"

After first use, the medical term alone is acceptable.

### Practical test

**Read each first-tier paragraph aloud. If you stumble, simplify.**

This is the single most reliable check. If the writer cannot say it
fluently, the patient cannot read it fluently.

### What Year 11 does NOT mean

- It does not mean dumbing down. The clinical reasoning stays
  sophisticated; the language carrying it stays accessible.
- It does not mean removing nuance. Counter-claims, em-dashes, and
  qualifying phrases ("in most cases", "this varies considerably") are
  Year 11-compatible when the sentence stays under 20 words on average.
- It does not mean removing JJ's voice. The mature spokes (`partner`,
  `vl`, `test`) all pass Year 11 in tier 1 *while* sounding like JJ.

### When to flag a Year 11 conflict

If a clinical concept genuinely cannot be explained in tier 1 within
Year 11 — flag to JJ. Two resolutions:
1. **Move the technical detail into tier 2** (inline-expand or accordion),
   leaving a Year 11-compliant gist in tier 1.
2. **Accept a tier-1 sentence over 30 words** with explicit JJ sign-off
   if the alternative would distort the clinical meaning. This should be
   rare.

---

## 17. PIF Tick — additional layer (when applicable)

If JJ declares PIF Tick = yes in Phase 1:

- All Year 11 rules above remain — they are baseline, not PIF-specific.
- **Every first-tier clinical claim** needs a live-verified reference
  (process per `pif-tick.md` §Reference Verification Protocol).
- Treatment options must be presented with balance — NHS pathway
  acknowledged where it exists.
- Inclusivity language is mandatory (no assumptions on
  sexuality/gender/relationship).
- PIF metadata block populated in Phase 6C.
- Self-audit checklist run after Phase 6A draft (see `pif-tick.md` §PIF
  Tick Self-Audit).

If PIF Tick = no, all of the above are still recommended, but evidence
verification is best-effort rather than mandatory.

---

## 18. Meta / SEO — spoke specifics

- Primary KW is typically a **long-tail phrase** rather than a head term.
- Title: include the long-tail phrase, but write a real title — not just
  the KW.
- Meta description: 130–155 chars, includes primary KW, ends with location
  cue ("London urologist" / "London clinic").
- Breadcrumb: `/` > `/[hub-slug]` > `/[spoke-slug]`.
- Schema: `FAQPage` always (because faqInlineBlock is present);
  `MedicalCondition` or `MedicalProcedure` when narrower than the hub.

---

## 19. Quality gate — pre-Phase 8A checklist

Before generating HTML, verify:

**Structure:**
- [ ] Hero of 200–400 words BEFORE first H2
- [ ] 4–9 H2 sections, conversationally voiced
- [ ] H2s use em-dashes / first-person / counter-claims where natural
- [ ] No numbered H2s ("1. ", "2. ")
- [ ] No "What Is X, Exactly?" generic explainer opener
- [ ] First-person JJ voice throughout
- [ ] Direct reader address ("you", not "patients")
- [ ] Microcronaca present (integrated narrative OR inline-expand)
- [ ] Hub up-link present
- [ ] 2–4 sibling link cards at bottom
- [ ] Single CTA banner near close
- [ ] FAQ-group (faqInlineBlock) at bottom (4–8 questions, PAA-targeted)
- [ ] Word count 1.500–2.500 (push back if briefed below 1.400)
- [ ] Block density ≈ 1 interactive block per 100–250 words

**Progressive disclosure:**
- [ ] Tier 1 alone delivers the complete argument
- [ ] No risks / red flags / consent-relevant info hidden in tier 2
- [ ] Inline-expand vs accordion choice is semantic (§6 decision tree)
- [ ] Every `<summary>` text is descriptive and inviting (not "Read more")

**Year 11 (tier 1):**
- [ ] Read aloud test passes for every first-tier paragraph
- [ ] Average sentence length ≤ 20 words
- [ ] No first-tier sentence > 30 words (or explicit JJ exception logged)
- [ ] Technical terms paired with plain-English on first use
- [ ] Anglo-Saxon over Latinate
- [ ] No nominalisation drift
- [ ] No stacked subordinate clauses

**Parser:**
- [ ] All tones in valid enum (`clinical|supportive|accent|alert`)
- [ ] Quiz: ≥ 2 options, exactly 1 correct
- [ ] Myth busters: ≥ 2 items
- [ ] No complex blocks nested inside card/accordion
- [ ] Nesting depth ≤ 3
- [ ] All URLs use safe schemes
- [ ] No inline hex in structural blocks
- [ ] No markdown syntax
- [ ] No `<script>`, `<style>`, inline JS
- [ ] No H1 in HTML output (managed by Sanity)
- [ ] No inline references in HTML

**Icons:**
- [ ] Custom GGOMed icons selected by semantic match (§13 mapping table)
- [ ] No close-but-wrong custom icon — gaps surfaced as ❌ NO MATCH
- [ ] Lucide used only in parser-block `data-icon-name` / `data-icon`
- [ ] Icon density 3–8 custom icons per spoke (avoid icon-on-every-H2)
- [ ] Phase 8C deliverable in canonical format (§13)

**PIF Tick (if applicable):**
- [ ] Every first-tier claim has a live-verified reference
- [ ] Balance check passed
- [ ] Inclusivity language used
- [ ] PIF metadata fields populated in Phase 6C

---

## 20. Open questions for v0.4

- [ ] Document the **partner-leaflet-as-asset** pattern when
  `/erectile-dysfunction-relationship` ships.
- [ ] Quiz block use criteria — currently 0–4 across mature spokes.
  Hypothesis: only when the spoke has a clear binary self-assessment or
  myth-bust. Confirm with v0.4.
- [ ] Image / SVG ratio by topic-type (diagnostic spokes lean visual;
  relational spokes don't). Confirm with one more sample.
- [ ] Divider use philosophy — vl uses many, partner uses none. Both work.
  Document a "when to divide" rule.
- [ ] Quantify Flesch-Kincaid grade level on the three mature spokes —
  empirical baseline for the Year 11 target.

---

## 21. Behaviour rules for spoke production

1. **Read this guide BEFORE Phase 4** when page_type = spoke.
2. **Read `parser-patterns.md` BEFORE Phase 8A** for the canonical syntax.
3. **Read `pif-tick.md` BEFORE Phase 4** if PIF Tick = yes.
4. **Write the hero BEFORE the structural outline** — the voice in the
   hero determines the rest.
5. **Decide tier placement consciously** — for every claim, ask: tier 1,
   inline-expand, or accordion? Default tier 1; demote only if §5 rules 1
   and 2 are satisfied.
6. **Resist block density temptation** — when in doubt, write more prose.
7. **Push back on under-briefed spokes** — anything below 1.400-word
   target gets challenged before Phase 4.
8. **Sibling cross-links require sitemap verification** — never invent
   URLs.
9. **The hub link is not optional.**
10. **The closing prose section is not optional** — patient-facing
    imperative before CTA banner.
11. **Read aloud test** for tier 1 is the final readability gate.
12. **Icon selection is semantic, not decorative** — if no library icon
    fits, surface the gap explicitly. Never propose a close-but-wrong
    match.

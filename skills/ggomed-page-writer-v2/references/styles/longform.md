# Style Guide — Long-form Landing Page

**Status: FULLY DOCUMENTED (v0.1 canonical style)**

This is the canonical style for major condition/service landing pages on
ggomed.co.uk. It is distilled from the GGOMed Content Engine V2.0 and tuned
for what the writer needs during Phase 4 (first draft) and Phase 6 (full MD
draft): structure, ordering, density, and page-type-specific parser choices.

For general voice theory, see `references/content-engine.md`.
For parser syntax, see `references/parser-patterns.md`.
This file answers: **how does a long-form specifically differ from a spoke,
hub, or blog?**

---

## 1. When a page is a long-form

A long-form landing page is appropriate when ALL of the following hold:

- The topic is a **major condition or service** (not a narrow symptom variant)
- The page is expected to serve as a **pillar** — other pages link up to it
- SERP intent is **informational + commercial** (patients want to understand
  AND consider private treatment)
- Target word count is typically **2,000–4,000 words** of first-tier text
- The page needs to **stand alone** — it is not a spoke dependent on a hub
  for context

If any of these are missing, the page is probably a spoke, a hub, or a blog.
Confirm with JJ in Phase 1b.

**Examples of long-form pages:**
- `/erectile-dysfunction` (primary ED landing)
- `/haematuria` (blood-in-urine pillar)
- `/peyronies-disease` (condition pillar)
- `/penile-doppler-ultrasound` (service pillar)

**Not long-form (these are spokes):**
- `/cant-get-hard-with-partner` (narrow emotional intent, lives under ED hub)
- `/venous-leak-treatment` (specific treatment within ED cluster)

---

## 2. Canonical section order

Use this order unless JJ explicitly requests a variant. Every long-form
follows it.

```
1.  Hero — H1 + validating intro (2–4 sentences)
2.  On this page — anchor navigation
3.  What is [condition]? — plain-language definition + normal physiology
4.  Common symptoms & red flags — severity gradient + urgent-help card
5.  Causes & risk factors — grouped logically, honest about unknowns
6.  How we investigate — step-by-step, each test explained
7.  Treatment options — by category, honest about uncertainty
8.  Living with [condition] — QoL, emotional/relational impact
9.  What to expect at GGO Med — JJ's approach, locations, in-house tests
10. Microcronaca — the patient story (optional but common)
11. FAQs — 6–10 questions, real patient language
12. References — guidelines + papers + resources (separate section)
13. Closing CTA — brief, multi-option, non-pushy
14. Page metadata footer — author, review date, PIF Tick statement
```

Sections 10 (microcronaca) and 12 (references) are optional depending on
topic and PIF Tick status, but the others are non-negotiable for long-form.

---

## 3. The hero — specific rules for long-form

The hero does three things in 2–4 sentences, in this order:

1. **Validate the likely feeling** the patient arrived with (fear, embarrassment,
   frustration)
2. **Define the condition or service** in plain language
3. **Orient** — tell them what this page will do for them

Long-form heroes are **slightly longer** than spoke heroes because the page
serves a wider emotional range of readers. Still 2–4 sentences — not a wall.

**Example (ED long-form):**

```html
<header>
  <p class="eyebrow">GGO MED | CONDITION</p>
  <h1>Erectile Dysfunction: Expert Assessment & Treatment</h1>
  <p>Difficulty getting or keeping erections is far more common than most men
  realise — and almost never a reason for embarrassment. At GGO Med, I take
  erectile problems seriously, investigate them thoroughly, and explain
  your options clearly. Let me walk you through what ED actually is, what
  causes it, and how we treat it.</p>
</header>
```

**Why this works:**
- Normalises the experience ("far more common than most men realise")
- Removes stigma ("never a reason for embarrassment")
- First-person JJ voice ("I take... seriously")
- Clear orientation ("Let me walk you through")
- Primary keyword "erectile dysfunction" / "ED" used naturally

---

## 4. Interactive block density — long-form expectations

Long-form pages are **interactive-block heavy** compared to spokes or blogs.
Typical targets:

| Block type | Expected count | Placement |
|------------|----------------|-----------|
| Inline-expand | 3–6 | Within treatment options, diagnostic steps, complex mechanisms |
| Accordion (FAQ) | 1 group of 6–10 questions | Section 11 |
| Accordion (treatment list or category list) | 0–2 groups | Section 7 if treatments are many |
| Simple card (alert) | 1 | Red flags in section 4 |
| Feature cards (horizontal card bar) | 0–2 | Closing CTA, "How we help" |
| Link cards | 2–4 | Cross-links to spokes, hubs, related conditions |
| Quiz | 0–1 | Optional — typically a symptom check |

**Rule of thumb:** if a long-form has fewer than 4 interactive blocks total,
it is probably too flat for the depth of content. If it has more than 12, it
is probably over-decorated. Aim 6–10.

### Accordion vs inline-expand — the long-form choice

Long-form pages have one standard pattern for this decision:

- **FAQs**: always accordion (`faq-group`) — each question is a separate item
- **Treatment options**: **inline-expand per treatment** when treatments share
  a common layer (e.g., "how it works", "side effects", "when used"). Use
  accordion only if the treatments are genuinely discrete and unrelated.
- **Deep-dive on mechanism** (e.g. "how PDE5 inhibitors work", "what Doppler
  measures"): inline-expand
- **Myth busters**: accordion (each myth is separate)
- **Condition variants list** (e.g. "types of ED"): accordion if the variants
  are independent; inline-expand if they're depths of the same concept

---

## 5. Section-by-section writing rules

### Section 3 — What is [condition]?

- 2–4 paragraphs of first-tier prose
- One analogy or metaphor per section — not more
- Normal anatomy/physiology briefly introduced, then what goes wrong
- Do NOT hide the core definition in an accordion or inline-expand — it must
  be visible by default
- Medical term always followed by plain-language: "erectile dysfunction (ED)
  means difficulty getting or keeping an erection firm enough for sex"

### Section 4 — Symptoms & red flags

- **Bullet list from mild to severe**
- Red flags in a `simple-card` with `data-tone="alert"` — NEVER hidden in an
  accordion
- Explicit "when to call 999 / A&E" block for any condition with emergency
  red flags (e.g. priapism > 4 hours, painless macroscopic haematuria with
  clots)
- Distinguish "common but not dangerous" from "must not ignore"

### Section 5 — Causes & risk factors

- Grouped into categories (e.g. vascular, neurological, hormonal, psychological,
  lifestyle)
- Each category as an `<h3>` with its own paragraph — do NOT default to an
  accordion here
- Honest about uncertainty: "In many men, we can't identify a single cause — it's
  often a combination"
- If conflicting evidence exists, name the conflict

### Section 6 — Investigation

- Sequential presentation: history → examination → tests
- Each test block:
  - **What it is** (one sentence, plain language)
  - **What it involves for you** (patient experience — comfort, duration)
  - **What it tells us**
- Use inline-expand for "how the test actually works" detail on request
- Explicit NHS vs private contrast **only when clinically relevant** (speed of
  access, availability) — not as upsell

### Section 7 — Treatment options

- Sub-sections by category: **monitoring, lifestyle, medications, procedures,
  surgery** (use whichever apply)
- Within each, inline-expand per treatment for "how it works / evidence /
  side effects" detail
- Honest on variability: "Response varies considerably"
- No ranking or "best" treatment language — JJ does not do league tables
- If JJ has a clinical preference, it is stated **explicitly as his**: "In my
  practice, I tend to start with X because [reason]"

### Section 8 — Living with [condition]

- QoL impact: sex, fertility, relationships, daily function
- Emotional / psychological dimension named directly
- Partner / relational angle if relevant
- Support options (psychosexual therapy, physio, support groups) — specific
  references where known

### Section 9 — What to expect at GGO Med

- **First-person JJ voice throughout**
- What a consultation actually looks like
- In-house diagnostics available
- Clinic locations (Chelsea & Westminster Hospital, Nuffield Health Highgate)
- Remote review possibility for international patients
- Subtle — not a sales pitch

### Section 10 — Microcronaca (optional)

If included, format as:

```html
<section class="microcronaca">
  <h2>In clinic — a typical case</h2>
  <p><em>Details changed to protect patient identity.</em></p>
  <p>[The narrative, 3–5 paragraphs, first-person JJ]</p>
</section>
```

The microcronaca is a **composite, de-identified** narrative. Never a real
patient. Use it to illustrate the emotional arc + clinical reasoning, not to
dramatise.

### Section 11 — FAQs

- 6–10 questions
- Real patient language ("Is this cancer?" not "What is the differential
  diagnosis?")
- **Must include** (for most long-forms):
  - "Is this cancer?" (or equivalent anxiety question)
  - "Can it go away on its own?"
  - "Will this affect sex / fertility?"
  - "What if I'm embarrassed?"
- Each answer: 1–3 short paragraphs. Do not write essays in FAQ answers.

### Section 13 — Closing CTA

- Brief — 1–2 sentences lead-in, then options
- Typical structure: a 3-card feature bar or a simple `<a class="btn-primary">` with a
  `<a class="btn-secondary">` alternative
- Include an NHS/GP mention: "If you'd rather start with your GP, that's also
  reasonable — take this information with you"

---

## 6. Meta / SEO — long-form specifics

- Title: 50–60 chars, includes primary KW + location or practice
  - Format: `[Condition/Service] | [Specialisation] | [Location/Practice]`
- Meta description: 140–160 chars, patient-facing, CTA implied not shouted
- Primary KW: 1 phrase, density 0.8–1.5% in body
- Secondary KWs: 3–5, used in H2/H3 and naturally in prose
- Schema recommendations: `MedicalCondition` or `MedicalProcedure`, plus
  `FAQPage` for the FAQ section, plus `Physician` for JJ
- Breadcrumb markup: `/` > `[hub or nothing]` > `[this page]`

---

## 7. PIF Tick implications for long-form

Long-form pages are the **highest-priority** PIF Tick candidates because they
carry the most clinical weight and are the most likely to be surfaced in
search. If PIF Tick = yes for a long-form:

- Every clinical claim in first-tier text → verified reference (Phase 6)
- Readability: Year 11 target, check with a tool (Hemingway, etc.)
- Balanced treatment presentation — the section 7 structure above already
  supports this
- Conflict-of-interest statement in the page metadata footer

If PIF Tick = no, still aim for Year 11 readability and evidence tier
honesty — don't use "no" as an excuse to drop standards.

---

## 8. Phase 8 deliverable variations for long-form

### 8A — Parser-ready HTML

Long-form HTML output is typically 4,000–8,000 words of raw markup (interactive
blocks inflate the count). Chunk into logical section groups if the MD is
huge — don't try to emit 10,000 lines in one response. Signal to JJ where
chunks split.

### 8B — Visual assets list

Long-form pages typically need 3–6 illustrations:
- Anatomy / mechanism diagram (1)
- Red flag visual (1, often just card styling with icon)
- Treatment comparison visual (0–1)
- Microcronaca scene (0–1, optional)
- Section hero images (0–2)

### 8C — Icon guidance

Long-form pages use more icons than spokes — typically 6–12 icons placed at
major H2s, feature cards, and alert blocks.

### 8D — References list

Long-form: 8–20 references typical. Organise by tier (Guidelines / Papers /
Resources). All URLs live-verified.

### 8E — Metadata

Standard Sanity metadata block. For long-form, confirm `Cluster` and `Hub
page` fields are correctly populated — a long-form often acts AS the hub, so
`Hub page` may point to itself.

---

## 9. Anti-patterns specific to long-form

- ❌ Opening with a medical definition instead of validation
- ❌ Hiding red flags in an accordion
- ❌ Accordion-ing the "What is" section
- ❌ Ranking treatments as "best" or "most advanced"
- ❌ More than 12 interactive blocks (over-decorated)
- ❌ Fewer than 4 interactive blocks (under-structured for depth)
- ❌ Writing a microcronaca about a specific real patient
- ❌ Embedding external booking widgets mid-page (belongs in closing CTA only)
- ❌ FAQ essays — if an FAQ answer runs past 3 paragraphs, it belongs in the
  body of the page, not the FAQ

---

## 10. Reference: the full Content Engine V2

For any corner case not covered here, defer to `references/content-engine.md`
and the original Content Engine V2 document. This file is the operational
summary for long-form; that is the authoritative source.

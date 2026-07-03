# Style Guide — Questionnaire Page

**Status: STUB (v0.1) — full documentation in v0.2+**

A questionnaire page is a **structured patient-facing questionnaire** with
scored or interpretive output — e.g. GEQA, IPSS, IIEF-5. It is a hybrid:
partly structured form, partly clinical education, partly scoring/interpretation
logic.

---

## 1. When a page is a questionnaire

A questionnaire page:

- Presents a **structured set of questions** with defined answer options
- Has **scoring or interpretive logic** (scalar score, tier buckets,
  flag-based output)
- Returns **a result the patient can understand and act on**
- Typically has its own **Sanity schema** (not the standard portable-text
  body — questionnaires use a custom content type with question arrays,
  answer maps, and scoring rules)

**Examples of questionnaire pages:**
- GEQA (GGOMed Erectile Questionnaire, custom to the practice)
- IPSS (International Prostate Symptom Score)
- IIEF-5 (Index of Erectile Function, short form)
- Possibly future: SHIM, AMS, NIH-CPSI, GAD-7 for psychosexual context

---

## 2. Two distinct components in every questionnaire

A questionnaire page almost always splits into two surfaces:

### A. Educational / framing content (first-tier prose)
- What this questionnaire is for
- Who it's appropriate for
- How to interpret the result
- What to do with the result (when to act, what to discuss with a clinician)
- Caveats and limitations (questionnaires are screening tools, not diagnoses)

### B. The questionnaire itself (structured content)
- Questions (text, order, answer options)
- Scoring rules (point values per answer, summation logic, weights)
- Result bands (e.g. 0–7 mild, 8–19 moderate, 20–35 severe — IPSS example)
- Result interpretation text per band

The first component (A) uses standard GGOMed voice and parser patterns. The
second component (B) is **schema-specific** and not a free-text portable-text
block — it requires the custom questionnaire type.

---

## 3. Inherited structure (best-effort v0.1)

```
1. Hero — H1 + validating intro (what this is, who it's for)
2. Who should use this questionnaire — eligibility, appropriateness
3. How to use it — 2–3 sentences on mechanics
4. Caveats and limitations — honest framing (it's a screen, not a diagnosis)
5. [Questionnaire block — structured schema] ← custom content type
6. How to interpret your result — decoded for the patient
7. What to do next — when to come in, when to wait, when to seek urgent care
8. Related reading — link card back to the relevant condition page (e.g.
   GEQA → ED longform)
9. Metadata footer
```

Sections 1–4 and 6–9 use standard parser patterns.
Section 5 uses the custom questionnaire schema (field IDs, answer maps,
scoring config).

---

## 4. Custom schema awareness (critical for questionnaire pages)

This is the one page type where the writer **must** know the Sanity schema
in detail before writing. The questionnaire custom type likely has fields
like:

- `questions[]` — array of question objects
  - `id` — unique question ID
  - `text` — question text
  - `answerOptions[]` — array with label + scoreValue per option
  - `required` — boolean
- `scoring` — scoring config object
  - `method` — e.g. "sum", "weighted", "bucketed"
  - `bands[]` — result bands with min/max + interpretation text
- `framing` — portable text for sections 1–4 and 6–9 above

⚠️ **In v0.1 this schema is not yet documented here.** Before writing a
questionnaire page, the writer MUST use Sanity MCP `get_schema` on the
questionnaire content type to confirm field names and shapes. Do not guess.

---

## 5. Voice adjustments for questionnaires

- **Framing content** uses standard GGOMed voice (warm + blunt + precise)
- **Question text** needs extra care:
  - Plain language, no jargon
  - Unambiguous — each question should have exactly one interpretation
  - Time-bounded where relevant ("in the last 4 weeks")
  - Non-leading — don't phrase questions to push an answer
- **Result interpretation text** is where the voice shines:
  - Acknowledge the emotional weight of a concerning result
  - Orient to next steps without alarmism
  - Never catastrophise a high score

---

## 6. Licensing / attribution (critical)

Many existing questionnaires (IPSS, IIEF-5, SHIM, AMS) are **copyrighted
clinical instruments**. Before publishing any existing questionnaire:

- Confirm the licensing / permissions status with JJ
- Attribute the original authors / issuing body explicitly in the framing
  content
- Do NOT modify wording of licensed instruments — the validated wording is
  what's been psychometrically tested

GEQA (GGOMed's own questionnaire) is house-written and can be freely shaped.
Others cannot.

---

## 7. Best-effort interactive block pattern

| Block type | Target count | Placement |
|------------|--------------|-----------|
| Simple card (supportive) | 1–2 | Framing caveats, result orientation |
| Inline-expand | 0–2 | "How this questionnaire was validated" detail |
| Accordion (FAQ) | 0–1 group of 3–5 questions | Section 7 if common questions recur |
| Link cards | 1–2 | Link back to the parent condition page |
| Custom questionnaire block | 1 | Section 5 — the actual instrument |

Questionnaire pages should NOT have feature cards, quizzes (confusing with
the questionnaire itself), or long accordions.

---

## 8. TODO for v0.2 (what to document)

- [ ] **Pull the GEQA page** from Sanity and analyse:
  - Exact schema shape of the questionnaire content type
  - Framing copy patterns
  - Result interpretation language
  - Layout of section A vs section B on the page
- [ ] **Pull any other existing questionnaire pages** (IPSS, IIEF-5 if live)
  and document the same
- [ ] **Document the questionnaire Sanity schema** in full — field names,
  types, nesting, required vs optional
- [ ] **Document licensing status** for each instrument GGOMed uses
- [ ] **Document the scoring-to-interpretation mapping pattern** for each
  instrument
- [ ] **Document result-action flow**: what does the page recommend based on
  score bands? Is there a "book consultation" trigger at a certain
  threshold?
- [ ] **Document accessibility**: questionnaire pages have specific a11y
  requirements (labels, keyboard navigation, screen reader compatibility) —
  confirm these are handled in the schema/front-end rather than content
- [ ] **Catalogue questionnaire anti-patterns** — leading questions,
  unvalidated wording on licensed instruments, alarmist interpretation text

---

## 9. Best-effort flag for JJ

> "Lo style guide per questionnaire è stubbato e, cosa importante, lo schema
> Sanity del tipo questionnaire non è ancora documentato qui. Prima di
> procedere, fammi fare un `get_schema` via Sanity MCP per confermare la
> struttura reale. Poi, se è un instrument esistente (IPSS, IIEF-5), confermi
> licensing. Se è custom (tipo GEQA), procedo in voice GGOMed.
> Dimmi come vuoi procedere."

Wait for JJ's direction before Phase 2. For questionnaires, schema fetch is
non-negotiable — the custom content type cannot be written blind.

# PIF Tick Compliance — Criteria & Application Guide

Source: Patient Information Forum PIF Tick Quality Mark standards
Applies to: GGOMed pages where PIF Tick accreditation is intended

---

## What PIF Tick Requires

PIF Tick is a UK quality mark for health information. It requires that patient-facing
content is:

1. Accurate and evidence-based
2. Balanced and non-promotional
3. Readable and accessible
4. Inclusive and health-inequalities-aware
5. Clearly attributed with author credentials and review dates
6. Based on current, verifiable sources

---

## Readability — Year 11 Standard

**Scope:** First-tier text only — content directly visible without user interaction.

**First tier includes:**
- `<h2>`, `<h3>` headings
- `<p>` paragraphs at top level
- `<ul>` / `<ol>` list items at top level
- Text in `cardBlock`, `featureCardsBlock`, `ctaBannerBlock`, `highlightBlock`, `infoBoxBlock`

**Excluded from readability check:**
- Content inside `<details>` / `<summary>` (accordion, inline-expand)
- FAQ answers inside `.faq-answer`
- Quiz and myth-busters content
- Any content that requires a click to reveal

**Year 11 readability rules:**
- Aim for Flesch-Kincaid Grade Level ≤ 10 (approx. age 15–16)
- Sentences: average ≤ 20 words. Maximum single sentence: 30 words.
- Paragraphs: 2–4 sentences
- Prefer Anglo-Saxon words over Latinate: "use" not "utilise", "start" not "commence"
- Technical terms: always followed by plain-English explanation on first use
  e.g. "venous leak — a condition where blood drains out of the penis too quickly"
- No stacked subordinate clauses
- Avoid nominalisation: "we investigated" not "we conducted an investigation"

**Practical test:** Read each first-tier paragraph aloud. If you stumble, simplify.

---

## Scientific Soundness

**Evidence quality markers — use consistently:**

| Marker | When to use |
|--------|-------------|
| "Research consistently shows…" | Systematic reviews / meta-analyses |
| "Studies suggest…" / "Evidence indicates…" | RCTs and good observational data |
| "Some research suggests…" | Limited or mixed evidence |
| "The evidence here is limited" | Small studies, case series |
| "Guidelines recommend…" | NICE / BAUS / EAU guideline-based |
| "In my clinical practice, I've found…" | JJ's personal experience |
| "We don't fully understand why…" | Genuinely unknown mechanisms |

**Never:**
- State statistics without a source
- Use definitive language ("always causes", "always cures") unless evidence is overwhelming
- Present personal opinion as established fact without flagging it

---

## Reference Verification Protocol

**Rule: Every first-tier clinical claim must have a live-verified reference.**

**Process (must follow exactly):**

1. Identify each claim in first-tier text that is factual / statistical / clinical
2. For each claim, fetch the source URL using `web_fetch` (live web request)
3. Confirm the page loads and the content matches the claim
4. Construct the citation from the live page — NOT from LLM training data
5. Format in Vancouver style where possible:

```
[N] Surname Initials, Surname Initials. Title of article. Journal Abbrev.
Year;Vol(Issue):start–end. doi:XX.XXXX/XXXXX
```

Or for web/guideline sources:
```
[N] Author/Organisation. Title. Publisher/Website. Published/Updated [date].
Available from: https://[verified-url] [Accessed: current date]
```

**Failure modes — handle explicitly:**

| Situation | Action |
|-----------|--------|
| URL returns 404 | Mark ❌ INACCESSIBLE — ask JJ for alternative |
| URL loads but claim not found on page | Mark ⚠️ CONTENT MISMATCH — flag to JJ |
| URL loads, claim confirmed | Mark ✅ VERIFIED |
| No URL provided for claim | Ask JJ to provide a source URL before proceeding |

**Never:**
- Construct a reference from LLM training memory
- Use a generic journal homepage URL (e.g. `https://www.nejm.org`) as a reference
- Assume a DOI is valid without fetching it
- Use Wikipedia as a primary source

**Acceptable primary sources:**
- PubMed abstracts (`https://pubmed.ncbi.nlm.nih.gov/[PMID]/`)
- NICE guidelines (`https://www.nice.org.uk/guidance/...`)
- BAUS guidelines (`https://www.baus.org.uk/professionals/sections/...`)
- EAU guidelines (`https://uroweb.org/guidelines/...`)
- BMJ, Lancet, NEJM, BJUI, European Urology — via DOI
- Government / NHS sources (`.gov.uk`, `nhs.uk`)
- Cochrane reviews (`https://www.cochranelibrary.com/cdsr/...`)

---

## Balanced Presentation

PIF Tick requires that all reasonable treatment options are presented fairly.

**Rules:**
- Do not promote one treatment pathway without explaining why others may be suitable
- Where NHS and private pathways exist, acknowledge both
- Where evidence is mixed or options are equivalent, say so explicitly
- Do not omit options because they are not offered at GGOMed
  — acknowledge they exist and signpost where relevant

**Example (balanced):**
```
Treatment options for venous leak include lifestyle changes, medical therapy, and
in selected cases, surgical intervention. The evidence for surgical repair is
limited and it is not suitable for all patients. In my practice, I recommend
starting with the least invasive option that fits your specific pattern.
```

**NOT acceptable:**
```
Surgery is the only definitive treatment for venous leak.
```

---

## Inclusivity Requirements

**Language rules:**
- No assumptions about sexual orientation: "your partner" not "your wife"
- No assumptions about gender of partner: avoid "her", "him" unless patient-specified
- Trans-inclusive language where relevant: "people with penises" in appropriate contexts
- No assumption of monogamy or relationship status
- No assumption of heterosexuality in erectile dysfunction content
- Cultural sensitivity: avoid idioms that may not translate across backgrounds

**Health inequalities — acknowledge where relevant:**
- Cardiovascular risk factors vary by ethnicity (e.g. South Asian men and diabetes)
- Access to diagnostics varies (signpost NHS pathway where it exists)
- Stigma around sexual health varies by cultural background — normalise explicitly
- Mental health overlap — acknowledge psychosocial determinants without stereotyping

**Disability and neurodiversity:**
- Clear structure benefits neurodivergent readers — maintain heading hierarchy
- Avoid sarcasm or irony in patient-facing text
- Plain English in first tier supports low-literacy readers

---

## Required Metadata (PIF Tick pages)

These fields must appear in Phase 6C and be populated in Sanity:

| Field | Value |
|-------|-------|
| Author name | Mr Giangiacomo Ollandini |
| Author credentials | Consultant Urological Surgeon, FRCS (Urol), FEBU |
| Author affiliation | GGO Med Ltd, Chelsea & Westminster Hospital / Nuffield Health Highgate |
| Date produced | [date of original publication] |
| Date last reviewed | [date] |
| Date of next review | [+12 months from last reviewed] |
| Intended audience | Patients and their partners / family members |
| Content purpose | Patient information and education |
| Evidence base | [list primary guidelines/studies used] |
| Funding / conflicts | No sponsorship. Private practice page. |

---

## PIF Tick Self-Audit (run after Phase 6A draft)

- [ ] All first-tier paragraph sentences average ≤ 20 words
- [ ] Technical terms explained on first use in first-tier text
- [ ] Every first-tier claim has a verified reference (✅ status)
- [ ] No unverified references in the reference list
- [ ] Treatment options presented with balance
- [ ] NHS pathway acknowledged where it exists
- [ ] Language inclusive — no assumptions on relationship/sexuality/gender
- [ ] Health inequalities mentioned where clinically relevant
- [ ] Evidence quality markers used correctly throughout
- [ ] Metadata fields complete in Phase 6C
- [ ] Review date set (+12 months)

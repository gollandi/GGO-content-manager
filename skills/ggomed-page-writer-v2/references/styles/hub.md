# Style Guide — Hub Page

**Status: STUB (v0.1) — full documentation in v0.2+**

A hub is the **parent page of a content cluster**. It sits above spokes,
provides orientation, and routes readers to the right sub-page for their
specific intent. It is navigation-heavy and synthesis-light.

Until this guide is fully documented, proceed with best-effort. Flag to JJ
that you are on a stubbed style and offer to pull real hub pages first.

---

## 1. When a page is a hub

A hub page:

- Sits **above multiple spokes** in a cluster
- Is primarily a **routing / orientation page** — it helps patients find the
  right sub-page for their specific situation
- Typically **1,200–2,000 words** of first-tier text — shorter than long-form
  because depth lives in the spokes
- Has a **high density of link cards** (this is the defining structural
  feature)
- Covers the condition at **pillar depth** but defers specific angles to spokes

**Examples of hub pages:**
- `/erectile-dysfunction` (the ED cluster hub — though this may also function
  as the long-form pillar in the current architecture; confirm with JJ
  whether a page is hub-only or hub+long-form)

⚠️ **Important ambiguity**: on ggomed.co.uk the hub and the long-form can be
the same page (the ED page is both the hub of the ED cluster AND the
long-form pillar for the condition). Confirm with JJ in Phase 1b whether the
hub is standalone or hub+long-form — the choice changes structure
significantly.

---

## 2. Inherited structure (best-effort v0.1)

```
1. Hero — H1 + validating intro (2–3 sentences)
2. What is [condition]? — condensed version of the long-form section 3
3. Who this page is for / how to use it — orientation about the cluster
4. Find your path — the core of the hub: link cards to each spoke grouped by
   patient intent (emotional / symptomatic / treatment-seeking / etc.)
5. Overview of key areas — brief synthesis with links into spokes
6. When to see a urologist / red flags — brief
7. How we help at GGO Med — JJ's approach, short
8. FAQs — 4–6 high-level questions (detail-level FAQs live in spokes)
9. Closing CTA
10. Metadata footer
```

The defining feature vs. long-form: **section 4 (link cards) is the engine of
the page**. Spokes are surfaced here, grouped meaningfully, and it is the
primary way readers leave the hub for deeper content.

---

## 3. Best-effort interactive block pattern

| Block type | Target count | Placement |
|------------|--------------|-----------|
| Link cards | 6–12 | Section 4 is dense with them |
| Feature cards (horizontal bar) | 1–2 | "How we help" or closing CTA |
| Inline-expand | 1–2 | Minimal — depth belongs in spokes |
| Accordion (FAQ) | 1 group of 4–6 questions | Section 8 |
| Simple card (alert) | 0–1 | Red flags if relevant |

Avoid deep inline-expands on a hub — they pull the reader into depth on the
hub instead of driving them to the spoke where depth belongs.

---

## 4. Voice adjustments for hub

- **Orientation-first tone**: the hub says "here's the landscape, here's
  where to go"
- **Less clinical depth, more patient-journey framing**: group spokes by
  patient intent rather than by clinical taxonomy
- **Brief**: hub text is lean. Every sentence earns its place. Patients on a
  hub want to get out to the right spoke fast.

---

## 5. Meta / SEO — hub specifics

- Primary KW: usually the **head term** (e.g. "erectile dysfunction")
- Title: the head term + practice/location
- Internal linking: hubs receive inbound links from many spokes AND outbound
  links to many spokes — dense linking
- Schema: `MedicalCondition` typically + nested references to related
  procedures

---

## 6. TODO for v0.2 (what to document)

- [ ] **Resolve the hub-vs-longform ambiguity**: document explicitly when a
  page is hub-only, longform-only, or hub+longform. Identify current pages of
  each type.
- [ ] **Pull the current ED hub page** from Sanity and analyse:
  - How link cards are grouped (by intent? by treatment stage?)
  - What copy pattern introduces each group
  - What the hero looks like on a hub vs a long-form
- [ ] **Document the "Find your path" pattern** — the canonical grouping
  logic for link cards (emotional / symptomatic / treatment / diagnostic?)
- [ ] **Document cross-hub linking** — how hubs reference sibling hubs
  (e.g. ED hub linking to LUTS hub where conditions overlap)
- [ ] **Catalogue hub-specific anti-patterns** from live pages
- [ ] **Document how a hub relates to its microcronaca** — does a hub carry
  a microcronaca or is that always a spoke/longform thing?

---

## 7. Best-effort flag for JJ

> "Lo style guide per hub è stubbato e c'è un'ambiguità architettonica da
> risolvere: in alcune pagine di ggomed.co.uk il hub e il long-form coincidono.
> Confermi che questa pagina è [hub-only / hub+longform / longform-only]?
> Se non sei sicuro, estraiamo la hub di ED da Sanity e confrontiamo."

Wait for JJ's direction before Phase 2.

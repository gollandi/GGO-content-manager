# Style Guide — Blog Post

**Status: STUB (v0.1) — full documentation in v0.2+**

A blog post is a **narrative, opinion, or deep-dive article** — longer-form
editorial content that does not map onto the condition/service/hub taxonomy.
Blog posts are where JJ's voice can be more essayistic, opinionated, or
narrative.

---

## 1. When a page is a blog

A blog post:

- Is typically at `/blog/[slug]` (URL pattern differs from condition/service
  pages)
- Has a **narrative, opinion, or exploratory** angle — not a reference doc
- Word count varies widely: **800–3,000 words** typical
- Often has a **singular angle or argument** rather than comprehensive coverage
- Can be time-anchored (news, updates, reactions) or evergreen (deep-dives on
  niche topics)
- Is NOT trying to rank for a head term — often long-tail or intent-specific

**Examples of blog posts:**
- `/blog/varicocele-and-sport` (narrow deep-dive)
- `/blog/performance-anxiety` (psychological angle on a clinical topic)
- `/blog/testosterone-myths` (myth-busting format)

---

## 2. Inherited structure (best-effort v0.1)

Blog structure is **more flexible** than condition/service pages. Typical
shape:

```
1. Hero — H1 + evocative intro (can be longer than a long-form hero, 3–5
   sentences, can open with a vignette or question)
2. The argument / the question / the story — body of the piece
3. What the evidence says — brief, honest
4. What I do in practice — JJ's angle explicitly
5. Practical takeaway — if applicable
6. Related reading — link cards back to condition/service pages
7. FAQs — optional, often 0–3
8. Closing (less a CTA, more a "next step if this resonated")
9. Metadata footer
```

Blog structure is **driven by the argument**, not by a fixed skeleton. The
outline above is a suggestion, not a template.

---

## 3. Best-effort interactive block pattern

Blog posts are **interactive-block light** compared to condition pages:

| Block type | Target count | Placement |
|------------|--------------|-----------|
| Inline-expand | 0–2 | Only when genuine deep-dive is needed |
| Accordion | 0–1 | FAQ only, optional |
| Simple card (accent or supportive) | 0–2 | Pull-quotes, key points |
| Link cards | 2–3 | Related reading section |

Blog posts favour **prose flow** over interactive fragmentation. If a blog
post has more than 4 interactive blocks, it probably wants to be a long-form
or a spoke, not a blog.

---

## 4. Voice adjustments for blog

- **More room for JJ's opinion and personality**
- **Can open with a scene, a question, a provocation** — the "validating
  intro" of long-form relaxes here
- **Can argue a position** (cleanly, with evidence) rather than present
  options neutrally — a blog is where "my approach is X and here's why" has
  the most room
- **Essayistic flow preferred over bullet-list structure** in body
- Still UK English, still first-person JJ, still evidence tiers honoured

---

## 5. Meta / SEO — blog specifics

- Primary KW: long-tail, often intent-specific
- Title: can be catchier/editorial compared to condition pages, but still
  avoid clickbait (no "5 shocking facts")
- Schema: `Article` or `BlogPosting` typically, plus `Physician` for JJ
- Date fields: blog posts carry **published date** more visibly than
  condition pages — readers care when a blog was written

---

## 6. TODO for v0.2 (what to document)

- [ ] **Pull 2–3 existing blog posts** from Sanity (if any exist — check
  first; the blog section may still be sparse)
- [ ] **Document the hero pattern variations** for blog posts (vignette-led,
  question-led, argument-led)
- [ ] **Document the "what I do in practice" section** — how JJ's opinion
  lands in-voice
- [ ] **Document evergreen vs time-anchored blog patterns**
- [ ] **Document when a blog post should be promoted to a spoke or long-form**
  (some ideas start as blogs and deserve pillar treatment)
- [ ] **Catalogue blog-specific anti-patterns** (e.g. too many interactive
  blocks, SEO-chasing titles)
- [ ] **Decide cross-linking conventions**: blog → condition pages (standard),
  blog → blog (how? when?), condition pages → blog (rarely, in "further
  reading")

---

## 7. Best-effort flag for JJ

> "Lo style guide per blog è stubbato. Procedo con struttura flessibile e
> voce più essayistica, ma ti segnalo scelte strutturali importanti man mano.
> Se vuoi, prima estraiamo i blog esistenti da Sanity per cristallizzare lo
> stile — dimmi tu."

Wait for JJ's direction before Phase 2.

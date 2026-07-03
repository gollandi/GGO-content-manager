# GGOMed Colour Rules & Block Selection

Source: colour_restrictions.txt + PARSER_RULES.txt (March 2026)

---

## Core Principle

**Meaning over appearance.** Pick the block by content purpose, not visual preference.
**Tone over hex.** Use semantic tones and approved presets — never inject custom hex.

---

## Block Selection Decision Flow

1. Plain narrative or explanation?
   → headings + paragraphs + lists

2. Content collapsible?
   → `accordionBlock` (`<details>` or accordion pattern)

3. Compact highlighted container?
   → `cardBlock` (simple-card)

4. Set of equivalent options/features?
   → `featureCardsBlock`

5. Strong call to action?
   → `ctaBannerBlock`

6. Educational interaction?
   → `quizBlock` or `mythBustersBlock`

7. Factual notice or takeaway?
   → `infoBoxBlock` or `highlightBlock`

8. Routing to related pages?
   → `linkCardBlock`

---

## Semantic Tone Model

| Tone | Use for |
|------|---------|
| `clinical` | Neutral, factual, baseline medical information |
| `supportive` | Reassurance, guidance, patient support messaging |
| `accent` | Emphasis for important but non-critical content |
| `alert` | Caution, risk, contraindication, urgent recommendations |

**Never use `alert` for promotional content.**
Tones apply to: `cardBlock`, `accordionBlock`, `link-card` (data-intent).

---

## Colour System Rules by Block Type

### Card and Accordion
- Use `tone` attribute only
- Do NOT use custom background color fields
- Valid: `data-tone="clinical"` / `"supportive"` / `"accent"` / `"alert"`

### CTA Banner and Feature Cards
- Use `data-background-preset` only for background
- `ctaBannerBlock` may also use `data-text-color` from approved enum
- Do NOT hardcode inline color CSS

### Info Box
- `data-background-color` limited to: `gray | blue | white`
- Nothing else accepted

### Highlight Block
- `data-border-color` limited to: `brand | gray`
- Nothing else accepted

### Inline text color (rare, justified use only)
- Prefer brand shortcut values
- Avoid custom hex unless documented accessibility requirement

---

## Approved Brand Palette

Use ONLY through schema-supported presets — not direct injection:

| Token | Hex | Typical use |
|-------|-----|-------------|
| Primary Teal | `#00EEB6` | Accent / highlight |
| Mint | `#B5FFE7` | Feature cards background |
| Soft Blue | `#E3EEFD` | CTA banner, info box |
| Clinical Blue | `#3208F5` | — |
| Deep Indigo | `#140072` | — |
| Forest Green | `#082C23` | Text color on light bg |
| Charcoal | `#111111` | Body text |
| Warm Charcoal | `#4B4B4B` | Secondary text |

For `data-background-preset` in feature-cards and cta-banner, use the hex value
of an approved brand token only (e.g. `data-background-preset="#B5FFE7"`).

For `data-text-color` in cta-banner, use enum values (e.g. `"forest"`, `"charcoal"`),
not hex.

---

## Recommended Compositions

### Standard clinical page section
```
h2 + paragraph introduction
↓ accordionBlock (expandable details)
↓ infoBoxBlock (practical patient instruction)
↓ ctaBannerBlock (primary conversion action)
```

### Comparison / options section
```
h2 with concise framing
↓ featureCardsBlock (options, data-background-preset="#B5FFE7" or "#E3EEFD")
↓ highlightBlock (key recommendation, data-border-color="brand")
```

### Myth correction section
```
mythBustersBlock (minimum 2 myth/fact pairs)
↓ quizBlock for reinforcement (optional)
↓ ctaBannerBlock for next step
```

---

## Anti-Patterns

- "Visual hacking" with inline hex or custom CSS classes for block background
- Using `alert` tone for non-critical promotional content
- Nesting complex interactive blocks inside card/accordion content
- Mixing multiple visual intents in one block when separate blocks would be clearer
- Using `data-background-color="teal"` on infoBox (only gray/blue/white allowed)
- Using brand hex values on blocks that only accept tone enums

---

## Coherence Checklist Before Phase 6 HTML

1. **Structure:** Every section using correct block type for its intent?
2. **Tone:** Each tone semantically justified?
3. **Colour:** Only approved presets/enums used?
4. **Interaction:** Quizzes and myth-busters structurally valid?
5. **Nesting:** Nested content inside cards/accordions limited to simple blocks?
6. **Accessibility:** Links valid and safe. CTA labels explicit and action-oriented.

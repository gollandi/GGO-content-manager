# GMC Social Media Compliance Guardrails

These guardrails are derived from GMC guidance on doctors' use of social media (2024) and the Advertising Standards Authority (ASA) rules on health claims. Every caption Samantha produces must pass all checks before presentation to JJ.

## Mandatory Checks

### 1. No Outcome Guarantees
Clinical content must never promise or imply guaranteed results.

- ❌ "This treatment will restore your erections"
- ✅ "This treatment may help improve erectile function"
- ❌ "Surgery fixes varicocele in 95% of cases"
- ✅ "Studies show improvement in semen parameters in up to 60-80% of cases following varicocelectomy"

**Rule**: If a caption contains "will", "always", "guarantees", "cures", or "fixes" in a clinical context, flag it.

### 2. No Implied Testimonials
Patient stories or outcomes must not be presented in a way that implies endorsement or typical results.

- ❌ "One of my patients came back after 3 months and told me his life had changed"
- ✅ "In clinical practice, patients may notice improvement within 3-6 months" (generalised, anonymised)

**Rule**: Any mention of a specific patient outcome (even anonymised) must be clearly framed as illustrative, not representative.

### 3. No Misleading Claims
Every factual clinical statement should be supportable. If the Notion row has a Source URL, the caption's claims should align with that source.

- ❌ "Varicocele is the number one cause of male infertility" (oversimplification)
- ✅ "Varicocele is one of the most common identifiable causes of male subfertility"

**Rule**: If a caption makes a specific claim (statistic, ranking, mechanism) and no Source URL is provided in Notion, flag it with: "⚠️ Claim requires source — please provide reference or soften language."

### 4. No Pressure Language
Content must inform, not coerce. Urgency is acceptable only for genuine clinical urgency (e.g., testicular torsion).

- ❌ "Don't wait — every day you delay could be making it worse"
- ✅ "If you've been experiencing symptoms for more than a few weeks, it's worth speaking to a specialist"
- ❌ "Book NOW before it's too late"
- ✅ "Book a consultation to discuss your options"

**Rule**: Flag language that creates artificial urgency or fear.

### 5. Proper Title and Credentials
- Always: "Mr Giangiacomo Ollandini" or "Mr Ollandini"
- Never: "Dr Ollandini", "Dr GGO", or any shorthand
- Full credentials when used: "FRCS(Eng)" — not "FRCS(Urol)" or "FEBU"
- Professional title: "Consultant Urological Surgeon & Andrologist"

### 6. No Patient-Identifiable Content
- No real patient details, even partially anonymised, unless JJ explicitly confirms consent
- No clinic photos that could identify patients (waiting room shots with people, etc.)
- Stock/illustration descriptions must not reference real patient scenarios

### 7. Advertising Transparency
If a post promotes JJ's private practice services (e.g., "book a consultation"), it should be clearly from a named practitioner, not disguised as neutral health advice. This is usually implicit in the GGOMed branding, but watch for captions that blur the line.

### 8. Scope of Practice
Captions should stay within urology and andrology. If a post touches on adjacent fields (cardiology, endocrinology, mental health), frame it as:
- "I work closely with cardiologists when..."
- "I often refer patients to..."
- Not: "Here's what you should do about your heart condition"

## Flagging Format

When a caption fails a check, flag it inline in the batch review:

```
⚠️ GMC flag [Check 1 — Outcome Guarantee]:
  Line: "This procedure will resolve your symptoms"
  Suggestion: "This procedure may help improve symptoms in many cases"
```

Multiple flags per caption are possible. List all, don't stop at the first.

## When in Doubt

If Samantha is unsure whether a caption complies, she flags it with a 🟡 (amber) rather than ✅ (green) and explains why. JJ makes the final call — Samantha never silently approves borderline content.

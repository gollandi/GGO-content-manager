# Stato del cockpit — 2026-07-06

> Fotografia post-build (3 giorni di sprint). La spec resta
> [GGOMED-COCKPIT-SPEC.md](GGOMED-COCKPIT-SPEC.md); qui c'è cosa ESISTE.

## Moduli live (locale, :3500)
- **Editorial** — sito live (GROQ) + DB Notion editoriali, filtri; intake
  patient needs; sezione "Impact review dovute" (verdetti PIF impact).
- **PIF Tick** — griglia normalizzata a 5 criteri sui DUE progetti Sanity.
- **La Casa di Ernesto** — runner conversazionale (proposta→approvazione→
  bozze→critici): Family A pagine (parser HTML vendorizzato,
  `create_draft_from_html`), Family B Samantha (caption + righe Calendar
  nuove, sempre Draft). Run persistenti in `.runs/` fino ad archiviazione.
  Contatore costi live. Modelli: Opus 4.8 / Sonnet 5 per-run.
- **Lo Studio di Ambrogio** — read-only (trip-wire no-write in test).

## Gate in CODICE (non solo prompt)
drafts-only su gxyjgvr0 · m05ykm6e sola-lettura (slice PIF) · create bloccate
senza approvazione JJ · critici obbligatori prima di finish · campi PIF
certificazione strappati · Samantha mai Status≠Draft · impact writer solo 3
property · Ambrogio DBs mai scrivibili.

## Fase 3 — stato
- Parity harness: `npm run parity` → **RECONCILED** (specchi riparati).
- Ri-punto ernesto: **ready-but-dark** (pif-tick-lookup, review-due-scan,
  newsletter-scan dietro `COCKPIT_VIEWS_URL`); commit in ernesto NON pushati.
- Pensionamento: `npm run retire:mirrors` pronto (gate: --apply --views-live
  + parity RECONCILED). Content Assets sopravvive come stub (§5.5 A).
- Prossimo passo fisico: [DEPLOY-REMOTE.md](DEPLOY-REMOTE.md).

## Residui Fase 2
Family C video worker · cache-tier proprietario (SEMrush/GA4/JSON-LD webhook)
· Higgsfield MCP connector · migrazione Notion→Sanity stato nativo (Fase 2
del piano originale, deliberata).

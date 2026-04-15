# Roadmap Espansione — GGO-Content-Manager

> Generated: 2026-04-15 | Updated: 2026-04-15 | Prerequisito: ROADMAP-FIX.md (Fasi 0-6) ✅ completato

## Fase A: Autenticazione & write operations

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| A.1 | NextAuth.js con provider Notion OAuth o credentials | Middleware auth su tutte le route API | 2h |
| A.2 | Role-based access: admin (full), editor (read + validate), viewer (read) | Middleware + UI condizionale | 1h |
| A.3 | Write-back: salvare risultati AI validation su Notion | POST `/api/notion/compliance` → `pages.update()` | 1h |
| A.4 | Write-back: aggiornare status review ("Reviewed", "Needs Update") | POST `/api/notion/content` → `pages.update()` | 1h |

---

## Fase B: Analytics funzionante

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| B.1 | Installare Recharts o Chart.js | Dependency | 5 min |
| B.2 | Compliance trend chart — % compliant nel tempo | Dati da compliance timestamps | 2h |
| B.3 | Content coverage heatmap — gap per area clinica | Dati da patient journeys + content. Nota: se Patient Intelligence viene rinominata Patient CRM, aggiornare etichette UI | 2h |
| B.4 | Keyword performance — ranking trend, traffic | Dati da keywords DB (Last SEMrush Update) | 1.5h |
| B.5 | Evidence freshness — distribuzione eta' delle sources | Dati da evidence (Date Published) | 1h |
| B.6 | Review calendar — pagine in scadenza per mese | Dati da content (Review Due) | 1h |

---

## Fase C: Content Requests & Feedback

> ⚠️ **Aggiornato 2026-04-15** — Il Feedback Queue DB esiste già in Notion. Content Requests da valutare se serve DB separato o se Topic Pool copre il caso d'uso.

### C.1–C.3: Content Requests — decisione aperta

**Opzione 1 — DB separato (operativo):** Content Requests come DB distinto con status granulare: Requested → Scoping → Writing → Review → Done. Topic Pool resta strategico (SEO-driven, Added By = Auto/Semrush). Content Requests è operativo (Added By = Manual, team-driven).

**Opzione 2 — Topic Pool unificato:** Usare il Topic Pool per entrambi i flussi. I topic manuali (Added By = Manual) fungono da request. Meno infrastruttura, ma status meno granulare.

**Da decidere prima di implementare.**

Se DB separato:

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| C.1 | Content Requests DB in Notion — schema + setup | Title, Status, Priority, Assignee, Due Date | 30 min |
| C.2 | Kanban board funzionante con drag-and-drop | `@hello-pangea/dnd` o Notion-style board | 3h |
| C.3 | Creare/editare request da UI → Notion write | POST endpoint (richiede Fase A) | 1h |

### C.4–C.5: Feedback Queue — DB già esistente

Il DB esiste: **💬 Patient & Stakeholder Feedback** (`1ddd2f3d906b80508429f04c40108e0b`).
Schema: Feedback ID, Feedback Type (Patient/Expert/Clinician/Public), Feedback Summary, Related Content, Action Status, Action Owner, Action Taken.

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| C.4 | Aggiungere `NOTION_FEEDBACK_DB` env var + schema + mapper | `lib/notion/schema.ts`, `types.ts`, `mappers.ts` | 30 min |
| C.5 | API route `/api/notion/feedback` + wirare pagina esistente | GET + resolve/dismiss actions (richiede Fase A per write) | 1h |

---

## Fase D: Annual Review workflow

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| D.1 | Review checklist per pagina — auto-populated da compliance data | Merge content + compliance + evidence | 2h |
| D.2 | Bulk review: seleziona pagine → segna come "Reviewed" con data | Multi-select + batch write (richiede Fase A) | 1.5h |
| D.3 | Review report export (PDF/CSV) | Generazione lato server | 2h |
| D.4 | Email/Notion reminder per review in scadenza | Scheduled task o Notion automation | 1h |

---

## Fase E: Export funzionante

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| E.1 | CSV export per tutte le tabelle dati | Utility `exportToCSV(data, columns, filename)` | 1h |
| E.2 | PDF report per compliance/validation hub | `@react-pdf/renderer` o server-side con Puppeteer | 3h |
| E.3 | Notion-style share link per dashboard views | URL con query params che preservano filtri | 1h |

---

## Fase F: AI Assistant avanzato

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| F.1 | Fix risposta AI — allineare parsing a formato Gemini reale | `app/api/ai/validate/route.ts` | 30 min |
| F.2 | Batch validation — validare tutte le pagine in sequenza | Loop su content assets, risultati in tabella | 2h |
| F.3 | Evidence gap detector — AI identifica claim senza reference | Prompt Gemini + content body | 1.5h |
| F.4 | Readability rewriter — suggerisce riscrittura a reading age target | Prompt Gemini con tono/livello | 1h |
| F.5 | Salvare risultati AI su Notion (compliance record) | Write-back (richiede Fase A.3) | 1h |

---

## Fase G: Social media integration

> ⚠️ **Aggiornato 2026-04-15** — Il Content Calendar DB esiste già (`NOTION_CONTENT_CALENDAR_DB`). La dipendenza su notion-integration è risolta. Serve solo aggiungere le env var a client.ts e lo schema.

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| G.0 | Aggiungere `NOTION_CONTENT_CALENDAR_DB` + `NOTION_MEDIA_ASSETS_DB` a env, schema, types | `client.ts`, `schema.ts`, `types.ts`, `mappers.ts` | 45 min |
| G.1 | Content calendar view — griglia mese con post pianificati | Legge da Notion content calendar DB | 3h |
| G.2 | Post preview — anteprima social per ogni content asset | Template Instagram/LinkedIn/X | 2h |
| G.3 | Caption generator — AI genera caption da content summary | Prompt Gemini + brand voice | 1h |
| G.4 | Publishing status tracker — draft → scheduled → published | Status workflow in Notion | 1.5h |

---

## Fase H: Media Assets library (nuova)

> Aggiunta 2026-04-15 — Il Media Assets DB esiste (smoke-test Titti). Non era previsto nella roadmap originale.

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| H.1 | Aggiungere `NOTION_MEDIA_ASSETS_DB` a env, schema, types, mapper | Condiviso con G.0 se fatto insieme | 30 min |
| H.2 | Media library page — grid view con preview thumbnail | Filtri per tipo (video/image/document), tagging | 3h |
| H.3 | Asset-content linking — mostrare quali asset sono usati in quali pagine | Relation tracking bidirezionale | 1.5h |
| H.4 | Repurpose tracker — stato di riuso asset cross-platform | Status workflow: Original → Repurposed → Published | 1h |

---

## Content Engine pipeline (futuro, non schedulato)

> Il feedback DB (💬 Patient & Stakeholder Feedback) è ora collegabile al Topic Pool come input: feedback → genera topics. Questa pipeline non è prevista in nessuna fase attuale ma merita una Fase I dedicata quando Content Engine è stabile.

---

## Timeline suggerita

```
Mese 1:   Fase A (auth + write)       → sblocca tutte le fasi successive
Mese 1:   Fase B (analytics)          → valore immediato per dashboard
Mese 2:   Fase E (export)             → quick win, molto richiesto
Mese 2:   Fase F (AI avanzato)        → differenziante
Mese 3:   Fase C (requests/feedback)  → workflow operativo
Mese 3:   Fase D (annual review)      → compliance workflow
Mese 4:   Fase G (social)             → collegamento con Content Manager pipeline
Mese 4:   Fase H (media assets)       → libreria asset
```

## Dipendenze tra fasi

```
Fase A (auth + write) ──→ Fase C.3 (write requests)
                      ──→ Fase C.5 (resolve feedback)
                      ──→ Fase D.2 (bulk review write)
                      ──→ Fase F.5 (save AI results)

Fase B.1 (chart lib) ──→ Fase B.2-B.6 (tutti i chart)

Fase E.1 (CSV) ──→ indipendente
Fase E.2 (PDF) ──→ indipendente

Fase F.1 (fix AI) ──→ Fase F.2-F.5 (AI avanzato)

Fase G.0 (env + schema) ──→ Fase G.1-G.4 (social)
                         ──→ Fase H.1 (condiviso)

Fase G ──→ ✅ Content Calendar DB esiste, nessuna dipendenza esterna
Fase H ──→ ✅ Media Assets DB esiste, nessuna dipendenza esterna
```

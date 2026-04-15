# Roadmap Espansione — GGO-Content-Manager

> Generated: 2026-04-15 | Prerequisito: completare ROADMAP-FIX.md (Fasi 0-6)

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
| B.3 | Content coverage heatmap — gap per area clinica | Dati da patient journeys + content | 2h |
| B.4 | Keyword performance — ranking trend, traffic | Dati da keywords DB (Last SEMrush Update) | 1.5h |
| B.5 | Evidence freshness — distribuzione eta' delle sources | Dati da evidence (Date Published) | 1h |
| B.6 | Review calendar — pagine in scadenza per mese | Dati da content (Review Due) | 1h |

---

## Fase C: Content Requests & Feedback (pagine placeholder → funzionali)

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| C.1 | Content Requests DB in Notion — schema + setup script | Nuova DB con Title, Status, Priority, Assignee, Due Date | 30 min |
| C.2 | Kanban board funzionante con drag-and-drop | `@hello-pangea/dnd` o Notion-style board | 3h |
| C.3 | Creare/editare request da UI → Notion write | POST endpoint | 1h |
| C.4 | Feedback Queue DB in Notion — schema + setup | Nuova DB con Page, Feedback, Source, Status | 30 min |
| C.5 | Feedback list con resolve/dismiss actions | UI + write endpoint | 1.5h |

---

## Fase D: Annual Review workflow

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| D.1 | Review checklist per pagina — auto-populated da compliance data | Merge content + compliance + evidence | 2h |
| D.2 | Bulk review: seleziona pagine → segna come "Reviewed" con data | Multi-select + batch write | 1.5h |
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

## Fase G: Social media integration (collegamento con notion-integration)

| # | Feature | Dettaglio | Effort |
|---|---------|-----------|--------|
| G.1 | Content calendar view — griglia mese con post pianificati | Legge da Notion content calendar DB | 3h |
| G.2 | Post preview — anteprima social per ogni content asset | Template Instagram/LinkedIn/X | 2h |
| G.3 | Caption generator — AI genera caption da content summary | Prompt Gemini + brand voice | 1h |
| G.4 | Publishing status tracker — draft → scheduled → published | Status workflow in Notion | 1.5h |

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
```

## Dipendenze tra fasi

```
Fase A (auth + write) ──→ Fase C.3 (write requests)
                      ──→ Fase D.2 (bulk review write)
                      ──→ Fase F.5 (save AI results)

Fase B.1 (chart lib) ──→ Fase B.2-B.6 (tutti i chart)

Fase E.1 (CSV) ──→ indipendente
Fase E.2 (PDF) ──→ indipendente

Fase F.1 (fix AI) ──→ Fase F.2-F.5 (AI avanzato)

Fase G ──→ richiede Notion content calendar DB (setup in notion-integration)
```

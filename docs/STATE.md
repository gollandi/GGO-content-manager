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

## Ristrutturazione cockpit — 2026-09-02

Analisi avversariale a cinque voci (UI/UX, developer, CCO, Edmondo,
Ernesto): il difetto comune era lo stesso fatto ricalcolato in cinque posti
con cinque filtri diversi (coda decisioni, run notturne, desk), l'Atrio
decorativo e 19 voci di navigazione.

- **`lib/house/state.ts` + `/api/house/state`** — un solo read model per
  ogni numero "cosa aspetta JJ": `awaiting` (formula identica al Cancello),
  `night` (24h, run da guardare, ultima produzione), `week` (calendario
  della settimana per tipo; obiettivo da `COCKPIT_WEEKLY_TARGET`, mai
  inventato), `editorial` (pagine vive/da rivedere, live GROQ), `pif`,
  `runs`, `snapshot`. Test: `__tests__/house-state.test.ts`; guardia
  read-only in `ernesto-read-models`.
- **Atrio** — server component: titolo = decisione, striscia di sei numeri,
  "Ti aspettano" ordinato (sigilli → run rotte → review scadute → stallo),
  stanze a una riga, "Stanotte" con le run fallite e il Giornale ripiegato.
  Via la facciata SVG, i tally doppi e le letture dallo specchio Notion.
- **Sidebar** — 8 stanze + archivio ripiegato (11 pagine, YouTube inclusa);
  contatore dal house state. Helm Pathways → redirect a
  `/pif-tick?source=compass`.
- **Casa di Ernesto** — via "Night shift" e la ri-resa della coda desk
  (vivono in Atrio e Cancello); resta direttive + asset wall.
- **Editorial** — solo diagnosi: sito live, topic pool, bisogni, impact
  review, newsletter. Via le tabelle Calendar e Desk.
- **Portineria** — HousePulse legge il house state, senza la coda decisioni.
- `/api/ernesto/pulse` ritirato (sostituito dal house state).

Non verificato a schermo in questa sessione (login richiesto sul servizio
residente): build, typecheck, lint e test verdi.

## Tre superfici — 2026-09-02 (seconda passata)

Misurato sul Desk vivo: 171 righe "Pending", di cui 93 raccomandazioni, 43
domande, 14 piani, 18 approvazioni di pubblicazione, 3 script di clip. Il
Cancello le mostrava tutte in un registro solo.

- **`lib/house/families.ts`** — una sola dichiarazione: `publish-approval`,
  `clip-script`, `long-video-proposal` sono editoriali; `question`,
  `plan-proposal`, `budget-request`, `recommendation` (e ogni tipo ignoto)
  sono questioni. Il house state conta le due famiglie separatamente.
- **Il Cancello (`/review`)** — solo proposte editoriali: da pubblicare e
  clip, calendario sociale, pagine del sito con patch **o proposte**
  (prima le pagine con sole proposte restavano fuori). Le operazioni della
  patch sono a fronte: testo attuale a sinistra, correzione a destra.
- **Le Questioni (`/questioni`)** — nuova stanza: segnali tecnici (run da
  guardare, run interattive fallite, slot a zero, review PIF scadute,
  snapshot fermo, fonti mute) e la scrivania per tipo, con risposta e
  decisione in riga sulla stessa rotta del Cancello (`target: "desk"`).
  Le proposte di Ambrogio sono contate e rimandate al suo studio.
- **Gli agenti (`/casa-di-ernesto`)** — il Giornale di bordo vive qui
  (`#attivita`); l'Atrio tiene solo le run rotte delle 24 ore e la tabella
  di Ambrogio è sostituita da un rimando.
- Sidebar: Cancello (sigilli) · Le Questioni (con contatore) · Gli agenti ·
  stanze. Atrio: sette numeri, la lista "Ti aspettano" include le questioni.

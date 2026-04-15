# Roadmap Fix — GGO-Content-Manager

> Generated: 2026-04-15 | Baseline: audit completo del repo

## Fase 0: Sicurezza (bloccante)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 0.1 | `npm audit fix` — patch Next.js CSRF + HTTP smuggling + picomatch ReDoS | package-lock.json | 1 min |
| 0.2 | Sanitizzare error responses — `"Failed to fetch data"` invece di `error.message` | 6 route in `app/api/notion/*/route.ts` + `ai/validate` | 15 min |
| 0.3 | Validazione env vars all'avvio — fail-fast se mancano | `lib/notion/client.ts` | 10 min |
| 0.4 | Security headers in `next.config.js` — CSP, X-Frame-Options, HSTS | `next.config.js` | 15 min |

**Commit:** `fix(security): patch CVEs, sanitise errors, add security headers`

---

## Fase 1: Type safety (robustezza)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1.1 | Rimuovere tutti gli `any` dai mapper — tipizzare `getProp`, extractors | `lib/notion/mappers.ts` | 30 min |
| 1.2 | Rimuovere `any` da services — tipizzare `filter`, `response` | `lib/notion/services.ts` | 15 min |
| 1.3 | Rimuovere `any` dai catch blocks — usare `unknown` + type guard | 8 route files | 20 min |
| 1.4 | Rimuovere `@ts-ignore` in services.ts:34 | `lib/notion/services.ts` | 5 min |

**Commit:** `fix(types): remove all 26 any types, proper Notion response typing`

---

## Fase 2: Error handling & UX

| # | Fix | File | Effort |
|---|-----|------|--------|
| 2.1 | Error boundary component globale | `app/error.tsx` (nuovo) | 20 min |
| 2.2 | Loading states per tutte le pagine | `app/*/loading.tsx` (nuovi) | 20 min |
| 2.3 | Hook condiviso `useNotionData(endpoint)` — fetch + loading + error state | `lib/hooks/useNotionData.ts` (nuovo) | 30 min |
| 2.4 | Sostituire fetch manuali in tutte le pagine con `useNotionData` | 8 page files | 40 min |

**Commit:** `refactor(pages): shared data hook, error boundaries, loading states`

---

## Fase 3: Dead code cleanup

| # | Fix | File | Effort |
|---|-----|------|--------|
| 3.1 | Rimuovere bottoni non funzionali (Export, Settings tabs, etc.) o sostituire con `disabled` + tooltip "Coming soon" | 12 page files | 30 min |
| 3.2 | Rimuovere pagine placeholder vuote o marcarle come "In development" | analytics, annual-review, feedback-queue, content-requests | 20 min |
| 3.3 | Rimuovere `console.log`/`console.error` dalle pagine — solo API route | 12 file | 10 min |

**Commit:** `chore: clean dead buttons, mark placeholder pages, remove console logs`

---

## Fase 4: Component extraction (DRY)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 4.1 | Estrarre `<SearchBar />` — usato in 8 pagine | `components/SearchBar.tsx` (nuovo) | 20 min |
| 4.2 | Estrarre `<FilterBar />` — tabs + filtri, usato in 6 pagine | `components/FilterBar.tsx` (nuovo) | 25 min |
| 4.3 | Estrarre `<DataTable />` — tabella con sort, usata in 5 pagine | `components/DataTable.tsx` (nuovo) | 40 min |
| 4.4 | Estrarre `<StatusBadge />` — badge colorati usati ovunque | `components/StatusBadge.tsx` (nuovo) | 10 min |
| 4.5 | Sostituire inline nelle pagine con i nuovi componenti | 8 page files | 1h |

**Commit:** `refactor(components): extract SearchBar, FilterBar, DataTable, StatusBadge`

---

## Fase 5: Testing

| # | Fix | File | Effort |
|---|-----|------|--------|
| 5.1 | Installare Vitest + React Testing Library + happy-dom | package.json | 10 min |
| 5.2 | Test per `lib/notion/mappers.ts` — tutti i 6 mapper | `__tests__/mappers.test.ts` | 45 min |
| 5.3 | Test per `lib/notion/services.ts` — mock Notion client | `__tests__/services.test.ts` | 30 min |
| 5.4 | Test per `lib/cache.ts` — TTL, stale, invalidation | `__tests__/cache.test.ts` | 20 min |
| 5.5 | Test per `useNotionData` hook | `__tests__/useNotionData.test.ts` | 20 min |
| 5.6 | Aggiungere `npm test` a package.json | package.json | 2 min |

**Commit:** `test: add Vitest + tests for mappers, services, cache, hooks`

---

## Fase 6: Linting & formatting

| # | Fix | File | Effort |
|---|-----|------|--------|
| 6.1 | Configurare ESLint con `eslint-config-next` | `.eslintrc.json` | 10 min |
| 6.2 | Configurare Prettier | `.prettierrc` | 5 min |
| 6.3 | Fix lint su tutto il codebase | tutti i file | 15 min |
| 6.4 | Aggiungere lint a pre-commit (optional) | package.json | 10 min |

**Commit:** `chore: add ESLint + Prettier, fix all lint errors`

---

## Timeline suggerita

```
Settimana 1:  Fase 0 + 1         (sicurezza + type safety)
Settimana 2:  Fase 2 + 3         (error handling + cleanup)
Settimana 3:  Fase 4             (component extraction)
Settimana 4:  Fase 5 + 6         (testing + linting)
```

# GGO Med Content Manager — Code Review & Roadmap

**Date:** 2026-03-29
**Scope:** Security, Design, UI/UX, Code Quality, Friction Points

---

## Project Overview

A medical content management and compliance tracking platform built with **Next.js 16.1.6**, **TypeScript**, **Tailwind CSS**, and **Notion as the backend database**. Manages PIF Tick compliance, evidence tracking, patient journeys, SEO keywords, and schema validation for healthcare content. ~4,200 LOC across 29 source files, 12 pages, 6 API routes.

---

## 1. Security & Safety

### Critical

| Issue | Location | Detail |
|-------|----------|--------|
| **No authentication/authorization** | All `/app/api/notion/*` routes | Every endpoint is publicly accessible. No middleware, no session checks, no RBAC. |
| **Error messages leak internals** | All 6 API `route.ts` files, line ~10 | `error.message` returned directly to client, potentially exposing Notion API keys, DB IDs, and query details. |
| **Dependency CVEs** | `package.json` | Next.js 16.x has known vulnerabilities (CSRF bypass via null origin, HTTP request smuggling, DoS via unbounded buffering). Picomatch has ReDoS and method injection issues. |

### High

| Issue | Location | Detail |
|-------|----------|--------|
| **No security headers** | `next.config.js` | Missing CSP, X-Frame-Options, X-Content-Type-Options. No CORS configuration on API routes. |
| **No rate limiting** | All API routes | Endpoints can be hammered without throttling. |
| **No CSRF protection** | App-wide | No token validation for state-modifying operations. |
| **Unsafe `any` casting in error handlers** | `lib/notion/services.ts:8`, all route files | `catch (error: any)` with `@ts-ignore` bypasses type safety. |

### Medium

| Issue | Location | Detail |
|-------|----------|--------|
| **Weak env var validation** | `lib/notion/client.ts:3-10`, `schema.ts` | DB IDs use non-null assertion `!` with no startup validation. |
| **No URL validation** | `evidence-repository/page.tsx:170` | URLs from Notion rendered as links without protocol/format validation. |
| **No response schema validation** | All page `useEffect` blocks | `Array.isArray()` is the only check — no runtime validation of API response shapes. |

---

## 2. Design & Architecture

### Strengths

- Clean layered architecture: Pages → API Routes → Services → Mappers → Types
- Well-designed Notion abstraction with `SCHEMA` config, generic `fetchAll<T>()`, typed mappers
- Feature-based folder structure with co-located CSS modules
- TypeScript strict mode with comprehensive type definitions (6 data models, 130+ typed properties)

### Issues

| Issue | Detail |
|-------|--------|
| **Monolithic page components** | Pages are 245–439 lines with no sub-component extraction |
| **Heavy code duplication** | Fetch-load-filter pattern copy-pasted across 8 pages |
| **No custom hooks** | Each page re-implements fetch, filtering, and search independently |
| **No shared utilities** | No `utils/` directory for formatters, helpers, or constants |
| **Boilerplate API routes** | All 6 routes are ~12 lines of nearly identical code |
| **No caching strategy** | Every page visit re-fetches all data from Notion |

---

## 3. UI & UX

### Strengths

- Professional design system with 70+ CSS tokens, brand colors, gradients, glass morphism
- Responsive across all breakpoints (mobile sidebar becomes horizontal scroll)
- Consistent component classes (`.card`, `.btn-pill`, `.btn-gradient`, `.table`)
- Icon library with 30+ SVG components

### Issues

| Issue | Detail |
|-------|--------|
| **Many non-functional buttons** | Export, Refresh, Run Validation, Settings tabs have no handlers |
| **No toast/notification system** | No user feedback for actions, errors, or successes |
| **No error UI** | Errors are `console.error` only — users see infinite loading or empty states |
| **Basic loading states** | Text "Loading..." instead of skeleton screens |
| **No form validation** | Assistant page has inputs with no validation or submission logic |
| **Analytics charts are empty divs** | Placeholder containers with no chart library |
| **Settings is a static skeleton** | No functional tab switching or configuration |
| **Dark mode CSS exists but no toggle** | `.dark` variant rules defined but no UI control |
| **Limited accessibility** | Minimal ARIA labels, no keyboard navigation, no focus management |

---

## 4. Code Quality & Structure

| Aspect | Score | Notes |
|--------|-------|-------|
| Naming conventions | 9/10 | Consistent PascalCase/camelCase |
| File organization | 8/10 | Clean feature-based structure |
| Type safety | 7/10 | Good definitions, undermined by `any` in mappers |
| State management | 7/10 | Appropriate for current scope |
| Code duplication | 5/10 | 8 identical fetch patterns |
| Component granularity | 4/10 | Pages are monolithic |
| Error handling | 3/10 | Silent failures, no boundaries |
| Testing | 0/10 | Zero tests, no test framework |
| Linting/formatting | 0/10 | ESLint not configured |

---

## 5. Friction Points

| Friction | Impact |
|----------|--------|
| **Notion as sole database** | Every page load hits Notion API. No caching, rate-limited by Notion. |
| **Read-only app** | No write operations. Users must switch to Notion to edit content. |
| **No cross-entity search** | Each page has its own search, no global search. |
| **No data relationships in UI** | Content → Evidence → Compliance links aren't surfaced. |
| **Manual compliance tracking** | PIF validation is display-only. No workflow for marking items compliant. |
| **No export functionality** | Export buttons exist but do nothing. |
| **Assistant page is a shell** | AI form has no backend integration. |

---

## 6. Roadmap

### Phase 1: Foundation & Safety (Weeks 1–2)

- [ ] Add authentication (NextAuth.js or Clerk) with RBAC
- [ ] Fix error exposure — generic messages to clients, detailed logs server-side
- [ ] Add security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- [ ] Run `npm audit fix` — patch known CVEs
- [ ] Configure ESLint + Prettier
- [ ] Add env var validation — fail fast at startup
- [ ] Set up Jest + React Testing Library, write initial tests for mappers and API routes

### Phase 2: Architecture & DX (Weeks 3–4)

- [ ] Create `useNotionData(endpoint)` hook to eliminate duplicated fetch pattern
- [ ] Extract shared components (StatCard, DataTable, DetailPanel, StatusBadge, FilterBar)
- [ ] Add SWR or React Query for client-side caching
- [ ] API route factory/middleware for shared error handling and rate limiting
- [ ] Add toast/notification system
- [ ] Add error boundaries with retry UI
- [ ] Replace loading text with skeleton screens
- [ ] Replace all `any` types in mappers.ts and services.ts

### Phase 3: Core Features (Weeks 5–8)

- [ ] Write operations to Notion (create/update content, compliance items)
- [ ] Compliance workflow (mark pass/fail, assign reviewers, send reminders)
- [ ] Cross-entity relationships (content detail → linked evidence, compliance, keywords)
- [ ] Global search across all entities
- [ ] Export to CSV/PDF
- [ ] Analytics charts (Chart.js or Recharts)
- [ ] Functional settings page

### Phase 4: Enhanced UX (Weeks 9–12)

- [ ] Dark mode toggle with system preference detection
- [ ] AI Assistant integration with LLM API
- [ ] Content request Kanban with drag-and-drop
- [ ] Annual review workflow (scheduling, reminders, completion tracking)
- [ ] Accessibility audit (keyboard nav, ARIA, focus management, screen readers)
- [ ] Feedback queue workflow (assign, respond, resolve)

### Phase 5: Scale & Polish (Weeks 13+)

- [ ] Caching layer (Redis or Next.js ISR)
- [ ] Real-time updates via Notion webhooks
- [ ] Role-based views (editor, reviewer, admin dashboards)
- [ ] Audit logging
- [ ] Performance optimization (code splitting, lazy loading, virtual scrolling)
- [ ] E2E tests (Playwright or Cypress)
- [ ] i18n support
- [ ] PWA or mobile app if needed

---

## Summary

The app has a **solid visual foundation** and **clean architecture** but is currently a **read-only display layer** over Notion with **no authentication, no tests, and no write operations**. The highest-impact next steps are:

1. **Secure the API endpoints** (authentication + error sanitization)
2. **Eliminate duplication** (shared hooks and components)
3. **Build write operations** to make it a complete content management tool

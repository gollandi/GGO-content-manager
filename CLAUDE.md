# CLAUDE.md — GGO Med Content Manager

## Project Summary

Medical content management and compliance tracking platform for GGOmed. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Notion as the backend database. Tracks PIF Tick compliance, evidence sources, patient journeys, SEO keywords, and schema.org validation across healthcare content.

## Tech Stack

- **Framework:** Next.js 16.x (App Router, `"use client"` pages)
- **Language:** TypeScript 5.4 (strict mode)
- **Styling:** Tailwind CSS 4.2 + CSS Modules (hybrid)
- **Backend:** Notion API via `@notionhq/client` — no traditional database
- **Font:** Plus Jakarta Sans (Google Fonts)

## Architecture

```
Pages (app/*/page.tsx) → fetch("/api/notion/*")
  → API Routes (app/api/notion/*/route.ts)
    → Services (lib/notion/services.ts)
      → Mappers (lib/notion/mappers.ts)
        → Notion SDK (lib/notion/client.ts)
```

- All data comes from 6 Notion databases (Content, PIF Compliance, Evidence, Keywords, Patient Journeys, Schema Validation)
- API routes are server-side only; pages use `"use client"` with `useEffect` + `fetch`
- Types defined in `lib/notion/types.ts`, property mappings in `lib/notion/schema.ts`

## Key Directories

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and API routes |
| `app/api/notion/` | 6 REST endpoints (content, compliance, evidence, keywords, patient-journeys, validation) |
| `lib/notion/` | Notion integration: client, services, mappers, schema, types |
| `components/` | Shared components: AppShell, Sidebar, Icons |
| `public/` | Static assets |

## Environment Variables (required)

```
NOTION_API_KEY
NOTION_CONTENT_ASSETS_DB
NOTION_PIF_TICK_COMPLIANCE_DB
NOTION_EVIDENCE_SOURCES_DB
NOTION_KEYWORDS_DB
NOTION_PATIENT_JOURNEYS_DB
NOTION_SCHEMA_VALIDATION_DB
```

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint (not yet configured)
```

## Notion Database Schemas

Property name mappings live in `lib/notion/schema.ts` — always reference SCHEMA constants when adding new fields. The 6 databases are:

1. **ContentMaster** — Medical content assets (conditions, procedures, treatments, tests)
2. **PifValidation** — PIF Tick compliance checklists
3. **Evidence** — Research papers, guidelines, official sources
4. **SchemaValidation** — Schema.org JSON-LD validation
5. **Keywords** — SEO keyword tracking (Semrush integration)
6. **PatientJourneys** — Patient language and journey stage mapping

## Data Types

All TypeScript interfaces are in `lib/notion/types.ts`:
- `ContentItem`, `PifValidationItem`, `EvidenceItem`, `KeywordItem`, `PatientJourneyItem`, `SchemaValidationItem`

## Design System

- Brand colors defined as CSS variables in `app/globals.css` (--ggo-purple, --ggo-teal, --mint, etc.)
- Global utility classes: `.card`, `.btn-pill`, `.btn-gradient`, `.table`, `.status-badge`
- CSS Modules for page-specific styles (co-located as `page.module.css`)
- Responsive breakpoints: `max-md`, `max-lg`, `max-xl`

## Coding Conventions

- PascalCase for components, camelCase for functions/variables
- Pages are `"use client"` with `useState`/`useEffect` for data fetching
- API routes export `async function GET()` returning `NextResponse.json()`
- Notion property extraction goes through mapper functions in `lib/notion/mappers.ts`
- Keep Notion schema property names in `lib/notion/schema.ts` — never hardcode them in components

## Known Limitations

- No authentication — all API endpoints are public
- Read-only — no write operations to Notion yet
- No test suite — zero tests, no test framework installed
- No ESLint/Prettier config
- No caching — every page load fetches from Notion
- Several UI buttons are non-functional (Export, Settings tabs, AI Assistant)
- Analytics charts are placeholder containers

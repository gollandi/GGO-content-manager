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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **GGO-content-manager** (1839 symbols, 3845 relationships, 147 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/GGO-content-manager/context` | Codebase overview, check index freshness |
| `gitnexus://repo/GGO-content-manager/clusters` | All functional areas |
| `gitnexus://repo/GGO-content-manager/processes` | All execution flows |
| `gitnexus://repo/GGO-content-manager/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

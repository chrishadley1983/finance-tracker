# Finance Tracker - CLAUDE.md

## Project Overview

Personal finance application replacing "Life Planning V2" spreadsheet. Transaction tracking, budgeting, wealth monitoring, and FIRE projections.

**Tech Stack:** Next.js 14 (App Router), Supabase, TypeScript, Tailwind CSS v4, Vitest

**Current Phase:** Phase 3 - HSBC Integration

---

## Critical Rules

1. **ALWAYS execute the Standard Boot Sequence** before any agent work - see `docs/agents/config/boot-sequence.md`
2. **NEVER claim work is complete** without updating the agent's `state.json`
3. **ONLY Test Execution Agent** may write to `docs/agents/truth/feature-status.json`
4. **Use PowerShell syntax** - this is a Windows development environment
5. **Check for unmerged branches** before starting work: `git branch -a --no-merged main`

---

## Agent Commands

| Command | Purpose | Type |
|---------|---------|------|
| `/test-plan` | Analyse codebase for test coverage gaps | Initializer |
| `/test-build` | Generate test files to fill gaps | Actor |
| `/test-execute` | Run tests, update truth file | Actor |
| `/code-review` | Review code against standards | Initializer |
| `/merge-feature` | Safe branch merge with verification | Actor |

---

## Directory Structure

```
Finance-Tracker/
├── .claude/commands/        # Agent slash commands
├── app/                     # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── accounts/
│   │   ├── budgets/
│   │   ├── categories/
│   │   ├── fire-parameters/
│   │   ├── transactions/
│   │   │   ├── summary/
│   │   │   ├── by-category/
│   │   │   └── monthly-trend/
│   │   └── wealth-snapshots/
│   ├── transactions/        # Transaction list page
│   └── page.tsx             # Dashboard
├── components/
│   ├── layout/              # Sidebar, Header
│   ├── dashboard/           # SummaryCards, RecentTransactions, etc.
│   └── transactions/        # TransactionTable, Filters, Pagination
├── lib/
│   ├── hooks/               # useTransactions, useDashboardData
│   ├── supabase/            # Database client
│   └── validations/         # Zod schemas
├── docs/
│   ├── agents/
│   │   ├── config/          # boot-sequence.md, file-feature-map.json
│   │   ├── truth/           # feature-status.json (THE source of truth)
│   │   └── [agent-name]/    # state.json per agent
│   └── knowledge/           # Project documentation
├── scripts/                 # Import scripts
├── tests/
│   ├── unit/
│   ├── api/
│   └── e2e/
└── Docs/                    # PRD and specifications
```

---

## Development Workflow

### During Development
```
1. Write code on feature branch
2. /code-review staged        → Review before commit
3. Commit changes
4. /test-execute quick        → Fast validation
5. Repeat until feature complete
```

### Before Merge
```
1. /test-execute pre-merge    → Full test suite
2. /code-review branch        → Complete review
3. /merge-feature <branch>    → Safe merge
```

### Adding Test Coverage
```
1. /test-plan analyze         → Identify gaps
2. /test-build critical       → Generate critical tests
3. /test-execute quick        → Verify tests pass
```

---

## Key Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| PRD | `Docs/personal-finance-prd.md` | Requirements, phases, schema |
| Agent Spec | `Docs/agent-infrastructure-spec.md` | Full framework documentation |
| Boot Sequence | `docs/agents/config/boot-sequence.md` | Required startup procedure |
| Feature Truth | `docs/agents/truth/feature-status.json` | Test status source of truth |

---

## Current Focus

**Phase 3: HSBC Integration**

- [ ] HSBC Open Banking auth flow
- [ ] Account linking & storage
- [ ] Transaction sync service
- [ ] Duplicate detection (imported vs synced)

**Completed Phases:**

<details>
<summary>Phase 2: Core UI ✅</summary>

- [x] Layout structure (Sidebar, Header)
- [x] Transaction list with filtering, sorting, pagination
- [x] Dashboard with summary cards
- [x] Recent transactions widget
- [x] Spending by category chart
- [x] Monthly trend chart
- [x] Dashboard API routes (summary, by-category, monthly-trend)

</details>

<details>
<summary>Phase 1: Data Layer ✅</summary>

- [x] Set up Supabase project and connection
- [x] Create database schema (7 tables, enums, indexes, triggers)
- [x] Generate TypeScript types from schema
- [x] Implement Row Level Security (RLS) policies
- [x] Create API routes for CRUD operations (7 endpoints)
- [x] Add Zod validation schemas
- [x] Write tests for data layer (131 tests)
- [x] Import spreadsheet data (6,848 transactions)

</details>

<details>
<summary>Phase 0: Agent Infrastructure Validation ✅</summary>

- [x] Project scaffold created
- [x] Agent directory structure in place
- [x] State files created for all 5 agents
- [x] Truth file initialised
- [x] Skeleton app (health endpoint, Button component)
- [x] Validate `/test-plan analyze` works
- [x] Validate `/test-build critical` generates tests
- [x] Validate `/test-execute quick` runs tests and updates truth
- [x] Validate `/code-review staged` produces report
- [x] Validate `/merge-feature` completes full cycle

</details>

---

## Patterns

### API Routes
- Always wrap database operations in try/catch
- Use Zod for input validation
- Return consistent response shapes
- Include proper HTTP status codes

### Components
- TypeScript interfaces for all props
- Handle loading, error, and empty states
- Use Tailwind for styling

### Testing
- Unit tests in `tests/unit/`
- API tests in `tests/api/`
- E2E tests in `tests/e2e/`
- Run with: `npm test` (Vitest) or `npx playwright test` (E2E)

---

## Supabase Connection

```
Project URL: https://vkezoyhjoufvsjopjbrr.supabase.co
Project Ref: vkezoyhjoufvsjopjbrr
```

**Environment Variables** (in `.env.local` - DO NOT COMMIT):
```
NEXT_PUBLIC_SUPABASE_URL=https://vkezoyhjoufvsjopjbrr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local>
SUPABASE_SERVICE_ROLE_KEY=<see .env.local>
```

**Client Files:**
- `lib/supabase/client.ts` - Browser client (uses anon key)
- `lib/supabase/server.ts` - Server client (uses service role key)

---

## Quick Commands

```powershell
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build
npm run lint                   # Run ESLint

# Testing
npm test                       # Run Vitest
npx playwright test            # Run E2E tests

# Git
git status                     # Check working tree
git branch -a --no-merged main # Check unmerged branches

# Supabase
npx supabase start             # Start local Supabase
npx supabase db reset          # Reset database with migrations
npx supabase gen types         # Generate TypeScript types
```

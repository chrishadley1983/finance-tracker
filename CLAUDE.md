# Finance Tracker

Personal finance app replacing "Life Planning V2" spreadsheet. Transaction tracking, budgeting, wealth monitoring, FIRE projections.

**Tech Stack:** Next.js 14 (App Router), Supabase, TypeScript, Tailwind CSS v4, Vitest

---

## Critical Rules

1. **ALWAYS execute the Standard Boot Sequence** before any agent work — see `docs/agents/config/boot-sequence.md`
2. **NEVER claim work is complete** without updating the agent's `state.json`
3. **ONLY the Test Agent (execute mode)** may write to `docs/agents/truth/feature-status.json`
4. **Use PowerShell syntax** — this is a Windows development environment
5. **Check for unmerged branches** before starting work: `git branch -a --no-merged main`

---

## Supabase Connection

**CONSOLIDATED DATABASE** — uses the `finance` schema in the Inventory Management App project.

- **Project URL:** `https://modjoikyuhqzouxvieua.supabase.co`
- **Project Ref:** `modjoikyuhqzouxvieua`
- **Schema:** `finance`
- Clients configured in `lib/supabase/client.ts` and `lib/supabase/server.ts`

---

## Agent Commands

| Command | Purpose |
|---------|---------|
| `/define-done` | Define binary success criteria before building |
| `/feature-spec` | Transform criteria into implementation plan (optional) |
| `/build-feature` | Autonomous build-verify loop until criteria converge |
| `/verify-done` | Adversarial verification against done criteria |
| `/fix` | Isolated bug fix track (approval-gated) |
| `/test` | Test planning, generation, and execution |
| `/code-review` | Review code against standards |
| `/merge-feature` | Safe branch merge with Vercel deploy verification |
| `/performance` | Performance analysis and auditing |
| `/docs` | Functional documentation generation |

### Workflows

**Feature track:**
```
/define-done → /feature-spec (optional) → /build-feature → /test pre-merge → /code-review branch → /merge-feature
```

**Fix track:**
```
/fix → /code-review branch → /merge-feature
```

**During dev:** `/test quick` → `/code-review staged` → commit
**Coverage gaps:** `/test plan analyze` → `/test build critical` → `/test quick`

---

## Directory Structure

```
Finance-Tracker/
├── .claude/commands/        # Agent slash commands
├── app/                     # Next.js App Router
│   ├── api/                 # API routes (accounts, budgets, categories,
│   │                        #   fire-parameters, transactions, wealth-snapshots)
│   ├── transactions/        # Transaction list page
│   └── page.tsx             # Dashboard
├── components/
│   ├── layout/              # Sidebar, Header
│   ├── dashboard/           # SummaryCards, RecentTransactions, etc.
│   └── transactions/        # TransactionTable, Filters, Pagination
├── lib/
│   ├── hooks/               # useTransactions, useDashboardData
│   ├── supabase/            # Database client (finance schema)
│   └── validations/         # Zod schemas
├── docs/
│   ├── agents/              # Agent specs, state, config
│   │   ├── config/          # boot-sequence.md, file-feature-map.json
│   │   ├── truth/           # feature-status.json (THE source of truth)
│   │   └── merge-feature/   # Vercel config, critical paths, last deploy
│   ├── features/            # Done criteria, specs, build state per feature
│   ├── fixes/               # Fix reports
│   ├── merges/              # Merge reports
│   ├── functional/          # Generated functional documentation
│   └── knowledge/           # Project documentation
├── tests/
│   ├── unit/
│   ├── api/
│   └── e2e/
└── Docs/                    # PRD and specifications
```

---

## Key Documentation

| Document | Location |
|----------|----------|
| PRD | `Docs/personal-finance-prd.md` |
| Agent Spec | `Docs/agent-infrastructure-spec.md` |
| Boot Sequence | `docs/agents/config/boot-sequence.md` |
| Feature Truth | `docs/agents/truth/feature-status.json` |

---

## Patterns

### API Routes
- Wrap database ops in try/catch
- Validate inputs with Zod
- Consistent response shapes, proper HTTP status codes

### Components
- TypeScript interfaces for all props
- Handle loading, error, and empty states
- Tailwind for styling

---

## Quick Commands

```powershell
npm run dev                    # Start dev server
npm run build                  # Production build
npm run lint                   # ESLint
npm test                       # Run Vitest
npx playwright test            # Run E2E tests
git branch -a --no-merged main # Check unmerged branches
```

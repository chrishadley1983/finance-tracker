# Functional Documentation Command

You are now operating as the **Functional Documentation Agent**. Follow the comprehensive instructions in `docs/agents/functional-docs/spec.md`.

## Quick Reference

### Usage
```
/docs <mode> [target]
```

### Available Modes

| Mode | Command | Description |
|------|---------|-------------|
| **discover** | `/docs discover` | Scan codebase, identify features, show coverage dashboard |
| **document** | `/docs document <target>` | Generate documentation for a feature/journey |
| **update** | `/docs update [target]` | Incremental update based on code changes |
| **status** | `/docs status` | Show current documentation coverage |
| **inspect** | `/docs inspect <page>` | UI inspection only (screenshots + interactions) |

### Examples
```powershell
/docs discover                    # Full codebase scan, priority list
/docs document transactions       # Document transactions feature area
/docs document adding-transaction # Document specific user journey
/docs document all                # Document everything (use with caution)
/docs update                      # Check all, update stale docs
/docs update budgets              # Force update budget documentation
/docs status                      # Show coverage dashboard
/docs inspect /transactions       # Capture UI for transactions page
```

## Standard Boot Sequence

**MANDATORY: Execute before any work.**

### 1. Check Lock
- If locked and fresh (< 1 hour) -> ABORT
- If locked and stale (> 1 hour) -> WARN, offer to clear
- If unlocked -> Create lock, proceed

### 2. Read State
- Load previous progress, coverage metrics, documented files
- If missing -> First run flow
- If corrupted -> Recovery flow

### 3. Check Recovery
- If exists -> Previous run crashed, offer to resume or start fresh

### 4. Detect Changes
- Compare source file timestamps vs last documentation run
- Identify stale documentation that needs updating

### 5. Check Prerequisites
- **For UI inspection modes:** Verify app running at localhost:3000
- **For all modes:** Verify write access to docs/functional/

### 6. Execute Mode
- Run the requested mode
- Process queue atomically (one item at a time)
- Update state after each unit of work

### 7. Clean Up (Always)
- Update state with final metrics
- Clear inProgress queue item
- Remove lock file
- Clear or update recovery.json

## Discovery Mode

Scans these locations:

| Location | What to Find |
|----------|--------------|
| `app/` | Pages and routes |
| `app/api/` | API endpoints |
| `lib/` | Business logic and utilities |
| `lib/hooks/` | Custom React hooks |
| `components/` | UI components |

### Discovery Output

1. **Priority-ranked feature list** with complexity scores
2. **Coverage dashboard** showing progress toward 100%
3. **User journey mapping** from routes and UI flows

**Waits for approval before proceeding to documentation.**

## Document Mode

For each feature area, generates:

| Output | Content |
|--------|---------|
| `overview.md` | Feature purpose, capabilities, journeys |
| `{journey}.md` | Step-by-step user flow with screenshots |
| `screenshots/{feature}/` | UI captures for each state |

### Documentation Process

1. **Analyse code** - Extract business logic, data flows
2. **Inspect UI** - Navigate pages, capture screenshots
3. **Generate docs** - Use templates, link to sources
4. **Update index** - Add to main documentation index
5. **Update state** - Mark as documented, update coverage

## Atomic Progress

**Critical:** Document ONE journey, update state, then next.

```
Document Journey A -> Update state (A complete) -> Document Journey B -> Update state
```

Never:
```
Document A, B, C, D -> Update state (all complete)  -- Risk of lost progress
```

## Output Locations

| Type | Location |
|------|----------|
| Feature docs | `docs/functional/{feature}/overview.md` |
| Journey docs | `docs/functional/{feature}/{journey}.md` |
| Screenshots | `docs/functional/screenshots/{feature}/` |
| Main index | `docs/functional/index.md` |
| Agent state | `docs/agents/functional-docs/state.json` |
| Templates | `docs/agents/functional-docs/templates/` |

## Finance Tracker Feature Areas

Known feature areas to discover and document:

| Area | Key Files | Complexity |
|------|-----------|------------|
| Transaction Management | app/transactions/, app/api/transactions/ | High |
| Budget Tracking | app/api/budgets/ | Medium |
| Wealth Monitoring | app/api/wealth-snapshots/ | Medium |
| FIRE Calculator | lib/fire/, components/dashboard/ | High |
| AI Categorisation | app/api/ai-categoriser/, app/api/ai-suggest/ | Medium |
| PDF Import | app/api/upload-pdf/ | Medium |
| Monthly Reports | app/api/monthly-reports/, app/reports/ | Medium |
| Dashboard | app/page.tsx, components/dashboard/ | Medium |
| Accounts | app/api/accounts/ | Low |
| Categories | app/api/categories/ | Low |

## Downstream Usage

| Consumer | How They Use Docs |
|----------|-------------------|
| **You (Developer)** | Understand forgotten business logic |
| **You (User)** | Remember what features exist |
| **Build Feature Agent** | Reference existing patterns |
| **Test Plan Agent** | Derive test scenarios |

ARGUMENTS: <mode> [target]

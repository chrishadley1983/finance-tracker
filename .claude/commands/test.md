# Test Command

You are now operating as the **Test Agent** — a senior QA engineer handling test planning, generation, and execution. Follow the comprehensive instructions in `docs/testing/test-agent.md`.

## Quick Reference

### Usage
```
/test <action> [mode]
```

### Actions

**Run tests** (default — no action keyword needed):

| Mode | Description | Duration |
|------|-------------|----------|
| `quick` | Critical unit tests only | ~1 min |
| `unit` | All unit tests | ~2 min |
| `api` | All API tests | ~3 min |
| `integration` | API + integration tests | ~5 min |
| `e2e` | All E2E browser tests | ~10 min |
| `regression` | Unit + API + integration | ~10 min |
| `complete` | All test types | ~15 min |
| `pre-merge` | Regression + critical E2E | ~10 min |
| `feature:<n>` | Tests for specific feature | Varies |

**Plan tests** (`plan` action):

| Mode | Description |
|------|-------------|
| `plan analyze` | Full gap analysis |
| `plan coverage` | Coverage report only |
| `plan feature:<n>` | Analyse specific feature |
| `plan generate-manifest <mode>` | Create test manifest |

**Build tests** (`build` action):

| Mode | Description |
|------|-------------|
| `build critical` | Build tests for CRITICAL priority gaps |
| `build high` | Build tests for HIGH priority gaps |
| `build medium` | Build tests for MEDIUM priority gaps |
| `build feature:<n>` | Build tests for specific feature |
| `build type:<type>` | Build specific test type (unit/api/e2e) |
| `build all` | Build all missing tests |
| `build fix-mocks` | Fix mock infrastructure issues |

### Examples
```powershell
/test quick                    # Fast check during development
/test pre-merge                # Full validation before merge
/test feature:transactions     # Run transaction tests

/test plan analyze             # Full gap analysis
/test plan coverage            # Quick coverage check

/test build critical           # Build tests for critical gaps
/test build feature:budgets    # Build budget tests
```

### Standard Workflow

1. **During development:** `/test quick`
2. **Before committing:** `/test unit`
3. **Before merging:** `/test pre-merge`
4. **Find coverage gaps:** `/test plan analyze`
5. **Generate missing tests:** `/test build critical`

### Output Files

| Type | Location |
|------|----------|
| Coverage Report | `docs/testing/analysis/coverage-report-{date}.md` |
| Test Manifest | `docs/testing/registry/test-manifest-{date}.json` |
| Execution Report | `docs/testing/execution-history/test-run-{timestamp}.md` |
| Execution History | `docs/testing/execution-history/history.json` |

### Coverage Targets

| Priority | Target |
|----------|--------|
| Critical | 85% |
| High | 75% |
| Medium | 70% |
| Overall | 80% |

### Execution Details

#### Run (Execute)

1. Determine scope from mode
2. Run: `npx vitest run tests/unit/`, `tests/api/`, `npx playwright test tests/e2e/`
3. Collect pass/fail results
4. **Update truth file** (`docs/agents/truth/feature-status.json`) — ONLY this agent writes to it
5. Generate summary report

#### Plan

1. Scan `app/api/`, `components/`, `lib/` for source files
2. Compare against `tests/api/`, `tests/unit/`, `tests/e2e/`
3. Classify gaps: CRITICAL, HIGH, MEDIUM, LOW
4. Output to `docs/testing/analysis/coverage-analysis.md`

#### Build

1. Read `docs/testing/analysis/coverage-analysis.md`
2. Filter gaps by mode
3. Generate test files following project conventions
4. Validate: `npx tsc --noEmit && npm run lint`

ARGUMENTS: <action> [mode]

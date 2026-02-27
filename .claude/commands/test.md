# Test Command

You are the **Test Agent** — handles test planning, generation, and execution.

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Usage
```
/test <action> [mode]
```

## Actions

**Run tests** (default — no action keyword needed):

| Mode | Description |
|------|-------------|
| `quick` | Changed files only (fast validation) |
| `full` | Run all tests |
| `pre-merge` | Full suite, fail on any error |
| `feature:<name>` | Tests for specific feature |

**Plan tests** (`plan` action):

| Mode | Description |
|------|-------------|
| `plan analyze` | Full gap analysis |
| `plan validate` | Check existing tests still valid |
| `plan generate-manifest` | Create test manifest |

**Build tests** (`build` action):

| Mode | Description |
|------|-------------|
| `build critical` | Build CRITICAL priority tests |
| `build high` | Build HIGH priority tests |
| `build feature:<name>` | Build tests for specific feature |
| `build all` | Build all missing tests |

## Examples
```powershell
/test quick                    # Fast check during development
/test pre-merge                # Full validation before merge
/test plan analyze             # Find coverage gaps
/test build critical           # Generate tests for critical gaps
```

## Execution Details

### Run (Execute)

1. Boot sequence
2. Determine scope from mode
3. Run: `npx vitest run tests/unit/`, `tests/api/`, `npx playwright test tests/e2e/`
4. Collect pass/fail results
5. **Update truth file** (`docs/agents/truth/feature-status.json`) — ONLY this agent writes to it
6. Generate summary report
7. Update `docs/agents/test-execute/state.json`

### Plan

1. Boot sequence
2. Scan `app/api/`, `components/`, `lib/` for source files
3. Compare against `tests/api/`, `tests/unit/`, `tests/e2e/`
4. Classify gaps: CRITICAL, HIGH, MEDIUM, LOW
5. Output to `docs/testing/analysis/coverage-analysis.md`
6. Update `docs/agents/test-plan/state.json`

### Build

1. Boot sequence
2. Read `docs/testing/analysis/coverage-analysis.md`
3. Filter gaps by mode
4. Generate test files following project conventions
5. Validate: `npx tsc --noEmit && npm run lint`
6. Update `docs/agents/test-build/state.json`

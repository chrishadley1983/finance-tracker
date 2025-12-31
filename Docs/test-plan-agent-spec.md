# Test Plan Agent Specification

**Version:** 1.0  
**Type:** Initializer (Stage Manager)  
**Command:** `/test-plan <mode>`

---

## Overview

The Test Plan Agent analyses the codebase to identify test coverage gaps and produces a prioritised backlog for the Test Build Agent. As an Initializer agent, it sets the stage but does not write code.

---

## Modes

| Mode | Description |
|------|-------------|
| `analyze` | Full codebase analysis, produce coverage-analysis.md |
| `validate-regression` | Check if existing tests still cover their targets |
| `generate-manifest` | Create test manifest for CI/CD integration |
| `feature:<name>` | Analyse specific feature only |

---

## Standard Boot Sequence

**MANDATORY: Execute before any work.**

### Phase 0: Read Core Context
```bash
cat CLAUDE.md
```
Extract: Project rules, current focus, critical patterns.

### Phase 1: Read Agent State
```bash
cat docs/agents/test-plan/state.json
```
Extract: lastRun, lastCommit, completedWork, blockers.

### Phase 2: Detect Changes Since Last Run
```bash
# Get commits since last run
git log <lastCommit>..HEAD --oneline

# Get changed files
git diff --name-only <lastCommit>..HEAD
```

### Phase 3: Check for Invalidations
1. Read `docs/agents/config/file-feature-map.json`
2. Identify features affected by changed files
3. Mark related completed analysis as "invalidated"

### Phase 4: Read Feature Truth
```bash
cat docs/agents/truth/feature-status.json
```
Merge with invalidations to determine what needs re-analysis.

### Phase 5: Report Boot Status
```markdown
## Test Plan Agent - Boot Complete

**Last run:** X days ago (<date>)
**Commits since:** N
**Files changed:** N

**Invalidations:**
- <list any invalidated work>

**Proceeding with mode:** <mode>
```

### Phase 6: Proceed or Wait
- If blockers exist → Report and stop
- If human decision needed → Ask
- Otherwise → Proceed with analysis

---

## Execution: `analyze` Mode

### Step 1: Scan Codebase Structure

Identify all testable code:
```bash
# API routes
find app/api -name "route.ts" -o -name "route.tsx"

# Components
find components -name "*.tsx" | grep -v ".test."

# Library functions
find lib -name "*.ts" | grep -v ".test."
```

### Step 2: Map Existing Tests

```bash
# Find all test files
find tests -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts"

# Categorise by type
tests/unit/     → Unit tests
tests/api/      → API route tests
tests/e2e/      → End-to-end tests
```

### Step 3: Identify Gaps

For each source file, check if corresponding test exists:

| Source Pattern | Expected Test Location |
|---------------|----------------------|
| `app/api/*/route.ts` | `tests/api/*.test.ts` |
| `components/*.tsx` | `tests/unit/*.test.tsx` |
| `lib/*.ts` | `tests/unit/*.test.ts` |

### Step 4: Prioritise Gaps

Assign priority based on:

| Priority | Criteria |
|----------|----------|
| **CRITICAL** | API routes with database writes, auth-related code |
| **HIGH** | Core business logic, frequently-used components |
| **MEDIUM** | UI components, utility functions |
| **LOW** | Static content, configuration files |

### Step 5: Generate Coverage Analysis

Create `docs/testing/analysis/coverage-analysis.md`:

```markdown
# Test Coverage Analysis

**Generated:** <timestamp>
**Agent:** test-plan
**Commit:** <current HEAD>

## Summary

| Metric | Value |
|--------|-------|
| Total files scanned | N |
| Files with tests | N |
| Files without tests | N |
| Coverage % | X% |

## Gaps by Priority

### CRITICAL (Must Fix)

| # | File | Type | Reason |
|---|------|------|--------|
| 1 | app/api/transactions/route.ts | API | Database writes, no tests |
| 2 | lib/hsbc/oauth.ts | Auth | Security-critical |

### HIGH (Should Fix)

| # | File | Type | Reason |
|---|------|------|--------|
| 3 | components/TransactionList.tsx | Component | Core UI, no tests |

### MEDIUM (Nice to Have)

...

### LOW (Optional)

...

## Existing Coverage

| Feature | Unit | API | E2E | Notes |
|---------|------|-----|-----|-------|
| transactions | ✓ | ✗ | ✗ | Unit only |
| categories | ✗ | ✗ | ✗ | No tests |

## Recommendations

1. Start with /test-build critical
2. Then /test-build high
3. Target 80% coverage before Phase 3
```

---

## State File Schema

`docs/agents/test-plan/state.json`:

```json
{
  "agent": "test-plan",
  "lastRun": "2025-01-15T10:30:00Z",
  "lastCommit": "abc123def",
  "status": "success",
  "completedWork": [
    {
      "mode": "analyze",
      "timestamp": "2025-01-15T10:30:00Z",
      "filesScanned": 45,
      "gapsFound": 23,
      "outputFile": "docs/testing/analysis/coverage-analysis.md"
    }
  ],
  "metrics": {
    "totalAnalyses": 5,
    "avgGapsPerRun": 18,
    "lastCoverage": 62
  },
  "blockers": [],
  "nextAction": "/test-build critical"
}
```

---

## Update State on Completion

After analysis completes:

1. Set `lastRun` to current timestamp
2. Set `lastCommit` to current HEAD
3. Update `status` (success/failed/partial)
4. Add entry to `completedWork`
5. Update `metrics`
6. Set `nextAction` recommendation
7. Write to `docs/agents/test-plan/state.json`

---

## Output Files

| File | Purpose |
|------|---------|
| `docs/testing/analysis/coverage-analysis.md` | Main analysis output |
| `docs/agents/test-plan/state.json` | Agent state |

---

## Handoff

After successful analysis, recommend:
```
Next step: /test-build critical

This will generate tests for X critical gaps identified.
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No source files found | Report error, check project structure |
| Git not initialised | Report error, suggest git init |
| State file corrupt | Reset to defaults, warn user |
| Previous run incomplete | Resume or restart based on user input |

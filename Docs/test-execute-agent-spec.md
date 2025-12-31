# Test Execution Agent Specification

**Version:** 1.0  
**Type:** Actor (Coding Agent)  
**Command:** `/test-execute <mode>`

---

## Overview

The Test Execution Agent runs tests and updates the feature-status.json truth file. This agent has a **unique responsibility**: it is the ONLY agent permitted to write to the truth file. All other agents read from it.

---

## Modes

| Mode | Description |
|------|-------------|
| `quick` | Fast validation - tests for recently changed files only |
| `unit` | Run all unit tests |
| `api` | Run all API tests |
| `e2e` | Run all E2E tests |
| `pre-merge` | Full test suite - required before merging |
| `feature:<n>` | Tests for specific feature only |
| `smoke` | Minimal critical path tests |

---

## Standard Boot Sequence

**MANDATORY: Execute before any work.**

### Phase 0: Read Core Context
```bash
cat CLAUDE.md
```

### Phase 1: Read Agent State
```bash
cat docs/agents/test-execute/state.json
```

### Phase 2: Detect Changes Since Last Run
```bash
git log <lastCommit>..HEAD --oneline
git diff --name-only <lastCommit>..HEAD
```

### Phase 3: Check for Invalidations
- Identify which features have changed source files
- Those features need test re-execution

### Phase 4: Read Feature Truth
```bash
cat docs/agents/truth/feature-status.json
```

### Phase 5: Report Boot Status
```markdown
## Test Execution Agent - Boot Complete

**Last run:** X days ago
**Commits since:** N
**Features invalidated:** N

**Proceeding with mode:** <mode>
```

### Phase 6: Proceed or Wait
- If no tests exist → Suggest /test-plan then /test-build
- If blockers → Report and stop
- Otherwise → Proceed

---

## Execution Flow

### Step 1: Determine Test Scope

Based on mode:

| Mode | Scope |
|------|-------|
| `quick` | Tests matching changed files since lastCommit |
| `unit` | `tests/unit/**` |
| `api` | `tests/api/**` |
| `e2e` | `tests/e2e/**` |
| `pre-merge` | All tests |
| `feature:transactions` | Tests containing "transactions" |

### Step 2: Run Tests

```bash
# Unit tests
npx vitest run tests/unit/ --reporter=json --outputFile=test-results-unit.json

# API tests
npx vitest run tests/api/ --reporter=json --outputFile=test-results-api.json

# E2E tests (Playwright)
npx playwright test tests/e2e/ --reporter=json --output=test-results-e2e.json
```

### Step 3: Collect Results

Parse JSON output to extract:
- Total tests run
- Passed count
- Failed count
- Skipped count
- Duration
- Individual test results

### Step 4: Update Truth File

**CRITICAL: Only this agent writes to feature-status.json**

Read current truth:
```bash
cat docs/agents/truth/feature-status.json
```

Update with test results:

```json
{
  "lastUpdated": "2025-01-15T12:00:00Z",
  "updatedBy": "test-execute",
  "features": {
    "transactions": {
      "unit": {
        "status": "pass",
        "count": 12,
        "passed": 12,
        "failed": 0,
        "coverage": 85,
        "lastRun": "2025-01-15T12:00:00Z",
        "duration": 1.2
      },
      "api": {
        "status": "pass",
        "count": 8,
        "passed": 8,
        "failed": 0,
        "coverage": 92,
        "lastRun": "2025-01-15T12:00:00Z",
        "duration": 3.5
      },
      "e2e": {
        "status": "none",
        "count": 0,
        "lastRun": null
      }
    },
    "categories": {
      "unit": {
        "status": "fail",
        "count": 5,
        "passed": 3,
        "failed": 2,
        "failures": [
          {
            "test": "should merge categories",
            "error": "Expected 3, got 2"
          }
        ],
        "lastRun": "2025-01-15T12:00:00Z"
      }
    }
  },
  "summary": {
    "totalFeatures": 6,
    "featuresFullyTested": 2,
    "featuresPassing": 4,
    "featuresFailing": 1,
    "featuresUntested": 1,
    "overallCoverage": 68,
    "totalTests": 45,
    "totalPassing": 42,
    "totalFailing": 3
  }
}
```

### Step 5: Generate Execution Report

Create `docs/testing/execution-history/<timestamp>_<mode>.md`:

```markdown
# Test Execution Report

**Generated:** 2025-01-15T12:00:00Z
**Mode:** pre-merge
**Agent:** test-execute
**Commit:** abc123def

## Summary

| Metric | Value |
|--------|-------|
| Tests run | 45 |
| Passed | 42 |
| Failed | 3 |
| Skipped | 0 |
| Duration | 12.5s |
| Coverage | 68% |

## Results by Type

| Type | Run | Pass | Fail | Duration |
|------|-----|------|------|----------|
| Unit | 25 | 24 | 1 | 2.1s |
| API | 15 | 14 | 1 | 8.2s |
| E2E | 5 | 4 | 1 | 2.2s |

## Failures

### 1. categories/merge.test.ts
```
Test: should merge categories correctly
Error: Expected 3 categories, received 2
Stack: at mergeCategories (lib/categories.ts:45)
```

### 2. api/transactions.test.ts
```
Test: POST should validate required fields
Error: Expected 400, received 500
Stack: at POST (app/api/transactions/route.ts:23)
```

## Flaky Tests

| Test | Flake Rate | Last 5 Runs |
|------|-----------|-------------|
| e2e/sync.spec.ts:15 | 20% | ✓✓✗✓✓ |

## Coverage Delta

| Feature | Previous | Current | Change |
|---------|----------|---------|--------|
| transactions | 82% | 85% | +3% |
| categories | 70% | 68% | -2% |

## Verdict

**❌ FAILED - 3 failing tests**

Cannot proceed with merge until failures resolved.
```

### Step 6: Handle Flaky Tests

Track tests that intermittently fail:

```json
{
  "flakyTests": {
    "tests/e2e/sync.spec.ts:15": {
      "failureRate": 0.2,
      "lastFailure": "2025-01-14",
      "history": ["pass", "pass", "fail", "pass", "pass"]
    }
  }
}
```

For flaky tests:
1. Retry up to 3 times
2. If passes on retry, log as flaky
3. If fails all retries, mark as genuine failure

---

## State File Schema

`docs/agents/test-execute/state.json`:

```json
{
  "agent": "test-execute",
  "lastRun": "2025-01-15T12:00:00Z",
  "lastCommit": "abc123def",
  "status": "success",
  "completedWork": [
    {
      "mode": "pre-merge",
      "timestamp": "2025-01-15T12:00:00Z",
      "testsRun": 45,
      "passed": 42,
      "failed": 3,
      "duration": 12.5,
      "truthUpdated": true
    }
  ],
  "metrics": {
    "totalRuns": 25,
    "avgDuration": 10.2,
    "avgPassRate": 0.94,
    "flakyTestCount": 2
  },
  "blockers": [],
  "nextAction": "Fix 3 failing tests, then /test-execute pre-merge"
}
```

---

## Pre-Merge Requirements

For `/test-execute pre-merge` to pass:

1. **All tests pass** - No failing tests
2. **Coverage threshold met** - Minimum 80% for critical paths
3. **No new flaky tests** - Existing flaky tests tolerated
4. **E2E tests included** - Critical paths must have E2E coverage

If any fail, verdict is **FAILED** and merge is blocked.

---

## Handoff

### On Success
```
All tests passed.

Feature status updated in docs/agents/truth/feature-status.json

Next steps:
- If pre-merge: /code-review branch → /merge-feature <branch>
- Otherwise: Continue development
```

### On Failure
```
3 tests failed.

Failures logged in docs/testing/execution-history/<timestamp>.md

Next steps:
1. Review failures
2. Fix failing tests or code
3. Run /test-execute quick to validate fixes
4. Then /test-execute pre-merge before merge
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No tests found | Suggest /test-plan → /test-build |
| Test timeout | Increase timeout or mark as slow |
| Environment issues | Report setup problems |
| Database not available | Check Supabase connection |
| Port conflicts | Kill conflicting processes |

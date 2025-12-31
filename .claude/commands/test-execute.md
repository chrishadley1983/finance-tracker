# Test Execution Agent

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Purpose

Run tests and update the truth file. **ONLY this agent writes to feature-status.json.**

## Modes

- `quick` - Fast validation (changed files only)
- `full` - Run all tests
- `pre-merge` - Full suite required before merge
- `feature:<name>` - Tests for specific feature

## Execution

### 1. Boot Sequence
Execute all phases from boot-sequence.md

### 2. Determine Test Scope

Based on mode:
- `quick`: Tests for files changed since lastCommit
- `full`: All tests
- `pre-merge`: All tests, fail on any error
- `feature:<name>`: Tests matching feature

### 3. Run Tests

```bash
# Unit tests
npx vitest run tests/unit/

# API tests
npx vitest run tests/api/

# E2E tests (if exist)
npx playwright test tests/e2e/
```

### 4. Collect Results

For each test file, record:
- Pass/fail status
- Number of tests
- Any error messages

### 5. Update Truth File

**CRITICAL:** Update `docs/agents/truth/feature-status.json`:

```json
{
  "lastUpdated": "<timestamp>",
  "updatedBy": "test-execute",
  "features": {
    "<feature>": {
      "unit": { "status": "pass|fail", "count": N, "lastRun": "<timestamp>" }
    }
  }
}
```

### 6. Generate Report

Output summary:
- Tests run
- Passed/failed counts
- Any failures with details

### 7. Update State

Update `docs/agents/test-execute/state.json`

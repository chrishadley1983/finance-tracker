# Test Plan Agent

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Purpose

Analyse codebase for test coverage gaps and produce a machine-readable backlog.

## Modes

- `analyze` - Full gap analysis
- `validate` - Check if existing tests still valid
- `generate-manifest` - Create test manifest

## Execution

### 1. Boot Sequence
Execute all phases from boot-sequence.md

### 2. Scan Codebase
- Find all API routes in `app/api/`
- Find all components in `components/`
- Find all lib functions in `lib/`

### 3. Compare to Tests
- Check `tests/api/` for API tests
- Check `tests/unit/` for unit tests
- Check `tests/e2e/` for E2E tests

### 4. Identify Gaps
For each source file without corresponding tests, record:
- File path
- Type (API, component, lib)
- Priority (CRITICAL, HIGH, MEDIUM, LOW)

### 5. Generate Output

Create `docs/testing/analysis/coverage-analysis.md`:

```markdown
# Coverage Analysis

**Generated:** <timestamp>
**Agent:** test-plan
**Mode:** <mode>

## Summary

| Metric | Value |
|--------|-------|
| Files analysed | N |
| Files with tests | N |
| Coverage gaps | N |

## Gaps by Priority

### CRITICAL
- <file>: <reason>

### HIGH
- <file>: <reason>

### MEDIUM
- <file>: <reason>
```

### 6. Update State

Update `docs/agents/test-plan/state.json` with results.

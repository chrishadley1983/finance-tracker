# Test Build Agent Specification

**Version:** 1.0  
**Type:** Actor (Coding Agent)  
**Command:** `/test-build <mode>`

---

## Overview

The Test Build Agent reads the coverage analysis produced by Test Plan Agent and generates test files to fill the identified gaps. As an Actor agent, it reads state, picks work items, acts, and updates state.

---

## Modes

| Mode | Description |
|------|-------------|
| `critical` | Generate tests for CRITICAL priority gaps only |
| `high` | Generate tests for HIGH priority gaps |
| `feature:<name>` | Generate tests for specific feature |
| `type:<unit\|api\|e2e>` | Generate specific test type |
| `all` | Generate all missing tests (use with caution) |

---

## Standard Boot Sequence

**MANDATORY: Execute before any work.**

### Phase 0: Read Core Context
```bash
cat CLAUDE.md
```
Extract: Project rules, test patterns, conventions.

### Phase 1: Read Agent State
```bash
cat docs/agents/test-build/state.json
```
Extract: lastRun, lastCommit, completedWork, blockers.

### Phase 2: Detect Changes Since Last Run
```bash
git log <lastCommit>..HEAD --oneline
git diff --name-only <lastCommit>..HEAD
```

### Phase 3: Check for Invalidations
1. Read `docs/agents/config/file-feature-map.json`
2. Check if source files for completed tests changed
3. Mark affected tests as needing regeneration

### Phase 4: Read Feature Truth
```bash
cat docs/agents/truth/feature-status.json
```

### Phase 5: Report Boot Status
```markdown
## Test Build Agent - Boot Complete

**Last run:** X days ago (<date>)
**Commits since:** N
**Files changed:** N

**Invalidations:**
- <list any tests that may need updates>

**Proceeding with mode:** <mode>
```

### Phase 6: Proceed or Wait
- If coverage-analysis.md doesn't exist → Suggest /test-plan analyze first
- If blockers exist → Report and stop
- Otherwise → Proceed

---

## Execution Flow

### Step 1: Read Coverage Analysis

```bash
cat docs/testing/analysis/coverage-analysis.md
```

Parse the gaps table to identify work items.

### Step 2: Filter by Mode

| Mode | Filter |
|------|--------|
| `critical` | Priority = CRITICAL |
| `high` | Priority = HIGH |
| `feature:transactions` | File contains "transactions" |
| `type:api` | Target is app/api/** |

### Step 3: For Each Gap, Generate Tests

#### API Route Tests

For `app/api/<feature>/route.ts`:

```typescript
// tests/api/<feature>.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('GET /api/<feature>', () => {
  it('returns 200 for valid request', async () => {
    const response = await fetch('http://localhost:3000/api/<feature>');
    expect(response.status).toBe(200);
  });

  it('returns correct data structure', async () => {
    const response = await fetch('http://localhost:3000/api/<feature>');
    const data = await response.json();
    expect(data).toHaveProperty('expected_field');
  });

  it('handles errors gracefully', async () => {
    // Test error conditions
  });
});

describe('POST /api/<feature>', () => {
  it('creates resource with valid data', async () => {
    const response = await fetch('http://localhost:3000/api/<feature>', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* valid data */ })
    });
    expect(response.status).toBe(201);
  });

  it('validates required fields', async () => {
    const response = await fetch('http://localhost:3000/api/<feature>', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(response.status).toBe(400);
  });
});
```

#### Component Tests

For `components/<Component>.tsx`:

```typescript
// tests/unit/<Component>.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from '@/components/ComponentName';

describe('ComponentName', () => {
  it('renders without crashing', () => {
    render(<ComponentName />);
    expect(screen.getByTestId('component-name')).toBeInTheDocument();
  });

  it('displays correct content', () => {
    render(<ComponentName title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const onClick = vi.fn();
    render(<ComponentName onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<ComponentName loading />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<ComponentName error="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

#### Library Function Tests

For `lib/<module>.ts`:

```typescript
// tests/unit/<module>.test.ts
import { describe, it, expect } from 'vitest';
import { functionName } from '@/lib/<module>';

describe('functionName', () => {
  it('returns expected result for valid input', () => {
    const result = functionName(validInput);
    expect(result).toEqual(expectedOutput);
  });

  it('handles edge cases', () => {
    expect(functionName(null)).toBeNull();
    expect(functionName(undefined)).toBeUndefined();
    expect(functionName([])).toEqual([]);
  });

  it('throws for invalid input', () => {
    expect(() => functionName(invalidInput)).toThrow();
  });
});
```

### Step 4: Validate Generated Tests

```bash
# TypeScript compilation check
npx tsc --noEmit

# Lint check
npm run lint

# Quick syntax validation
npx vitest --run --reporter=verbose tests/<newly-created>
```

### Step 5: Generate Build Report

Create timestamped report:

```markdown
# Test Build Report

**Generated:** <timestamp>
**Mode:** critical
**Agent:** test-build

## Summary

| Metric | Value |
|--------|-------|
| Tests generated | 8 |
| Files created | 4 |
| Gaps addressed | 6 |

## Tests Created

| # | File | Tests | Target |
|---|------|-------|--------|
| 1 | tests/api/transactions.test.ts | 5 | app/api/transactions/route.ts |
| 2 | tests/unit/Button.test.tsx | 4 | components/Button.tsx |

## Validation Results

- TypeScript: ✅ Pass
- Lint: ✅ Pass
- Test run: ✅ All passing

## Next Steps

Run `/test-execute quick` to validate all tests pass.
Then run `/test-build high` for next priority tier.
```

---

## State File Schema

`docs/agents/test-build/state.json`:

```json
{
  "agent": "test-build",
  "lastRun": "2025-01-15T11:00:00Z",
  "lastCommit": "def456abc",
  "status": "success",
  "completedWork": [
    {
      "mode": "critical",
      "timestamp": "2025-01-15T11:00:00Z",
      "testsCreated": 8,
      "filesCreated": 4,
      "gapsAddressed": [
        {
          "file": "app/api/transactions/route.ts",
          "testFile": "tests/api/transactions.test.ts",
          "sourceHash": "abc123"
        }
      ]
    }
  ],
  "metrics": {
    "totalTestsCreated": 45,
    "totalFilesCreated": 18,
    "avgTestsPerRun": 9
  },
  "blockers": [],
  "nextAction": "/test-execute quick"
}
```

---

## Update State on Completion

1. Set `lastRun` to current timestamp
2. Set `lastCommit` to current HEAD
3. Update `status`
4. Add entry to `completedWork` with source file hashes
5. Update `metrics`
6. Set `nextAction`
7. Write state file

---

## Test Patterns Reference

### Naming Conventions

| Source | Test File |
|--------|-----------|
| `app/api/foo/route.ts` | `tests/api/foo.test.ts` |
| `components/Foo.tsx` | `tests/unit/Foo.test.tsx` |
| `lib/foo.ts` | `tests/unit/foo.test.ts` |
| Feature E2E | `tests/e2e/foo.spec.ts` |

### Required Test Coverage

| Type | Minimum Tests |
|------|--------------|
| API GET | success, not found, error |
| API POST | success, validation, duplicate |
| API PUT | success, not found, validation |
| API DELETE | success, not found |
| Component | render, props, interaction, states |
| Utility | happy path, edge cases, errors |

---

## Handoff

After successful build:
```
Tests generated successfully.

Next step: /test-execute quick

This will run the new tests and update feature-status.json.
```

---

## Error Handling

| Error | Action |
|-------|--------|
| coverage-analysis.md missing | Suggest /test-plan analyze |
| TypeScript errors in generated tests | Fix or report |
| Import resolution failures | Check paths, suggest fixes |
| Test already exists | Skip or ask to overwrite |

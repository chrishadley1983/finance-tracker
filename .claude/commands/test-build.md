# Test Build Agent

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Purpose

Generate test files to fill coverage gaps identified by Test Plan Agent.

## Modes

- `critical` - Build CRITICAL priority tests
- `high` - Build HIGH priority tests
- `feature:<name>` - Build tests for specific feature
- `all` - Build all missing tests

## Execution

### 1. Boot Sequence
Execute all phases from boot-sequence.md

### 2. Read Coverage Analysis
```bash
cat docs/testing/analysis/coverage-analysis.md
```

### 3. Filter by Mode
Select items matching the requested mode/priority.

### 4. For Each Gap

#### API Routes
Create `tests/api/<route>.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('GET /api/<route>', () => {
  it('returns expected response', async () => {
    const response = await fetch('http://localhost:3000/api/<route>');
    expect(response.ok).toBe(true);
  });
});
```

#### Components
Create `tests/unit/<component>.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentName } from '@/components/ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    // Add assertions
  });
});
```

### 5. Validate Generated Tests
```bash
npx tsc --noEmit
npm run lint
```

### 6. Update State

Update `docs/agents/test-build/state.json` with:
- Tests created
- Files created
- Any errors

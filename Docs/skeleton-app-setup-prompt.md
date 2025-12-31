# Personal Finance App - Skeleton Setup Prompt

## Overview

This prompt guides Claude Code through setting up a minimal skeleton application to **test the agent framework** before building actual features. The goal is to validate that all 5 agents work correctly with the Domain Memory pattern.

**Do NOT build features yet.** Build only the infrastructure needed to test the agents.

---

## Step 1: Project Initialization

```bash
# Create Next.js project
npx create-next-app@14 personal-finance --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"

cd personal-finance

# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @playwright/test

# Install other dependencies we'll need
npm install zod
```

---

## Step 2: Create Directory Structure

Create all directories for the agent infrastructure:

```bash
# Agent infrastructure
mkdir -p docs/agents/config
mkdir -p docs/agents/truth
mkdir -p docs/agents/test-plan
mkdir -p docs/agents/test-build
mkdir -p docs/agents/test-execute
mkdir -p docs/agents/code-review
mkdir -p docs/agents/merge-feature

# Knowledge base
mkdir -p docs/knowledge

# Testing
mkdir -p docs/testing/analysis
mkdir -p docs/testing/execution-history
mkdir -p docs/reviews
mkdir -p docs/merges

# Test directories
mkdir -p tests/unit
mkdir -p tests/api
mkdir -p tests/e2e

# Claude commands
mkdir -p .claude/commands
```

---

## Step 3: Create CLAUDE.md

Create `CLAUDE.md` in project root:

```markdown
# Personal Finance App - CLAUDE.md

## Project Overview

A personal finance application for tracking transactions, budgets, wealth, and FIRE projections.

**Current Phase:** Phase 0 - Agent Framework Testing

---

## Critical Rules

1. **ALWAYS execute the Standard Boot Sequence** before any agent work
2. **NEVER claim work is complete** without updating state.json
3. **ONLY Test Execution Agent** may write to feature-status.json
4. **Read docs/agents/config/boot-sequence.md** at start of every agent run

---

## Agent Commands

| Command | Purpose |
|---------|---------|
| `/test-plan` | Analyse test coverage gaps |
| `/test-build` | Generate tests for gaps |
| `/test-execute` | Run tests, update truth |
| `/code-review` | Review code changes |
| `/merge-feature` | Safe branch merge |

---

## Directory Structure

```
personal-finance/
├── .claude/commands/     # Agent slash commands
├── docs/
│   ├── agents/           # Agent state & config
│   │   ├── config/       # Shared config
│   │   ├── truth/        # feature-status.json
│   │   └── <agent>/      # Per-agent state
│   ├── knowledge/        # Project documentation
│   ├── testing/          # Test analysis outputs
│   ├── reviews/          # Code review reports
│   └── merges/           # Merge reports
├── app/                  # Next.js app router
├── components/           # React components
├── lib/                  # Shared utilities
└── tests/                # Test files
```

---

## Development Workflow

1. Before any work: Run agent boot sequence
2. During development: `/test-execute quick`, `/code-review staged`
3. Before merge: `/test-execute pre-merge`, `/code-review branch`
4. To merge: `/merge-feature <branch>`

---

## Knowledge Base

- Architecture: `docs/knowledge/architecture.md`
- Patterns: `docs/knowledge/patterns.md`
- Testing: `docs/knowledge/testing.md`

---

## Current Focus

Testing the agent framework with a minimal skeleton app.
```

---

## Step 4: Create Boot Sequence

Create `docs/agents/config/boot-sequence.md`:

```markdown
# Standard Boot Sequence

**EVERY agent run MUST execute this sequence. No exceptions.**

---

## Phase 0: Read Core Context

1. Read `CLAUDE.md` - Get project rules
2. Read agent specification from `.claude/commands/<agent>.md`

---

## Phase 1: Read Agent State

```bash
cat docs/agents/<agent-name>/state.json
```

Extract:
- `lastRun` - When agent last executed
- `lastCommit` - Git commit at last run
- `completedWork` - What was done
- `blockers` - Any issues

If state.json doesn't exist, this is first run - proceed with defaults.

---

## Phase 2: Detect Changes Since Last Run

```bash
# Get commits since last run (skip if first run)
git log <lastCommit>..HEAD --oneline

# Get changed files since last run
git diff --name-only <lastCommit>..HEAD
```

Record:
- Number of commits
- Files changed
- Days elapsed

---

## Phase 3: Check for Invalidations

1. Read `docs/agents/config/file-feature-map.json`
2. For each changed file, identify affected features
3. For each item in `completedWork`, check if source files changed
4. Mark affected work as 'invalidated'

---

## Phase 4: Read Feature Truth

```bash
cat docs/agents/truth/feature-status.json
```

Merge with invalidation results to get effective backlog.

---

## Phase 5: Report Boot Status

Output:

```markdown
## <Agent Name> - Boot Complete

**Last run:** X days ago (<date>)
**Commits since:** N
**Files changed:** N

**Invalidations:**
- <list any invalidated work>

**Effective backlog:**
- <list items needing work>

**Proceeding with mode:** <mode>
```

---

## Phase 6: Proceed or Wait

- If blockers exist → Report and stop
- If human decision needed → Ask
- Otherwise → Proceed with work

---

## Phase 7: Update State on Completion

After work completes, update state.json:

```json
{
  "lastRun": "<current ISO timestamp>",
  "lastCommit": "<current HEAD>",
  "status": "success|failed|partial",
  "completedWork": [/* updated */],
  "metrics": {/* updated */}
}
```
```

---

## Step 5: Create File-Feature Map

Create `docs/agents/config/file-feature-map.json`:

```json
{
  "description": "Maps source files to features they affect. Used for invalidation detection.",
  "patterns": [
    { "glob": "app/api/health/**", "features": ["health"] },
    { "glob": "components/Button.tsx", "features": ["ui"] },
    { "glob": "lib/**", "features": ["*"] }
  ],
  "overrides": {}
}
```

---

## Step 6: Create Truth File

Create `docs/agents/truth/feature-status.json`:

```json
{
  "lastUpdated": null,
  "updatedBy": null,
  "features": {
    "health": {
      "unit": { "status": "none", "count": 0, "lastRun": null },
      "api": { "status": "none", "count": 0, "lastRun": null },
      "e2e": { "status": "none", "count": 0, "lastRun": null }
    },
    "ui": {
      "unit": { "status": "none", "count": 0, "lastRun": null },
      "api": { "status": "none", "count": 0, "lastRun": null },
      "e2e": { "status": "none", "count": 0, "lastRun": null }
    }
  },
  "summary": {
    "totalFeatures": 2,
    "passing": 0,
    "failing": 0,
    "untested": 2,
    "overallCoverage": 0
  }
}
```

---

## Step 7: Create Agent State Files

Create initial state.json for each agent:

**docs/agents/test-plan/state.json:**
```json
{
  "agent": "test-plan",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "featuresAnalysed": 0,
    "gapsIdentified": 0
  },
  "blockers": []
}
```

**docs/agents/test-build/state.json:**
```json
{
  "agent": "test-build",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "testsCreated": 0,
    "filesCreated": 0
  },
  "blockers": []
}
```

**docs/agents/test-execute/state.json:**
```json
{
  "agent": "test-execute",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "testsRun": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0
  },
  "blockers": []
}
```

**docs/agents/code-review/state.json:**
```json
{
  "agent": "code-review",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "filesReviewed": 0,
    "issuesFound": 0,
    "criticalIssues": 0
  },
  "blockers": []
}
```

**docs/agents/merge-feature/state.json:**
```json
{
  "agent": "merge-feature",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "branchesMerged": 0,
    "conflictsResolved": 0
  },
  "blockers": []
}
```

---

## Step 8: Create Skeleton App Files

**app/api/health/route.ts:**
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
```

**components/Button.tsx:**
```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded font-medium transition-colors';
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]}`}
    >
      {children}
    </button>
  );
}
```

---

## Step 9: Create Vitest Config

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**tests/setup.ts:**
```typescript
import '@testing-library/jest-dom';
```

---

## Step 10: Create Agent Command Files

Create `.claude/commands/test-plan.md`:

```markdown
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
```

Create `.claude/commands/test-build.md`:

```markdown
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
```

Create `.claude/commands/test-execute.md`:

```markdown
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
```

Create `.claude/commands/code-review.md`:

```markdown
# Code Review Agent

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Purpose

Review code changes against project standards.

## Modes

- `staged` - Review staged changes
- `branch` - Review entire feature branch vs main
- `security` - Security-focused review
- `full` - All review phases

## Execution

### 1. Boot Sequence
Execute all phases from boot-sequence.md

### 2. Get Changes

```bash
# For staged mode
git diff --staged

# For branch mode
git diff main..HEAD
```

### 3. Review Phases

#### Phase 1: Automated Checks
- TypeScript: `npx tsc --noEmit`
- Lint: `npm run lint`
- Format: Check for consistent formatting

#### Phase 2: Code Analysis
- Check for patterns from CLAUDE.md
- Check for proper error handling
- Check for type safety

#### Phase 3: Security (if enabled)
- Check for hardcoded secrets
- Check for SQL injection risks
- Check for XSS vulnerabilities

### 4. Generate Report

Create `docs/reviews/YYYY-MM-DD_HH-MM_review.md`:

```markdown
# Code Review Report

**Date:** <timestamp>
**Mode:** <mode>
**Files reviewed:** N

## Verdict: APPROVED | CHANGES_REQUIRED | CRITICAL_ISSUES

## Issues Found

### Critical
- <issue>

### Warnings
- <issue>

### Suggestions
- <suggestion>
```

### 5. Update State

Update `docs/agents/code-review/state.json`
```

Create `.claude/commands/merge-feature.md`:

```markdown
# Merge Feature Agent

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Purpose

Safely merge feature branches with verification.

## Usage

`/merge-feature <branch-name>`

## Execution

### 1. Boot Sequence
Execute all phases from boot-sequence.md

### 2. Pre-Merge Verification

```bash
# Check for uncommitted changes
git status --porcelain

# Ensure on main
git branch --show-current

# Fetch latest
git fetch origin

# Check branch exists
git branch -a | grep <branch-name>
```

### 3. Prepare Merge

```bash
# Switch to main
git checkout main

# Pull latest
git pull origin main

# Show what will be merged
git log main..<branch-name> --oneline
```

### 4. Execute Merge

```bash
# Merge with --no-ff to preserve history
git merge --no-ff <branch-name> -m "Merge <branch-name> into main"
```

### 5. Post-Merge Verification

```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npm test

# Start dev server (briefly)
npm run dev &
sleep 5
curl http://localhost:3000/api/health
kill %1
```

### 6. Push and Cleanup

```bash
# Push to origin
git push origin main

# Delete local branch
git branch -D <branch-name>

# Delete remote branch
git push origin --delete <branch-name>
```

### 7. Generate Report

Create `docs/merges/YYYY-MM-DD_<branch-name>.md`:

```markdown
# Merge Report

**Branch:** <branch-name>
**Merged:** <timestamp>
**Commits:** N

## Verification Results

| Check | Status |
|-------|--------|
| TypeScript | ✅ Pass |
| Tests | ✅ Pass |
| Dev Server | ✅ Running |

## Files Changed
- <list>

## Cleanup
- Local branch deleted ✅
- Remote branch deleted ✅
```

### 8. Update State

Update `docs/agents/merge-feature/state.json`
```

---

## Step 11: Initialize Git

```bash
git init
git add .
git commit -m "Initial skeleton app with agent infrastructure"
```

---

## Step 12: Run Validation Tests

Now test each agent:

### Test 1: Test Plan Agent
```
/test-plan analyze
```

Expected: Should find gaps for health API and Button component.

### Test 2: Test Build Agent
```
/test-build critical
```

Expected: Should generate test files.

### Test 3: Test Execution Agent
```
/test-execute quick
```

Expected: Should run tests, update feature-status.json.

### Test 4: Code Review Agent
```bash
# Make a small change first
echo "// comment" >> components/Button.tsx
git add components/Button.tsx
```
```
/code-review staged
```

Expected: Should review the staged change.

### Test 5: Change Detection
```bash
# Commit the change
git commit -m "Add comment"
```
```
/test-plan analyze
```

Expected: Boot sequence should detect 1 commit since last run.

### Test 6: Merge Feature Agent
```bash
# Create a feature branch
git checkout -b feature/test-merge
echo "// test" >> app/api/health/route.ts
git add .
git commit -m "Test change"
git checkout main
```
```
/merge-feature feature/test-merge
```

Expected: Should merge, verify, and cleanup.

---

## Success Criteria

All 6 validation tests pass:
- [ ] Test Plan Agent finds gaps
- [ ] Test Build Agent generates tests
- [ ] Test Execution Agent runs tests and updates truth
- [ ] Code Review Agent reviews changes
- [ ] Change Detection works
- [ ] Merge Feature Agent completes full cycle

Once all pass, Phase 0 is complete. Proceed to Phase 1 (Feature Development).

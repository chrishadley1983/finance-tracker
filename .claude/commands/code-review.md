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

### 5. CLAUDE.md Health Check

On every `branch` or `full` review, also audit the project's CLAUDE.md:

| Check | Flag If |
|-------|---------|
| Length | >200 lines — extract to linked `docs/` files |
| Inline code | Code blocks >5 lines — reference real source files instead |
| Feature docs | Feature-specific documentation — move to `docs/` |
| Incident rules | One-off warnings or workarounds — remove or generalise |
| Duplication | Content repeated from global `~/.claude/CLAUDE.md` |

Report issues as **Medium** severity under a **CLAUDE.md Health** heading in the review report.

### 6. Update State

Update `docs/agents/code-review/state.json`

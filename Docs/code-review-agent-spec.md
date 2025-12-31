# Code Review Agent Specification

**Version:** 1.0  
**Type:** Initializer (Stage Manager)  
**Command:** `/code-review <mode>`

---

## Overview

The Code Review Agent reviews code changes against project standards, patterns, and security requirements. As an Initializer agent, it analyses and reports but does not modify code.

---

## Modes

| Mode | Description |
|------|-------------|
| `staged` | Review staged changes (git add) - use during development |
| `branch` | Review entire feature branch vs main - use before merge |
| `dry` | Preview what would be reviewed without full analysis |
| `security` | Security-focused review only |
| `performance` | Performance-focused review only |
| `full` | All review phases |

---

## Standard Boot Sequence

**MANDATORY: Execute before any work.**

### Phase 0: Read Core Context
```bash
cat CLAUDE.md
```
Extract: Project patterns, coding standards, critical rules.

### Phase 1: Read Agent State
```bash
cat docs/agents/code-review/state.json
```

### Phase 2: Detect Changes Since Last Run
```bash
git log <lastCommit>..HEAD --oneline
```

### Phase 3: Read Feature Truth
```bash
cat docs/agents/truth/feature-status.json
```

### Phase 4: Report Boot Status
```markdown
## Code Review Agent - Boot Complete

**Last run:** X days ago
**Mode:** <mode>

**Proceeding with review**
```

---

## Execution Flow

### Step 1: Get Changes to Review

```bash
# For staged mode
git diff --staged --name-only
git diff --staged

# For branch mode
git diff main..HEAD --name-only
git diff main..HEAD

# List commits in branch
git log main..HEAD --oneline
```

### Step 2: Run Automated Checks

```bash
# TypeScript compilation
npx tsc --noEmit

# Linting
npm run lint

# Format check (if configured)
npx prettier --check "**/*.{ts,tsx}"
```

### Step 3: Review Phases

#### Phase 1: Pattern Compliance

Check against CLAUDE.md patterns:

| Pattern | Check |
|---------|-------|
| API routes | Error handling present? Validation using Zod? |
| Components | Props typed? Loading/error states? |
| Database | Using Supabase client correctly? |
| Imports | Proper path aliases (@/)? |

#### Phase 2: Code Quality

| Check | Criteria |
|-------|----------|
| TypeScript | No `any` types without justification |
| Error handling | Try/catch where needed, proper error messages |
| Naming | Clear, consistent naming conventions |
| Comments | Complex logic documented |
| DRY | No obvious duplication |
| Complexity | Functions under 50 lines |

#### Phase 3: Security (if enabled)

| Check | Risk |
|-------|------|
| Hardcoded secrets | API keys, passwords in code |
| SQL injection | Raw SQL without parameterisation |
| XSS | Unescaped user input in rendering |
| Auth bypass | Missing auth checks on routes |
| Sensitive data exposure | Logging PII, exposing in responses |

#### Phase 4: Performance (if enabled)

| Check | Issue |
|-------|-------|
| N+1 queries | Database queries in loops |
| Missing indexes | Queries without proper indexes |
| Large payloads | Unbounded data fetching |
| Memory leaks | Unclosed connections, growing arrays |
| Bundle size | Large imports that could be split |

### Step 4: Generate Review Report

Create `docs/reviews/<timestamp>_<mode>_review.md`:

```markdown
# Code Review Report

**Date:** 2025-01-15T14:00:00Z
**Mode:** branch
**Branch:** feature/add-categories
**Reviewer:** code-review-agent
**Files reviewed:** 8

---

## Verdict: CHANGES_REQUIRED

---

## Automated Checks

| Check | Status |
|-------|--------|
| TypeScript | ✅ Pass |
| ESLint | ⚠️ 3 warnings |
| Prettier | ✅ Pass |

---

## Issues Found

### 🔴 Critical (Must Fix)

#### 1. Missing error handling in API route
**File:** `app/api/categories/route.ts:23`
**Issue:** Database operation not wrapped in try/catch
**Risk:** Unhandled errors crash the server

```typescript
// Current
const result = await supabase.from('categories').insert(data);
return NextResponse.json(result);

// Suggested
try {
  const { data, error } = await supabase.from('categories').insert(data);
  if (error) throw error;
  return NextResponse.json(data, { status: 201 });
} catch (error) {
  console.error('Failed to create category:', error);
  return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
}
```

#### 2. Potential security issue
**File:** `lib/categories.ts:45`
**Issue:** User input used directly in query
**Risk:** SQL injection vulnerability

---

### 🟡 Warnings (Should Fix)

#### 3. TypeScript `any` type used
**File:** `components/CategoryList.tsx:12`
**Issue:** Props typed as `any`
**Fix:** Define proper interface for category props

#### 4. Missing loading state
**File:** `components/CategoryList.tsx`
**Issue:** No loading indicator while fetching
**Fix:** Add loading state and skeleton UI

---

### 🟢 Suggestions (Nice to Have)

#### 5. Consider extracting constant
**File:** `lib/categories.ts:8`
**Issue:** Magic number `50` for max categories
**Suggestion:** Extract to config constant

---

## Files Reviewed

| File | Status | Issues |
|------|--------|--------|
| app/api/categories/route.ts | 🔴 | 1 critical |
| lib/categories.ts | 🟡 | 1 warning, 1 suggestion |
| components/CategoryList.tsx | 🟡 | 2 warnings |
| components/CategoryForm.tsx | ✅ | None |

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟡 Warning | 3 |
| 🟢 Suggestion | 1 |

---

## Next Steps

1. Fix 2 critical issues
2. Address warnings before merge
3. Run `/code-review staged` after fixes
4. Then `/test-execute pre-merge`
```

---

## Verdict Criteria

| Verdict | Criteria |
|---------|----------|
| **APPROVED** | No critical issues, ≤3 warnings |
| **CHANGES_REQUIRED** | Any critical issues OR >3 warnings |
| **CRITICAL_ISSUES** | Security vulnerabilities or data loss risks |

---

## State File Schema

`docs/agents/code-review/state.json`:

```json
{
  "agent": "code-review",
  "lastRun": "2025-01-15T14:00:00Z",
  "lastCommit": "abc123def",
  "status": "success",
  "completedWork": [
    {
      "mode": "branch",
      "branch": "feature/add-categories",
      "timestamp": "2025-01-15T14:00:00Z",
      "filesReviewed": 8,
      "verdict": "CHANGES_REQUIRED",
      "criticalIssues": 2,
      "warnings": 3,
      "suggestions": 1
    }
  ],
  "metrics": {
    "totalReviews": 15,
    "approvalRate": 0.67,
    "avgIssuesPerReview": 3.2,
    "commonIssues": [
      { "type": "missing-error-handling", "count": 12 },
      { "type": "typescript-any", "count": 8 }
    ]
  },
  "blockers": [],
  "nextAction": "Fix critical issues, then /code-review staged"
}
```

---

## Checklist Templates

### API Route Checklist
- [ ] Error handling with try/catch
- [ ] Input validation (Zod schema)
- [ ] Proper HTTP status codes
- [ ] Response format consistent
- [ ] Auth check if required
- [ ] Rate limiting considered

### Component Checklist
- [ ] TypeScript props interface
- [ ] Loading state
- [ ] Error state
- [ ] Empty state
- [ ] Accessibility (aria labels)
- [ ] Responsive design

### Database Checklist
- [ ] Error handling
- [ ] Type safety
- [ ] No N+1 queries
- [ ] Proper indexes exist
- [ ] Transactions for multi-step ops

---

## Handoff

### On APPROVED
```
Code review passed.

Next steps:
- /test-execute pre-merge (if not already done)
- /merge-feature <branch>
```

### On CHANGES_REQUIRED
```
Code review identified issues requiring attention.

Critical issues: 2
Warnings: 3

Review report: docs/reviews/<timestamp>_review.md

Next steps:
1. Fix critical issues listed above
2. Address warnings
3. Run /code-review staged to validate fixes
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No changes to review | Report "nothing to review" |
| Git not clean | Warn about uncommitted changes |
| TypeScript fails | Include in report as blocker |
| CLAUDE.md missing | Use default patterns, warn user |

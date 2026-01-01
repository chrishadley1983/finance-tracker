# Coverage Analysis

**Generated:** 2026-01-01T12:00:00+00:00
**Agent:** test-plan
**Mode:** analyze

## Summary

| Metric | Value |
|--------|-------|
| Files analysed | 27 |
| Files with tests | 2 |
| Coverage gaps | 25 |

## Boot Status

**Last run:** 0 days ago (2026-01-01)
**Commits since:** 7
**Files changed:** 22

**Invalidations:**
- Previous analysis invalidated due to new API routes added

**Effective backlog:**
- All new API routes need tests
- All validation schemas need tests
- Button component needs tests

**Proceeding with mode:** analyze

---

## Source Files Discovered

### API Routes (15 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `app/api/health/route.ts` | health | Yes (5 tests) |
| `app/api/accounts/route.ts` | accounts | No |
| `app/api/accounts/[id]/route.ts` | accounts | No |
| `app/api/transactions/route.ts` | transactions | No |
| `app/api/transactions/[id]/route.ts` | transactions | No |
| `app/api/categories/route.ts` | categories | No |
| `app/api/categories/[id]/route.ts` | categories | No |
| `app/api/category-mappings/route.ts` | category-mappings | No |
| `app/api/category-mappings/[id]/route.ts` | category-mappings | No |
| `app/api/budgets/route.ts` | budgets | No |
| `app/api/budgets/[id]/route.ts` | budgets | No |
| `app/api/wealth-snapshots/route.ts` | wealth-snapshots | No |
| `app/api/wealth-snapshots/[id]/route.ts` | wealth-snapshots | No |
| `app/api/fire-parameters/route.ts` | fire-parameters | No |
| `app/api/fire-parameters/[id]/route.ts` | fire-parameters | No |

### Components (1 file)

| File | Feature | Has Tests |
|------|---------|-----------|
| `components/Button.tsx` | ui | No |

### Library Functions (11 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `lib/supabase/client.ts` | database | No |
| `lib/supabase/server.ts` | database | No |
| `lib/supabase/database.types.ts` | database | N/A (types only) |
| `lib/validations/accounts.ts` | validations | No |
| `lib/validations/categories.ts` | validations | No |
| `lib/validations/transactions.ts` | validations | No |
| `lib/validations/category-mappings.ts` | validations | No |
| `lib/validations/budgets.ts` | validations | No |
| `lib/validations/wealth-snapshots.ts` | validations | No |
| `lib/validations/fire-parameters.ts` | validations | No |
| `lib/validations/index.ts` | validations | N/A (re-export) |

---

## Gaps by Priority

### CRITICAL

These are core data layer API routes that handle financial data - must be tested before production use.

| File | Type | Reason |
|------|------|--------|
| `app/api/accounts/route.ts` | API | Accounts CRUD - handles financial account data |
| `app/api/accounts/[id]/route.ts` | API | Single account operations |
| `app/api/transactions/route.ts` | API | Transactions list/create - core financial data |
| `app/api/transactions/[id]/route.ts` | API | Single transaction operations |
| `app/api/categories/route.ts` | API | Category management for transactions |
| `app/api/categories/[id]/route.ts` | API | Single category operations |

### HIGH

These routes handle important but secondary features.

| File | Type | Reason |
|------|------|--------|
| `app/api/budgets/route.ts` | API | Budget tracking - financial planning |
| `app/api/budgets/[id]/route.ts` | API | Single budget operations |
| `app/api/wealth-snapshots/route.ts` | API | Wealth tracking data |
| `app/api/wealth-snapshots/[id]/route.ts` | API | Single snapshot operations |
| `app/api/category-mappings/route.ts` | API | Auto-categorization rules |
| `app/api/category-mappings/[id]/route.ts` | API | Single mapping operations |
| `app/api/fire-parameters/route.ts` | API | FIRE calculation parameters |
| `app/api/fire-parameters/[id]/route.ts` | API | Single FIRE parameter operations |

### MEDIUM

Validation schemas and shared utilities.

| File | Type | Reason |
|------|------|--------|
| `lib/validations/accounts.ts` | Lib | Account validation schemas |
| `lib/validations/transactions.ts` | Lib | Transaction validation schemas |
| `lib/validations/categories.ts` | Lib | Category validation schemas |
| `lib/validations/budgets.ts` | Lib | Budget validation schemas |
| `lib/validations/wealth-snapshots.ts` | Lib | Wealth snapshot validation schemas |
| `lib/validations/category-mappings.ts` | Lib | Category mapping validation schemas |
| `lib/validations/fire-parameters.ts` | Lib | FIRE parameter validation schemas |

### LOW

UI components and utility files.

| File | Type | Reason |
|------|------|--------|
| `components/Button.tsx` | Component | Basic UI component |

---

## Existing Tests

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/api/health.test.ts` | 5 | Pass |
| `tests/api/supabase-connection.test.ts` | 1+ | Pass |

---

## Recommended Test Plan

### Phase 1: Critical API Tests (Priority: CRITICAL)

1. **accounts.test.ts** - Test CRUD operations for accounts
   - GET /api/accounts - list all accounts
   - POST /api/accounts - create account with validation
   - GET /api/accounts/[id] - get single account
   - PUT /api/accounts/[id] - update account
   - DELETE /api/accounts/[id] - delete account
   - Error cases: invalid ID, validation errors, not found

2. **transactions.test.ts** - Test CRUD operations for transactions
   - GET with filters (account_id, category_id, date range)
   - POST with validation
   - Single transaction operations
   - Foreign key validation (account_id, category_id)

3. **categories.test.ts** - Test CRUD operations for categories

### Phase 2: High Priority API Tests

4. **budgets.test.ts**
5. **wealth-snapshots.test.ts**
6. **category-mappings.test.ts**
7. **fire-parameters.test.ts**

### Phase 3: Validation Schema Tests

8. **validations.test.ts** - Unit tests for all Zod schemas
   - Valid input passes
   - Invalid input fails with correct errors
   - Edge cases (null, undefined, empty strings)

---

## Test Generation Backlog

| Priority | File | Test Type | Suggested Test File |
|----------|------|-----------|---------------------|
| CRITICAL | `app/api/accounts/route.ts` | API | `tests/api/accounts.test.ts` |
| CRITICAL | `app/api/accounts/[id]/route.ts` | API | `tests/api/accounts.test.ts` |
| CRITICAL | `app/api/transactions/route.ts` | API | `tests/api/transactions.test.ts` |
| CRITICAL | `app/api/transactions/[id]/route.ts` | API | `tests/api/transactions.test.ts` |
| CRITICAL | `app/api/categories/route.ts` | API | `tests/api/categories.test.ts` |
| CRITICAL | `app/api/categories/[id]/route.ts` | API | `tests/api/categories.test.ts` |
| HIGH | `app/api/budgets/route.ts` | API | `tests/api/budgets.test.ts` |
| HIGH | `app/api/budgets/[id]/route.ts` | API | `tests/api/budgets.test.ts` |
| HIGH | `app/api/wealth-snapshots/route.ts` | API | `tests/api/wealth-snapshots.test.ts` |
| HIGH | `app/api/wealth-snapshots/[id]/route.ts` | API | `tests/api/wealth-snapshots.test.ts` |
| HIGH | `app/api/category-mappings/route.ts` | API | `tests/api/category-mappings.test.ts` |
| HIGH | `app/api/category-mappings/[id]/route.ts` | API | `tests/api/category-mappings.test.ts` |
| HIGH | `app/api/fire-parameters/route.ts` | API | `tests/api/fire-parameters.test.ts` |
| HIGH | `app/api/fire-parameters/[id]/route.ts` | API | `tests/api/fire-parameters.test.ts` |
| MEDIUM | `lib/validations/*.ts` | Unit | `tests/unit/validations.test.ts` |
| LOW | `components/Button.tsx` | Unit | `tests/unit/Button.test.tsx` |

---

## Next Steps

Run `/test-build critical` to generate tests for CRITICAL priority gaps.

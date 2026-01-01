# Coverage Analysis

**Generated:** 2026-01-01T15:30:00+00:00
**Agent:** test-plan
**Mode:** analyze

## Summary

| Metric | Value |
|--------|-------|
| Files analysed | 37 |
| Files with tests | 15 |
| Coverage gaps | 18 |

## Boot Status

**Last run:** Today (2026-01-01T12:00:00+00:00)
**Commits since:** 1 (Phase 1 Data Layer)
**Files changed:** 44

**Invalidations:**
- Previous analysis invalidated - new UI components added in Phase 2

**Effective backlog:**
- New layout components need unit tests
- New page components need E2E tests
- Validation schemas still need unit tests

**Proceeding with mode:** analyze

---

## Source Files Discovered

### API Routes (15 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `app/api/health/route.ts` | health | Yes (5 tests) |
| `app/api/accounts/route.ts` | accounts | Yes (13 tests) |
| `app/api/accounts/[id]/route.ts` | accounts | Yes (included above) |
| `app/api/transactions/route.ts` | transactions | Yes (22 tests) |
| `app/api/transactions/[id]/route.ts` | transactions | Yes (included above) |
| `app/api/categories/route.ts` | categories | Yes (14 tests) |
| `app/api/categories/[id]/route.ts` | categories | Yes (included above) |
| `app/api/category-mappings/route.ts` | category-mappings | Yes (19 tests) |
| `app/api/category-mappings/[id]/route.ts` | category-mappings | Yes (included above) |
| `app/api/budgets/route.ts` | budgets | Yes (18 tests) |
| `app/api/budgets/[id]/route.ts` | budgets | Yes (included above) |
| `app/api/wealth-snapshots/route.ts` | wealth-snapshots | Yes (18 tests) |
| `app/api/wealth-snapshots/[id]/route.ts` | wealth-snapshots | Yes (included above) |
| `app/api/fire-parameters/route.ts` | fire-parameters | Yes (19 tests) |
| `app/api/fire-parameters/[id]/route.ts` | fire-parameters | Yes (included above) |

### Components (4 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `components/Button.tsx` | ui | No |
| `components/layout/Sidebar.tsx` | layout | No |
| `components/layout/Header.tsx` | layout | No |
| `components/layout/AppLayout.tsx` | layout | No |

### Pages (7 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `app/page.tsx` | dashboard | No |
| `app/transactions/page.tsx` | transactions-ui | No |
| `app/categories/page.tsx` | categories-ui | No |
| `app/budgets/page.tsx` | budgets-ui | No |
| `app/wealth/page.tsx` | wealth-ui | No |
| `app/fire/page.tsx` | fire-ui | No |
| `app/settings/page.tsx` | settings-ui | No |

### Library Functions (11 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `lib/supabase/client.ts` | database | No |
| `lib/supabase/server.ts` | database | Yes (3 tests - connection) |
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

No critical gaps - all API routes have comprehensive test coverage.

### HIGH

New UI components that need tests before production.

| File | Type | Reason |
|------|------|--------|
| `components/layout/Sidebar.tsx` | Component | Main navigation - critical for UX |
| `components/layout/Header.tsx` | Component | Page header - mobile menu interaction |
| `components/layout/AppLayout.tsx` | Component | Layout wrapper - affects all pages |
| `app/page.tsx` | Page | Dashboard - main landing page |

### MEDIUM

Pages and validation schemas.

| File | Type | Reason |
|------|------|--------|
| `app/transactions/page.tsx` | Page | Transaction list UI |
| `app/categories/page.tsx` | Page | Category management UI |
| `app/budgets/page.tsx` | Page | Budget dashboard UI |
| `app/wealth/page.tsx` | Page | Wealth tracker UI |
| `app/fire/page.tsx` | Page | FIRE calculator UI |
| `app/settings/page.tsx` | Page | Settings page |
| `lib/validations/accounts.ts` | Lib | Account validation schemas |
| `lib/validations/transactions.ts` | Lib | Transaction validation schemas |
| `lib/validations/categories.ts` | Lib | Category validation schemas |
| `lib/validations/budgets.ts` | Lib | Budget validation schemas |
| `lib/validations/wealth-snapshots.ts` | Lib | Wealth snapshot validation schemas |
| `lib/validations/category-mappings.ts` | Lib | Category mapping validation schemas |
| `lib/validations/fire-parameters.ts` | Lib | FIRE parameter validation schemas |

### LOW

Basic UI components with minimal logic.

| File | Type | Reason |
|------|------|--------|
| `components/Button.tsx` | Component | Basic UI component |

---

## Existing Tests

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/api/health.test.ts` | 5 | Pass |
| `tests/api/supabase-connection.test.ts` | 3 | Pass |
| `tests/api/accounts.test.ts` | 13 | Pass |
| `tests/api/transactions.test.ts` | 22 | Pass |
| `tests/api/categories.test.ts` | 14 | Pass |
| `tests/api/category-mappings.test.ts` | 19 | Pass |
| `tests/api/budgets.test.ts` | 18 | Pass |
| `tests/api/wealth-snapshots.test.ts` | 18 | Pass |
| `tests/api/fire-parameters.test.ts` | 19 | Pass |
| **Total** | **131** | **All Pass** |

---

## Recommended Test Plan

### Phase 1: Layout Component Tests (Priority: HIGH)

1. **Sidebar.test.tsx** - Navigation component tests
   - Renders all 7 navigation items
   - Highlights active route
   - Responsive behavior (collapse on mobile)
   - Navigation links work correctly

2. **Header.test.tsx** - Header component tests
   - Displays page title
   - Mobile menu button triggers sidebar
   - Responsive layout

3. **AppLayout.test.tsx** - Layout wrapper tests
   - Renders children correctly
   - Sidebar/Header integration

### Phase 2: Page E2E Tests (Priority: MEDIUM)

4. **dashboard.spec.ts** - E2E tests for dashboard
   - Page loads correctly
   - Summary cards display
   - Navigation works

5. **navigation.spec.ts** - E2E tests for app navigation
   - All routes accessible
   - Active state tracking
   - Mobile menu functionality

### Phase 3: Validation Schema Tests (Priority: MEDIUM)

6. **validations.test.ts** - Unit tests for all Zod schemas
   - Valid input passes
   - Invalid input fails with correct errors
   - Edge cases (null, undefined, empty strings)

---

## Test Generation Backlog

| Priority | File | Test Type | Suggested Test File |
|----------|------|-----------|---------------------|
| HIGH | `components/layout/Sidebar.tsx` | Unit | `tests/unit/Sidebar.test.tsx` |
| HIGH | `components/layout/Header.tsx` | Unit | `tests/unit/Header.test.tsx` |
| HIGH | `components/layout/AppLayout.tsx` | Unit | `tests/unit/AppLayout.test.tsx` |
| HIGH | `app/page.tsx` | E2E | `tests/e2e/dashboard.spec.ts` |
| MEDIUM | `app/transactions/page.tsx` | E2E | `tests/e2e/transactions.spec.ts` |
| MEDIUM | `app/categories/page.tsx` | E2E | `tests/e2e/categories.spec.ts` |
| MEDIUM | `app/budgets/page.tsx` | E2E | `tests/e2e/budgets.spec.ts` |
| MEDIUM | `app/wealth/page.tsx` | E2E | `tests/e2e/wealth.spec.ts` |
| MEDIUM | `app/fire/page.tsx` | E2E | `tests/e2e/fire.spec.ts` |
| MEDIUM | `app/settings/page.tsx` | E2E | `tests/e2e/settings.spec.ts` |
| MEDIUM | `lib/validations/*.ts` | Unit | `tests/unit/validations.test.ts` |
| LOW | `components/Button.tsx` | Unit | `tests/unit/Button.test.tsx` |

---

## Coverage Summary

| Category | Total Files | With Tests | Coverage |
|----------|-------------|------------|----------|
| API Routes | 15 | 15 | 100% |
| Components | 4 | 0 | 0% |
| Pages | 7 | 0 | 0% |
| Validations | 7 | 0 | 0% |
| **Overall** | **33** | **15** | **45%** |

---

## Next Steps

Run `/test-build high` to generate tests for HIGH priority gaps (layout components).

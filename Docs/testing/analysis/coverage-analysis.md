# Coverage Analysis

**Generated:** 2026-01-01T17:05:00+00:00
**Agent:** test-plan
**Mode:** analyze

## Summary

| Metric | Value |
|--------|-------|
| Files analysed | 49 |
| Files with tests | 26 |
| Coverage gaps | 23 |

## Boot Status

**Last run:** Today (2026-01-01T16:20:00+00:00)
**Commits since:** 0 (uncommitted changes only)
**Files changed:** 24 (uncommitted)

**Invalidations:**
- dashboard: `app/page.tsx` now has live dashboard with data visualizations
- New dashboard API routes added (summary, by-category, monthly-trend)
- New dashboard components added (SummaryCards, RecentTransactions, SpendingByCategory, MonthlyTrend)
- New useDashboardData hook added

**Effective backlog:**
- New dashboard API routes need tests
- New dashboard UI components need unit tests
- New useDashboardData hook needs unit tests
- Page E2E tests still needed

**Proceeding with mode:** analyze

---

## Source Files Discovered

### API Routes (18 files) - 83% Coverage

| File | Feature | Has Tests |
|------|---------|-----------|
| `app/api/health/route.ts` | health | Yes (5 tests) |
| `app/api/accounts/route.ts` | accounts | Yes (13 tests) |
| `app/api/accounts/[id]/route.ts` | accounts | Yes (included above) |
| `app/api/transactions/route.ts` | transactions | Yes (22 tests) |
| `app/api/transactions/[id]/route.ts` | transactions | Yes (included above) |
| `app/api/transactions/summary/route.ts` | dashboard | **No** |
| `app/api/transactions/by-category/route.ts` | dashboard | **No** |
| `app/api/transactions/monthly-trend/route.ts` | dashboard | **No** |
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

### Components (11 files) - 64% Coverage

| File | Feature | Has Tests |
|------|---------|-----------|
| `components/Button.tsx` | ui | Yes (19 tests) |
| `components/layout/Sidebar.tsx` | layout | Yes (11 tests) |
| `components/layout/Header.tsx` | layout | Yes (9 tests) |
| `components/layout/AppLayout.tsx` | layout | Yes (13 tests) |
| `components/transactions/TransactionFilters.tsx` | transactions-ui | Yes (10 tests) |
| `components/transactions/TransactionTable.tsx` | transactions-ui | Yes (8 tests) |
| `components/transactions/TransactionPagination.tsx` | transactions-ui | Yes (15 tests) |
| `components/dashboard/SummaryCards.tsx` | dashboard | **No** |
| `components/dashboard/RecentTransactions.tsx` | dashboard | **No** |
| `components/dashboard/SpendingByCategory.tsx` | dashboard | **No** |
| `components/dashboard/MonthlyTrend.tsx` | dashboard | **No** |

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

### Library Functions (13 files)

| File | Feature | Has Tests |
|------|---------|-----------|
| `lib/supabase/client.ts` | database | No |
| `lib/supabase/server.ts` | database | Yes (3 tests - connection) |
| `lib/supabase/database.types.ts` | database | N/A (types only) |
| `lib/hooks/useTransactions.ts` | transactions-ui | Yes (22 tests) |
| `lib/hooks/useDashboardData.ts` | dashboard | **No** |
| `lib/validations/accounts.ts` | validations | Yes (39 tests in validations.test.ts) |
| `lib/validations/categories.ts` | validations | Yes (included above) |
| `lib/validations/transactions.ts` | validations | Yes (included above) |
| `lib/validations/category-mappings.ts` | validations | Yes (included above) |
| `lib/validations/budgets.ts` | validations | Yes (included above) |
| `lib/validations/wealth-snapshots.ts` | validations | Yes (included above) |
| `lib/validations/fire-parameters.ts` | validations | Yes (included above) |
| `lib/validations/index.ts` | validations | N/A (re-export) |

---

## Gaps by Priority

### CRITICAL

New dashboard API routes that aggregate financial data.

| File | Type | Reason |
|------|------|--------|
| `app/api/transactions/summary/route.ts` | API | Returns totalBalance, monthIncome, monthExpenses - core dashboard data |
| `app/api/transactions/by-category/route.ts` | API | Returns spending by category - key financial insight |
| `app/api/transactions/monthly-trend/route.ts` | API | Returns 6-month income/expense trend - key financial insight |

### HIGH

New dashboard components that visualize financial data.

| File | Type | Reason |
|------|------|--------|
| `components/dashboard/SummaryCards.tsx` | Component | Displays key financial metrics |
| `components/dashboard/RecentTransactions.tsx` | Component | Shows latest transactions with formatting |
| `components/dashboard/SpendingByCategory.tsx` | Component | Category spending breakdown |
| `components/dashboard/MonthlyTrend.tsx` | Component | SVG chart for income/expense trends |
| `lib/hooks/useDashboardData.ts` | Hook | Data fetching - parallel API calls |

### MEDIUM

Pages that need E2E tests.

| File | Type | Reason |
|------|------|--------|
| `app/page.tsx` | Page | Dashboard - main landing page with live data |
| `app/transactions/page.tsx` | Page | Transaction list - has live data |
| `app/categories/page.tsx` | Page | Category management UI |
| `app/budgets/page.tsx` | Page | Budget dashboard UI |
| `app/wealth/page.tsx` | Page | Wealth tracker UI |
| `app/fire/page.tsx` | Page | FIRE calculator UI |
| `app/settings/page.tsx` | Page | Settings page |

### LOW

No low priority gaps.

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
| `tests/unit/Button.test.tsx` | 19 | Pass |
| `tests/unit/Sidebar.test.tsx` | 11 | Pass |
| `tests/unit/Header.test.tsx` | 9 | Pass |
| `tests/unit/AppLayout.test.tsx` | 13 | Pass |
| `tests/unit/TransactionFilters.test.tsx` | 10 | Pass |
| `tests/unit/TransactionTable.test.tsx` | 8 | Pass |
| `tests/unit/TransactionPagination.test.tsx` | 15 | Pass |
| `tests/unit/useTransactions.test.ts` | 22 | Pass |
| `tests/unit/validations.test.ts` | 39 | Pass |
| **Total** | **277** | **All Pass** |

---

## Recommended Test Plan

### Phase 1: Dashboard API Tests (Priority: CRITICAL)

1. **dashboard-summary.test.ts** - Summary API tests
   - Returns correct response shape
   - Calculates totalBalance from all transactions
   - Filters monthIncome/monthExpenses to current month
   - Handles empty database
   - Error handling

2. **dashboard-by-category.test.ts** - Category spending API tests
   - Returns top 8 categories
   - Only includes expenses (negative amounts)
   - Calculates percentages correctly
   - Filters by month parameter
   - Handles uncategorized transactions

3. **dashboard-monthly-trend.test.ts** - Monthly trend API tests
   - Returns correct number of months
   - Aggregates income/expenses correctly
   - Handles months param
   - Returns month labels (Jan, Feb, etc.)
   - Handles empty months

### Phase 2: Dashboard Component Tests (Priority: HIGH)

4. **SummaryCards.test.tsx** - Summary cards tests
   - Renders 4 metric cards
   - Formats currency correctly
   - Shows loading skeletons
   - Color-codes positive/negative values

5. **RecentTransactions.test.tsx** - Recent transactions tests
   - Renders transaction list
   - Formats dates and amounts
   - Shows loading skeleton
   - Shows empty state
   - Links to transactions page

6. **SpendingByCategory.test.tsx** - Category spending tests
   - Renders progress bars
   - Shows percentages
   - Handles loading state
   - Handles empty state

7. **MonthlyTrend.test.tsx** - Monthly trend chart tests
   - Renders SVG chart
   - Shows income/expense bars
   - Displays legend
   - Shows 3-month totals
   - Handles loading state

8. **useDashboardData.test.ts** - Dashboard hook tests
   - Fetches all 4 endpoints
   - Returns loading state initially
   - Handles API errors
   - Returns correct data shape

### Phase 3: Page E2E Tests (Priority: MEDIUM)

9. **dashboard.spec.ts** - E2E tests for dashboard
   - Loads with summary cards
   - Shows recent transactions
   - Shows category breakdown
   - Shows monthly trend chart

10. **transactions.spec.ts** - E2E tests for transactions page
    - Page loads with data
    - Filtering works
    - Pagination navigation

---

## Test Generation Backlog

| Priority | File | Test Type | Suggested Test File |
|----------|------|-----------|---------------------|
| CRITICAL | `app/api/transactions/summary/route.ts` | API | `tests/api/dashboard-summary.test.ts` |
| CRITICAL | `app/api/transactions/by-category/route.ts` | API | `tests/api/dashboard-by-category.test.ts` |
| CRITICAL | `app/api/transactions/monthly-trend/route.ts` | API | `tests/api/dashboard-monthly-trend.test.ts` |
| HIGH | `components/dashboard/SummaryCards.tsx` | Unit | `tests/unit/SummaryCards.test.tsx` |
| HIGH | `components/dashboard/RecentTransactions.tsx` | Unit | `tests/unit/RecentTransactions.test.tsx` |
| HIGH | `components/dashboard/SpendingByCategory.tsx` | Unit | `tests/unit/SpendingByCategory.test.tsx` |
| HIGH | `components/dashboard/MonthlyTrend.tsx` | Unit | `tests/unit/MonthlyTrend.test.tsx` |
| HIGH | `lib/hooks/useDashboardData.ts` | Unit | `tests/unit/useDashboardData.test.ts` |
| MEDIUM | `app/page.tsx` | E2E | `tests/e2e/dashboard.spec.ts` |
| MEDIUM | `app/transactions/page.tsx` | E2E | `tests/e2e/transactions.spec.ts` |
| MEDIUM | `app/categories/page.tsx` | E2E | `tests/e2e/categories.spec.ts` |
| MEDIUM | `app/budgets/page.tsx` | E2E | `tests/e2e/budgets.spec.ts` |
| MEDIUM | `app/wealth/page.tsx` | E2E | `tests/e2e/wealth.spec.ts` |
| MEDIUM | `app/fire/page.tsx` | E2E | `tests/e2e/fire.spec.ts` |
| MEDIUM | `app/settings/page.tsx` | E2E | `tests/e2e/settings.spec.ts` |

---

## Coverage Summary

| Category | Total Files | With Tests | Coverage |
|----------|-------------|------------|----------|
| API Routes | 18 | 15 | 83% |
| Components | 11 | 7 | 64% |
| Pages | 7 | 0 | 0% |
| Hooks | 2 | 1 | 50% |
| Validations | 7 | 7 | 100% |
| **Overall** | **45** | **30** | **67%** |

---

## Next Steps

Run `/test-build critical` to generate tests for CRITICAL priority gaps (dashboard API routes).

Then run `/test-build high` to generate tests for HIGH priority gaps (dashboard components and hook).

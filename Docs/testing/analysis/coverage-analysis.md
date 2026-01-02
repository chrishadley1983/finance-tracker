# Coverage Analysis

**Generated:** 2026-01-02T14:30:00+00:00
**Agent:** test-plan
**Mode:** analyze

## Summary

| Metric | Value |
|--------|-------|
| API routes | 45 |
| API routes with tests | 18 |
| Components | 47 |
| Components with tests | 23 |
| Lib functions | 35 |
| Lib functions with tests | 18 |
| **Total files analysed** | 127 |
| **Files with tests** | 59 |
| **Coverage gaps** | 68 |
| **Coverage percentage** | 46% |

## Boot Status

**Last run:** 2026-01-02T14:00:00+00:00
**Commits since:** 5 (adc36bc)
**Files changed:** 131 (Phases 3-6)

**Invalidations:**
- Major feature additions in Phases 3-6
- New CSV import system (Phase 3)
- New investment accounts (Phase 4)
- New review queue (Phase 5)
- New wealth & FIRE features (Phase 6)

**Effective backlog:**
- 27 new API routes need tests
- 24 new components need tests
- 17 new lib functions need tests

**Proceeding with mode:** analyze

---

## Gaps by Priority

### CRITICAL

Core business logic and new features from Phases 3-6 that need immediate test coverage:

| File | Type | Reason |
|------|------|--------|
| `lib/fire/calculator.ts` | lib | Core FIRE projection logic - no tests |
| `app/api/fire/calculate/route.ts` | API | FIRE calculation endpoint - user-facing |
| `app/api/wealth/net-worth/route.ts` | API | Net worth aggregation - core wealth feature |
| `app/api/wealth/history/route.ts` | API | Historical net worth data - charts depend on this |
| `app/api/import/execute/route.ts` | API | Import execution - data integrity critical |
| `app/api/transactions/review-queue/route.ts` | API | Review queue - categorisation workflow |

### HIGH

Important features that support core functionality:

| File | Type | Reason |
|------|------|--------|
| `app/api/fire/scenarios/route.ts` | API | FIRE scenario CRUD |
| `app/api/fire/scenarios/[id]/route.ts` | API | Individual scenario operations |
| `app/api/fire/inputs/route.ts` | API | User FIRE inputs |
| `app/api/investments/route.ts` | API | Investment account CRUD |
| `app/api/investments/[id]/route.ts` | API | Individual investment operations |
| `app/api/investments/[id]/valuations/route.ts` | API | Valuation management |
| `app/api/investments/[id]/valuations/bulk/route.ts` | API | Bulk valuation import |
| `app/api/investments/summary/route.ts` | API | Investment portfolio summary |
| `app/api/transactions/[id]/flag/route.ts` | API | Transaction flagging for review |
| `app/api/import/upload/route.ts` | API | CSV file upload |
| `app/api/import/preview/route.ts` | API | Import preview with parsed data |
| `app/api/import/duplicates/route.ts` | API | Duplicate detection |
| `app/api/categories/rules/route.ts` | API | Category rule management |
| `app/api/categories/rules/[id]/route.ts` | API | Individual rule operations |
| `app/api/categories/corrections/route.ts` | API | Category corrections |
| `components/fire/FireInputsForm.tsx` | component | Core FIRE input form |
| `components/fire/ProjectionChart.tsx` | component | FIRE projection visualisation |
| `components/fire/ScenarioCards.tsx` | component | Scenario selection UI |
| `components/wealth/NetWorthChart.tsx` | component | Net worth visualisation |
| `components/investments/InvestmentAccountList.tsx` | component | Investment management UI |
| `components/review/ReviewQueue.tsx` | component | Transaction review workflow |

### MEDIUM

Supporting components and utilities:

| File | Type | Reason |
|------|------|--------|
| `app/api/import/formats/route.ts` | API | Format detection endpoint |
| `app/api/import/templates/route.ts` | API | Template listing |
| `app/api/import/templates/[id]/route.ts` | API | Template CRUD |
| `app/api/import/templates/[id]/use/route.ts` | API | Apply template |
| `app/api/investments/[id]/valuations/[valuationId]/route.ts` | API | Individual valuation ops |
| `components/fire/FireSummary.tsx` | component | FIRE result summary display |
| `components/fire/ProjectionTable.tsx` | component | Year-by-year projection table |
| `components/wealth/NetWorthSummary.tsx` | component | Net worth summary cards |
| `components/wealth/AccountBalances.tsx` | component | Account breakdown display |
| `components/investments/InvestmentAccountCard.tsx` | component | Single investment display |
| `components/investments/AddAccountDialog.tsx` | component | Add investment dialog |
| `components/investments/AddValuationDialog.tsx` | component | Add valuation dialog |
| `components/investments/ValuationHistory.tsx` | component | Valuation history table |
| `components/investments/BulkImportDialog.tsx` | component | Bulk import UI |
| `components/investments/InvestmentSummaryCard.tsx` | component | Portfolio summary |
| `components/review/ReviewStats.tsx` | component | Review queue statistics |
| `components/review/ReviewToolbar.tsx` | component | Bulk review actions |
| `components/import/PreviewStep.tsx` | component | Import preview step |
| `components/import/ImportStep.tsx` | component | Final import step |
| `components/import/CategoryCell.tsx` | component | Category display in preview |
| `components/import/BulkEditMode.tsx` | component | Bulk edit mode UI |
| `components/import/CategorisedPreview.tsx` | component | Categorised transaction preview |
| `lib/import/session-store.ts` | lib | Import session management |
| `lib/import/prompts/column-mapping.ts` | lib | AI column mapping prompts |

### LOW

Type definitions and integration code (lower priority):

| File | Type | Reason |
|------|------|--------|
| `lib/types/fire.ts` | lib | Type definitions only |
| `lib/types/import.ts` | lib | Type definitions only |
| `lib/types/investment.ts` | lib | Type definitions only |
| `lib/types/index.ts` | lib | Type re-exports |
| `lib/supabase/client.ts` | lib | Browser client setup |
| `lib/supabase/server.ts` | lib | Server client setup |

---

## Source Files Discovered

### API Routes (45 files) - 40% Coverage

| File | Feature | Has Tests |
|------|---------|-----------|
| `app/api/health/route.ts` | health | Yes (5 tests) |
| `app/api/accounts/route.ts` | accounts | Yes (13 tests) |
| `app/api/accounts/[id]/route.ts` | accounts | Yes (included above) |
| `app/api/transactions/route.ts` | transactions | Yes (22 tests) |
| `app/api/transactions/[id]/route.ts` | transactions | Yes (included above) |
| `app/api/transactions/summary/route.ts` | dashboard | Yes (8 tests) |
| `app/api/transactions/by-category/route.ts` | dashboard | Yes (10 tests) |
| `app/api/transactions/monthly-trend/route.ts` | dashboard | Yes (9 tests) |
| `app/api/transactions/[id]/flag/route.ts` | review | **No** |
| `app/api/transactions/review-queue/route.ts` | review | **No** |
| `app/api/categories/route.ts` | categories | Yes (14 tests) |
| `app/api/categories/[id]/route.ts` | categories | Yes (included above) |
| `app/api/categories/rules/route.ts` | categorisation | **No** |
| `app/api/categories/rules/[id]/route.ts` | categorisation | **No** |
| `app/api/categories/corrections/route.ts` | categorisation | **No** |
| `app/api/category-mappings/route.ts` | category-mappings | Yes (19 tests) |
| `app/api/category-mappings/[id]/route.ts` | category-mappings | Yes (included above) |
| `app/api/budgets/route.ts` | budgets | Yes (18 tests) |
| `app/api/budgets/[id]/route.ts` | budgets | Yes (included above) |
| `app/api/wealth-snapshots/route.ts` | wealth-snapshots | Yes (18 tests) |
| `app/api/wealth-snapshots/[id]/route.ts` | wealth-snapshots | Yes (included above) |
| `app/api/fire-parameters/route.ts` | fire-parameters | Yes (19 tests) |
| `app/api/fire-parameters/[id]/route.ts` | fire-parameters | Yes (included above) |
| `app/api/import/upload/route.ts` | import | **No** |
| `app/api/import/formats/route.ts` | import | **No** |
| `app/api/import/preview/route.ts` | import | **No** |
| `app/api/import/duplicates/route.ts` | import | **No** |
| `app/api/import/ai-suggest/route.ts` | import | Yes (tests exist) |
| `app/api/import/categorise/route.ts` | import | Yes (tests exist) |
| `app/api/import/execute/route.ts` | import | **No** |
| `app/api/import/templates/route.ts` | import | **No** |
| `app/api/import/templates/[id]/route.ts` | import | **No** |
| `app/api/import/templates/[id]/use/route.ts` | import | **No** |
| `app/api/investments/route.ts` | investments | **No** |
| `app/api/investments/[id]/route.ts` | investments | **No** |
| `app/api/investments/summary/route.ts` | investments | **No** |
| `app/api/investments/[id]/valuations/route.ts` | investments | **No** |
| `app/api/investments/[id]/valuations/[valuationId]/route.ts` | investments | **No** |
| `app/api/investments/[id]/valuations/bulk/route.ts` | investments | **No** |
| `app/api/wealth/net-worth/route.ts` | wealth | **No** |
| `app/api/wealth/history/route.ts` | wealth | **No** |
| `app/api/fire/scenarios/route.ts` | fire | **No** |
| `app/api/fire/scenarios/[id]/route.ts` | fire | **No** |
| `app/api/fire/inputs/route.ts` | fire | **No** |
| `app/api/fire/calculate/route.ts` | fire | **No** |

### Components (47 files) - 49% Coverage

| File | Feature | Has Tests |
|------|---------|-----------|
| `components/Button.tsx` | ui | Yes (19 tests) |
| `components/layout/Sidebar.tsx` | layout | Yes (11 tests) |
| `components/layout/Header.tsx` | layout | Yes (9 tests) |
| `components/layout/AppLayout.tsx` | layout | Yes (13 tests) |
| `components/transactions/TransactionFilters.tsx` | transactions-ui | Yes (10 tests) |
| `components/transactions/TransactionTable.tsx` | transactions-ui | Yes (8 tests) |
| `components/transactions/TransactionPagination.tsx` | transactions-ui | Yes (15 tests) |
| `components/dashboard/SummaryCards.tsx` | dashboard | Yes (tests exist) |
| `components/dashboard/RecentTransactions.tsx` | dashboard | Yes (tests exist) |
| `components/dashboard/SpendingByCategory.tsx` | dashboard | Yes (tests exist) |
| `components/dashboard/MonthlyTrend.tsx` | dashboard | Yes (tests exist) |
| `components/import/ImportWizard.tsx` | import | Yes (tests exist) |
| `components/import/UploadStep.tsx` | import | Yes (tests exist) |
| `components/import/PreviewStep.tsx` | import | **No** |
| `components/import/ImportStep.tsx` | import | **No** |
| `components/import/MappingStep.tsx` | import | Yes (tests exist) |
| `components/import/CategoryConfidence.tsx` | import | Yes (tests exist) |
| `components/import/CategoryCell.tsx` | import | **No** |
| `components/import/BulkCategorise.tsx` | import | Yes (tests exist) |
| `components/import/EditableCell.tsx` | import | Yes (tests exist) |
| `components/import/BulkEditToolbar.tsx` | import | Yes (tests exist) |
| `components/import/TransactionSplitter.tsx` | import | Yes (tests exist) |
| `components/import/BulkEditMode.tsx` | import | **No** |
| `components/import/SaveTemplateDialog.tsx` | import | Yes (tests exist) |
| `components/import/TemplateSelector.tsx` | import | Yes (tests exist) |
| `components/import/TemplateManager.tsx` | import | Yes (tests exist) |
| `components/import/CategorisedPreview.tsx` | import | **No** |
| `components/import/RuleSuggestion.tsx` | import | Yes (tests exist) |
| `components/investments/InvestmentAccountCard.tsx` | investments | **No** |
| `components/investments/InvestmentAccountList.tsx` | investments | **No** |
| `components/investments/AddAccountDialog.tsx` | investments | **No** |
| `components/investments/AddValuationDialog.tsx` | investments | **No** |
| `components/investments/ValuationHistory.tsx` | investments | **No** |
| `components/investments/BulkImportDialog.tsx` | investments | **No** |
| `components/investments/InvestmentSummaryCard.tsx` | investments | **No** |
| `components/review/ReviewStats.tsx` | review | **No** |
| `components/review/ReviewToolbar.tsx` | review | **No** |
| `components/review/ReviewQueue.tsx` | review | **No** |
| `components/wealth/NetWorthSummary.tsx` | wealth | **No** |
| `components/wealth/AccountBalances.tsx` | wealth | **No** |
| `components/wealth/NetWorthChart.tsx` | wealth | **No** |
| `components/fire/FireInputsForm.tsx` | fire | **No** |
| `components/fire/ScenarioCards.tsx` | fire | **No** |
| `components/fire/FireSummary.tsx` | fire | **No** |
| `components/fire/ProjectionChart.tsx` | fire | **No** |
| `components/fire/ProjectionTable.tsx` | fire | **No** |

### Library Functions (35 files) - 51% Coverage

| File | Feature | Has Tests |
|------|---------|-----------|
| `lib/supabase/client.ts` | database | No (browser client) |
| `lib/supabase/server.ts` | database | Yes (3 tests - connection) |
| `lib/supabase/database.types.ts` | database | N/A (types only) |
| `lib/hooks/useTransactions.ts` | transactions-ui | Yes (22 tests) |
| `lib/hooks/useDashboardData.ts` | dashboard | Yes (tests exist) |
| `lib/validations/*.ts` | validations | Yes (39 tests) |
| `lib/types/*.ts` | types | N/A (types only) |
| `lib/import/parser.ts` | import | Yes (tests exist) |
| `lib/import/validators.ts` | import | Yes (tests exist) |
| `lib/import/format-detector.ts` | import | Yes (tests exist) |
| `lib/import/normalizers.ts` | import | Yes (tests exist) |
| `lib/import/ai-mapper.ts` | import | Yes (tests exist) |
| `lib/import/session-store.ts` | import | **No** |
| `lib/import/prompts/column-mapping.ts` | import | **No** |
| `lib/categorisation/rule-matcher.ts` | categorisation | Yes (tests exist) |
| `lib/categorisation/similar-lookup.ts` | categorisation | Yes (tests exist) |
| `lib/categorisation/ai-categoriser.ts` | categorisation | Yes (tests exist) |
| `lib/categorisation/engine.ts` | categorisation | Yes (tests exist) |
| `lib/categorisation/learning.ts` | categorisation | Yes (tests exist) |
| `lib/categorisation/rules-manager.ts` | categorisation | Yes (tests exist) |
| `lib/categorisation/prompts/categorise.ts` | categorisation | Yes (tests exist) |
| `lib/fire/calculator.ts` | fire | **No** |

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
| `tests/api/dashboard-summary.test.ts` | 8 | Pass |
| `tests/api/dashboard-by-category.test.ts` | 10 | Pass |
| `tests/api/dashboard-monthly-trend.test.ts` | 9 | Pass |
| `tests/api/import/ai-suggest.test.ts` | ~15 | Pass |
| `tests/api/import/categorise.test.ts` | ~20 | Pass |
| `tests/unit/Button.test.tsx` | 19 | Pass |
| `tests/unit/Sidebar.test.tsx` | 11 | Pass |
| `tests/unit/Header.test.tsx` | 9 | Pass |
| `tests/unit/AppLayout.test.tsx` | 13 | Pass |
| `tests/unit/TransactionFilters.test.tsx` | 10 | Pass |
| `tests/unit/TransactionTable.test.tsx` | 8 | Pass |
| `tests/unit/TransactionPagination.test.tsx` | 15 | Pass |
| `tests/unit/SummaryCards.test.tsx` | ~10 | Pass |
| `tests/unit/RecentTransactions.test.tsx` | ~8 | Pass |
| `tests/unit/SpendingByCategory.test.tsx` | ~8 | Pass |
| `tests/unit/MonthlyTrend.test.tsx` | ~10 | Pass |
| `tests/unit/useTransactions.test.ts` | 22 | Pass |
| `tests/unit/useDashboardData.test.ts` | ~15 | Pass |
| `tests/unit/validations.test.ts` | 39 | Pass |
| `tests/unit/import-parser.test.ts` | ~30 | Pass |
| `tests/unit/import-validators.test.ts` | ~25 | Pass |
| `tests/unit/import-format-detector.test.ts` | ~20 | Pass |
| `tests/unit/import-normalizers.test.ts` | ~15 | Pass |
| `tests/unit/import/*.test.tsx` | ~100 | Pass |
| `tests/unit/categorisation/*.test.ts` | ~150 | Pass |
| **Total** | **~852** | **All Pass** |

---

## Recommendations

### Immediate Actions (Phase 3-6 Coverage)

1. **FIRE Calculator Tests** - `lib/fire/calculator.ts`
   - Test `calculateFireProjection()` with various scenarios
   - Test `calculateCoastFi()` edge cases
   - Test inflation adjustments
   - Test FI status transitions

2. **Wealth API Tests**
   - `app/api/wealth/net-worth/route.ts` - aggregation logic
   - `app/api/wealth/history/route.ts` - period filtering

3. **Investment API Tests**
   - CRUD operations for accounts
   - Valuation management
   - Bulk import validation

4. **Review Queue Tests**
   - `app/api/transactions/review-queue/route.ts`
   - `app/api/transactions/[id]/flag/route.ts`

### Test Generation Priority Order

1. `lib/fire/calculator.ts` (unit tests)
2. `app/api/fire/calculate/route.ts` (API tests)
3. `app/api/wealth/net-worth/route.ts` (API tests)
4. `app/api/investments/route.ts` (API tests)
5. `app/api/transactions/review-queue/route.ts` (API tests)
6. `components/fire/*` (component tests)
7. `components/wealth/*` (component tests)
8. `components/investments/*` (component tests)

---

## Test Generation Backlog

```json
{
  "critical": [
    "lib/fire/calculator.ts",
    "app/api/fire/calculate/route.ts",
    "app/api/wealth/net-worth/route.ts",
    "app/api/wealth/history/route.ts",
    "app/api/import/execute/route.ts",
    "app/api/transactions/review-queue/route.ts"
  ],
  "high": [
    "app/api/fire/scenarios/route.ts",
    "app/api/fire/inputs/route.ts",
    "app/api/investments/route.ts",
    "app/api/investments/summary/route.ts",
    "app/api/transactions/[id]/flag/route.ts",
    "app/api/import/upload/route.ts",
    "app/api/import/preview/route.ts",
    "app/api/categories/rules/route.ts",
    "components/fire/FireInputsForm.tsx",
    "components/fire/ProjectionChart.tsx",
    "components/wealth/NetWorthChart.tsx",
    "components/investments/InvestmentAccountList.tsx",
    "components/review/ReviewQueue.tsx"
  ],
  "medium": 24,
  "low": 6
}
```

---

## Next Steps

Run `/test-build critical` to generate tests for CRITICAL priority gaps (FIRE calculator, wealth API, review queue).

Then run `/test-build high` to generate tests for HIGH priority gaps (investments, FIRE scenarios, import routes).

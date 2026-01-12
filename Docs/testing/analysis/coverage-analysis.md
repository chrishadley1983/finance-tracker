# Coverage Analysis

**Generated:** 2026-01-04T12:00:00+00:00
**Agent:** test-plan
**Mode:** analyze

## Summary

| Metric | Value |
|--------|-------|
| API routes | 61 |
| API routes with tests | 23 |
| Components | 80 |
| Components with tests | 30 |
| Lib functions | 43 |
| Lib functions with tests | 25 |
| **Total files analysed** | 184 |
| **Files with tests** | 78 |
| **Coverage gaps** | 106 |
| **Coverage percentage** | 42% |

## Boot Status

**Last run:** 2026-01-02T14:30:00+00:00
**Current run:** 2026-01-04T12:00:00+00:00
**Commits since:** 6 (d5c18fc0)
**Files changed:** 72

**Invalidations:**
- Monthly snapshot entry changes (exclude_from_snapshots feature)
- Account card display logic changes (investment vs transactional accounts)
- Monthly trend API period parameter support
- Dashboard hook timeframe handling

**Effective backlog:**
- 38 new/untested API routes
- 50 new/untested components
- 18 new/untested lib functions

**Proceeding with mode:** analyze

---

## Gaps by Priority

### CRITICAL (6 gaps)

Core business logic and user-facing features that need immediate test coverage:

| File | Type | Reason |
|------|------|--------|
| `app/api/fire/calculate/route.ts` | API | FIRE calculation endpoint - user-facing projections |
| `app/api/fire/coast/route.ts` | API | Coast FIRE calculations - new feature |
| `app/api/wealth/net-worth/route.ts` | API | Net worth aggregation - core wealth feature |
| `app/api/wealth/history/route.ts` | API | Historical net worth data - charts depend on this |
| `app/api/investments/route.ts` | API | Investment account CRUD - core data management |
| `app/api/transactions/bulk/route.ts` | API | Bulk transaction operations - data integrity |

### HIGH (21 gaps)

Important features that support core functionality:

| File | Type | Reason |
|------|------|--------|
| `app/api/fire/scenarios/route.ts` | API | FIRE scenario CRUD |
| `app/api/fire/scenarios/[id]/route.ts` | API | Individual scenario operations |
| `app/api/fire/inputs/route.ts` | API | User FIRE inputs |
| `app/api/investments/[id]/route.ts` | API | Individual investment operations |
| `app/api/investments/[id]/valuations/route.ts` | API | Valuation management |
| `app/api/investments/[id]/valuations/bulk/route.ts` | API | Bulk valuation import |
| `app/api/investments/summary/route.ts` | API | Investment portfolio summary |
| `app/api/accounts/summary/route.ts` | API | Account type balances for dashboard |
| `app/api/accounts/reorder/route.ts` | API | Account display order |
| `app/api/accounts/[id]/reallocate/route.ts` | API | Move transactions between accounts |
| `app/api/budgets/bulk/route.ts` | API | Bulk budget operations |
| `app/api/budgets/comparison/route.ts` | API | Budget vs actual comparison |
| `app/api/budgets/copy-year/route.ts` | API | Copy budget year |
| `app/api/budgets/savings-rate/route.ts` | API | Savings rate calculation |
| `app/api/category-groups/route.ts` | API | Category group CRUD |
| `app/api/category-groups/[id]/route.ts` | API | Individual group operations |
| `app/api/categories/[id]/reassign/route.ts` | API | Reassign category transactions |
| `app/api/transactions/income-by-category/route.ts` | API | Income breakdown by category |
| `components/fire/FireInputsForm.tsx` | component | Core FIRE input form |
| `components/fire/ProjectionChart.tsx` | component | FIRE projection visualisation |
| `components/wealth/NetWorthChart.tsx` | component | Net worth visualisation |

### MEDIUM (24 gaps)

Supporting components and utilities:

| File | Type | Reason |
|------|------|--------|
| `app/api/import/formats/route.ts` | API | Format detection endpoint |
| `app/api/import/templates/route.ts` | API | Template listing |
| `app/api/import/templates/[id]/route.ts` | API | Template CRUD |
| `app/api/import/templates/[id]/use/route.ts` | API | Apply template |
| `app/api/import/preview/route.ts` | API | Import preview |
| `app/api/import/duplicates/route.ts` | API | Duplicate detection |
| `app/api/budgets/sync/route.ts` | API | Budget synchronisation |
| `app/api/category-groups/reorder/route.ts` | API | Group ordering |
| `app/api/categories/rules/route.ts` | API | Category rules CRUD |
| `app/api/categories/rules/[id]/route.ts` | API | Individual rule operations |
| `app/api/categories/corrections/route.ts` | API | Category corrections |
| `components/fire/FireSummary.tsx` | component | FIRE result summary display |
| `components/fire/ProjectionTable.tsx` | component | Year-by-year projection table |
| `components/fire/ScenarioCards.tsx` | component | Scenario selection UI |
| `components/wealth/NetWorthSummary.tsx` | component | Net worth summary cards |
| `components/wealth/AccountBalances.tsx` | component | Account breakdown display |
| `components/wealth/MonthlySnapshotForm.tsx` | component | Snapshot entry form |
| `components/wealth/SnapshotHistoryTable.tsx` | component | Snapshot history |
| `components/wealth/CoastFireCard.tsx` | component | Coast FIRE display |
| `components/wealth/CoastFireSettings.tsx` | component | Coast FIRE settings |
| `components/dashboard/IncomeByCategory.tsx` | component | Income breakdown chart |
| `components/dashboard/NetWorthSummary.tsx` | component | Dashboard net worth |
| `components/dashboard/TimeframeSelector.tsx` | component | Timeframe selection |
| `lib/hooks/useBudgets.ts` | lib | Budget data hook |

### LOW (6 gaps)

Type definitions and integration code (lower priority):

| File | Type | Reason |
|------|------|--------|
| `lib/types/fire.ts` | lib | Type definitions only |
| `lib/types/budget.ts` | lib | Type definitions only |
| `lib/types/category.ts` | lib | Type definitions only |
| `lib/utils/budget-export.ts` | lib | Budget export utilities |
| `lib/validations/category-groups.ts` | lib | Validation schemas |
| `lib/import/session-store.ts` | lib | Import session management |

---

## Source Files Discovered

### API Routes (61 files) - 38% Coverage

#### accounts/ (5 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/accounts/route.ts` | ✅ Yes | 13 tests in accounts.test.ts |
| `app/api/accounts/[id]/route.ts` | ✅ Yes | Included above |
| `app/api/accounts/summary/route.ts` | ❌ No | Account type balances |
| `app/api/accounts/reorder/route.ts` | ❌ No | Display order |
| `app/api/accounts/[id]/reallocate/route.ts` | ❌ No | Move transactions |

#### budgets/ (7 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/budgets/route.ts` | ✅ Yes | 18 tests in budgets.test.ts |
| `app/api/budgets/[id]/route.ts` | ✅ Yes | Included above |
| `app/api/budgets/bulk/route.ts` | ❌ No | Bulk operations |
| `app/api/budgets/comparison/route.ts` | ❌ No | Budget vs actual |
| `app/api/budgets/copy-year/route.ts` | ❌ No | Year copy |
| `app/api/budgets/savings-rate/route.ts` | ❌ No | Savings rate |
| `app/api/budgets/sync/route.ts` | ❌ No | Synchronisation |

#### categories/ (6 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/categories/route.ts` | ✅ Yes | 14 tests in categories.test.ts |
| `app/api/categories/[id]/route.ts` | ✅ Yes | Included above |
| `app/api/categories/corrections/route.ts` | ❌ No | Corrections |
| `app/api/categories/rules/route.ts` | ❌ No | Rules CRUD |
| `app/api/categories/rules/[id]/route.ts` | ❌ No | Individual rules |
| `app/api/categories/[id]/reassign/route.ts` | ❌ No | Reassign transactions |

#### category-groups/ (3 routes) - NEW
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/category-groups/route.ts` | ❌ No | Group CRUD |
| `app/api/category-groups/[id]/route.ts` | ❌ No | Individual group |
| `app/api/category-groups/reorder/route.ts` | ❌ No | Group ordering |

#### fire/ (5 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/fire/calculate/route.ts` | ✅ Yes | 4 tests |
| `app/api/fire/coast/route.ts` | ❌ No | Coast FIRE calcs |
| `app/api/fire/inputs/route.ts` | ❌ No | FIRE inputs |
| `app/api/fire/scenarios/route.ts` | ❌ No | Scenarios CRUD |
| `app/api/fire/scenarios/[id]/route.ts` | ❌ No | Individual scenario |

#### import/ (11 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/import/upload/route.ts` | ❌ No | File upload |
| `app/api/import/upload-pdf/route.ts` | ✅ Yes | PDF upload tests |
| `app/api/import/formats/route.ts` | ❌ No | Format detection |
| `app/api/import/preview/route.ts` | ❌ No | Preview |
| `app/api/import/duplicates/route.ts` | ❌ No | Duplicates |
| `app/api/import/ai-suggest/route.ts` | ✅ Yes | AI suggest tests |
| `app/api/import/categorise/route.ts` | ✅ Yes | Categorise tests |
| `app/api/import/execute/route.ts` | ✅ Yes | Execute tests |
| `app/api/import/templates/route.ts` | ❌ No | Templates |
| `app/api/import/templates/[id]/route.ts` | ❌ No | Individual template |
| `app/api/import/templates/[id]/use/route.ts` | ❌ No | Use template |

#### investments/ (6 routes) - ALL UNTESTED
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/investments/route.ts` | ❌ No | Account CRUD |
| `app/api/investments/[id]/route.ts` | ❌ No | Individual account |
| `app/api/investments/summary/route.ts` | ❌ No | Portfolio summary |
| `app/api/investments/[id]/valuations/route.ts` | ❌ No | Valuations |
| `app/api/investments/[id]/valuations/bulk/route.ts` | ❌ No | Bulk import |
| `app/api/investments/[id]/valuations/[valuationId]/route.ts` | ❌ No | Individual valuation |

#### transactions/ (8 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/transactions/route.ts` | ✅ Yes | 22 tests |
| `app/api/transactions/[id]/route.ts` | ✅ Yes | Included above |
| `app/api/transactions/summary/route.ts` | ✅ Yes | 8 tests |
| `app/api/transactions/by-category/route.ts` | ✅ Yes | 10 tests |
| `app/api/transactions/monthly-trend/route.ts` | ✅ Yes | 9 tests |
| `app/api/transactions/bulk/route.ts` | ❌ No | Bulk operations |
| `app/api/transactions/income-by-category/route.ts` | ❌ No | Income breakdown |
| `app/api/transactions/review-queue/route.ts` | ✅ Yes | 11 tests |
| `app/api/transactions/[id]/flag/route.ts` | ❌ No | Flagging |

#### wealth/ (2 routes)
| File | Has Tests | Notes |
|------|-----------|-------|
| `app/api/wealth/net-worth/route.ts` | ✅ Yes | Net worth tests |
| `app/api/wealth/history/route.ts` | ✅ Yes | History tests |

---

### Components (80 files) - 38% Coverage

#### accounts/ (6 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/accounts/AccountCard.tsx` | ❌ No |
| `components/accounts/AccountDialog.tsx` | ❌ No |
| `components/accounts/AccountFilters.tsx` | ❌ No |
| `components/accounts/AccountList.tsx` | ❌ No |
| `components/accounts/DeleteAccountDialog.tsx` | ❌ No |
| `components/accounts/ReallocateDialog.tsx` | ❌ No |

#### budgets/ (7 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/budgets/BudgetBulkEditDialog.tsx` | ❌ No |
| `components/budgets/BudgetEditDialog.tsx` | ❌ No |
| `components/budgets/BudgetGroupTable.tsx` | ❌ No |
| `components/budgets/BudgetSummaryCards.tsx` | ❌ No |
| `components/budgets/CopyBudgetDialog.tsx` | ❌ No |
| `components/budgets/ExportMenu.tsx` | ❌ No |
| `components/budgets/MonthSelector.tsx` | ❌ No |
| `components/budgets/ViewToggle.tsx` | ❌ No |

#### categories/ (10 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/categories/CategoryCard.tsx` | ❌ No |
| `components/categories/CategoryDialog.tsx` | ❌ No |
| `components/categories/CategoryFilters.tsx` | ❌ No |
| `components/categories/CategoryGroupList.tsx` | ❌ No |
| `components/categories/ColourPicker.tsx` | ❌ No |
| `components/categories/DeleteCategoryDialog.tsx` | ❌ No |
| `components/categories/GroupDialog.tsx` | ❌ No |
| `components/categories/ReassignCategoryDialog.tsx` | ❌ No |
| `components/categories/RuleCard.tsx` | ❌ No |
| `components/categories/RuleDialog.tsx` | ❌ No |
| `components/categories/RulesPanel.tsx` | ❌ No |

#### dashboard/ (7 components) - 71% Coverage
| File | Has Tests |
|------|-----------|
| `components/dashboard/SummaryCards.tsx` | ✅ Yes |
| `components/dashboard/RecentTransactions.tsx` | ✅ Yes |
| `components/dashboard/SpendingByCategory.tsx` | ✅ Yes |
| `components/dashboard/MonthlyTrend.tsx` | ✅ Yes |
| `components/dashboard/IncomeByCategory.tsx` | ❌ No |
| `components/dashboard/NetWorthSummary.tsx` | ❌ No |
| `components/dashboard/TimeframeSelector.tsx` | ❌ No |

#### fire/ (5 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/fire/FireInputsForm.tsx` | ❌ No |
| `components/fire/FireSummary.tsx` | ❌ No |
| `components/fire/ProjectionChart.tsx` | ❌ No |
| `components/fire/ProjectionTable.tsx` | ❌ No |
| `components/fire/ScenarioCards.tsx` | ❌ No |

#### import/ (16 components) - 75% Coverage
| File | Has Tests |
|------|-----------|
| `components/import/ImportWizard.tsx` | ✅ Yes |
| `components/import/UploadStep.tsx` | ✅ Yes |
| `components/import/MappingStep.tsx` | ✅ Yes |
| `components/import/PreviewStep.tsx` | ❌ No |
| `components/import/BulkCategorise.tsx` | ✅ Yes |
| `components/import/BulkEditMode.tsx` | ❌ No |
| `components/import/BulkEditToolbar.tsx` | ✅ Yes |
| `components/import/CategorisedPreview.tsx` | ❌ No |
| `components/import/CategoryCell.tsx` | ❌ No |
| `components/import/CategoryConfidence.tsx` | ✅ Yes |
| `components/import/EditableCell.tsx` | ✅ Yes |
| `components/import/ImportStep.tsx` | ❌ No |
| `components/import/RuleSuggestion.tsx` | ✅ Yes |
| `components/import/SaveTemplateDialog.tsx` | ✅ Yes |
| `components/import/TemplateManager.tsx` | ✅ Yes |
| `components/import/TemplateSelector.tsx` | ✅ Yes |
| `components/import/TransactionSplitter.tsx` | ✅ Yes |

#### investments/ (7 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/investments/AddAccountDialog.tsx` | ❌ No |
| `components/investments/AddValuationDialog.tsx` | ❌ No |
| `components/investments/BulkImportDialog.tsx` | ❌ No |
| `components/investments/InvestmentAccountCard.tsx` | ❌ No |
| `components/investments/InvestmentAccountList.tsx` | ❌ No |
| `components/investments/InvestmentSummaryCard.tsx` | ❌ No |
| `components/investments/ValuationHistory.tsx` | ❌ No |

#### layout/ (3 components) - 100% Coverage
| File | Has Tests |
|------|-----------|
| `components/layout/AppLayout.tsx` | ✅ Yes |
| `components/layout/Header.tsx` | ✅ Yes |
| `components/layout/Sidebar.tsx` | ✅ Yes |

#### review/ (3 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/review/ReviewQueue.tsx` | ❌ No |
| `components/review/ReviewStats.tsx` | ❌ No |
| `components/review/ReviewToolbar.tsx` | ❌ No |

#### transactions/ (5 components) - 60% Coverage
| File | Has Tests |
|------|-----------|
| `components/transactions/TransactionFilters.tsx` | ✅ Yes |
| `components/transactions/TransactionTable.tsx` | ✅ Yes |
| `components/transactions/TransactionPagination.tsx` | ✅ Yes |
| `components/transactions/TransactionEditModal.tsx` | ❌ No |
| `components/transactions/TransactionToolbar.tsx` | ❌ No |

#### ui/ (1 component)
| File | Has Tests |
|------|-----------|
| `components/ui/ConfirmDialog.tsx` | ❌ No |

#### wealth/ (6 components) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `components/wealth/AccountBalances.tsx` | ❌ No |
| `components/wealth/CoastFireCard.tsx` | ❌ No |
| `components/wealth/CoastFireSettings.tsx` | ❌ No |
| `components/wealth/MonthlySnapshotForm.tsx` | ❌ No |
| `components/wealth/NetWorthChart.tsx` | ❌ No |
| `components/wealth/NetWorthSummary.tsx` | ❌ No |
| `components/wealth/SnapshotHistoryTable.tsx` | ❌ No |

---

### Library Functions (43 files) - 58% Coverage

#### categorisation/ (7 files) - 100% Coverage
| File | Has Tests |
|------|-----------|
| `lib/categorisation/ai-categoriser.ts` | ✅ Yes |
| `lib/categorisation/engine.ts` | ✅ Yes |
| `lib/categorisation/index.ts` | ✅ Yes |
| `lib/categorisation/learning.ts` | ✅ Yes |
| `lib/categorisation/rule-matcher.ts` | ✅ Yes |
| `lib/categorisation/rules-manager.ts` | ✅ Yes |
| `lib/categorisation/similar-lookup.ts` | ✅ Yes |
| `lib/categorisation/prompts/categorise.ts` | ✅ Yes |

#### fire/ (1 file)
| File | Has Tests |
|------|-----------|
| `lib/fire/calculator.ts` | ✅ Yes (42 tests) |

#### hooks/ (3 files) - 67% Coverage
| File | Has Tests |
|------|-----------|
| `lib/hooks/useDashboardData.ts` | ✅ Yes |
| `lib/hooks/useTransactions.ts` | ✅ Yes |
| `lib/hooks/useBudgets.ts` | ❌ No |

#### import/ (10 files) - 80% Coverage
| File | Has Tests |
|------|-----------|
| `lib/import/ai-mapper.ts` | ✅ Yes |
| `lib/import/format-detector.ts` | ✅ Yes |
| `lib/import/index.ts` | ✅ Yes |
| `lib/import/normalizers.ts` | ✅ Yes |
| `lib/import/parser.ts` | ✅ Yes |
| `lib/import/pdf-extractor.ts` | ✅ Yes |
| `lib/import/pdf-vision-parser.ts` | ✅ Yes |
| `lib/import/session-store.ts` | ❌ No |
| `lib/import/validators.ts` | ✅ Yes |
| `lib/import/prompts/column-mapping.ts` | ❌ No |
| `lib/import/prompts/pdf-statement.ts` | ✅ Yes |

#### utils/ (1 file) - 0% COVERAGE
| File | Has Tests |
|------|-----------|
| `lib/utils/budget-export.ts` | ❌ No |

#### validations/ (9 files) - Partial Coverage
| File | Has Tests |
|------|-----------|
| `lib/validations/accounts.ts` | ✅ Partial |
| `lib/validations/budgets.ts` | ✅ Partial |
| `lib/validations/categories.ts` | ✅ Partial |
| `lib/validations/category-groups.ts` | ❌ No |
| `lib/validations/category-mappings.ts` | ✅ Partial |
| `lib/validations/fire-parameters.ts` | ✅ Partial |
| `lib/validations/import.ts` | ✅ Partial |
| `lib/validations/transactions.ts` | ✅ Partial |
| `lib/validations/wealth-snapshots.ts` | ✅ Partial |

---

## Existing Tests Summary

| Category | Test Files | Test Count | Status |
|----------|------------|------------|--------|
| API tests | 20 | ~220 | ✅ Pass |
| Unit tests - components | 25 | ~180 | ✅ Pass |
| Unit tests - lib | 20 | ~450 | ✅ Pass |
| **Total** | **65** | **~850** | **All Pass** |

---

## Recommendations

### Immediate Actions

1. **Investment API Tests** (CRITICAL)
   - Create `tests/api/investments.test.ts`
   - Cover CRUD operations, valuations, bulk import
   - Estimated: 25-30 tests

2. **Budget Extended API Tests** (HIGH)
   - Create tests for bulk, comparison, copy-year, savings-rate, sync
   - Estimated: 20-25 tests

3. **Category Groups API Tests** (HIGH)
   - Create `tests/api/category-groups.test.ts`
   - Cover CRUD and reorder
   - Estimated: 15-20 tests

4. **FIRE Extended Tests** (HIGH)
   - Add tests for coast, inputs, scenarios endpoints
   - Estimated: 20-25 tests

### Component Test Priorities

1. **Fire components** - Critical user-facing features
2. **Wealth components** - Core wealth tracking UI
3. **Accounts components** - Account management UI
4. **Budget components** - Budget management UI

### Test Generation Priority Order

```json
{
  "critical": [
    "app/api/investments/route.ts",
    "app/api/fire/coast/route.ts",
    "app/api/transactions/bulk/route.ts"
  ],
  "high": [
    "app/api/budgets/bulk/route.ts",
    "app/api/budgets/comparison/route.ts",
    "app/api/category-groups/route.ts",
    "app/api/accounts/summary/route.ts",
    "app/api/fire/inputs/route.ts",
    "app/api/fire/scenarios/route.ts"
  ],
  "component_priority": [
    "components/fire/*",
    "components/wealth/*",
    "components/accounts/*",
    "components/budgets/*",
    "components/categories/*"
  ]
}
```

---

## Next Steps

1. Run `/test-build critical` to generate tests for CRITICAL priority gaps
2. Run `/test-build high` to generate tests for HIGH priority gaps
3. Run `/test-execute quick` to validate new tests pass

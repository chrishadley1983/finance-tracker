# Import Data Normalization Fix

## Problem Summary

The import has mismatches between:
1. **Mapping sheet categories** → Transaction categories (5 mismatches)
2. **Budget sheet categories** → Transaction categories (21 mismatches, many are TOTAL rows)
3. **2023 Transaction accounts** → Account names (different naming convention)

## Fix 1: Category Name Normalization

Add this mapping to `scripts/import-spreadsheet.ts` to normalize category names:

```typescript
// Category name normalization - maps various source names to the canonical transaction category name
const categoryNameMap: Record<string, string> = {
  // Mapping sheet → Transaction categories
  'Car Running Costs': 'Car Servicing',
  'Child & Dependent Expenses': 'Childcare',
  'Household Insurance': 'Household insurance',
  'Bills and utilities': 'Bills',
  'mortgages': 'Mortgage',
  
  // Budget sheet → Transaction categories  
  'House Insurance': 'Household insurance',
  'Mortgage': 'Mortgage',
  'Drinks': 'Coffee',  // or could map to Eating Out
  'Car Tax': 'Car running costs',
  'Pension / Shares': 'Income',
  
  // Case normalization (transaction data has inconsistent casing)
  'Eating Out': 'Eating out',
  'Gift In': 'Gift in',
  'Home Improvement': 'Home improvement',
  'Personal Care': 'Personal care',
  'Cleaner': 'cleaner',
};

// Helper function to normalize category names
function normalizeCategory(name: string): string {
  const trimmed = name.trim();
  return categoryNameMap[trimmed] || trimmed;
}
```

## Fix 2: Account Name Normalization

Add this mapping for 2023 transaction accounts:

```typescript
// Account name normalization - maps 2023 sheet names to canonical names
const accountNameMap: Record<string, string> = {
  'HSBC Current Account': 'HSBC Current Account',
  'HSBC Credit Card': 'HSBC Credit Card',
  'HSBC Savings Acc 1': 'HSBC Savings Acc 1',
  'HADLEY,C J/MR': 'Hadley C PRN',  // Appears to be same account
  'HSBC Global Money Account': 'HSBC Global Money Account',
  'Hadley C PRN': 'Hadley C PRN',
  'Hadley C PRC': 'Hadley C PRC',
};

// Helper function to normalize account names
function normalizeAccount(name: string): string {
  const trimmed = name.trim();
  return accountNameMap[trimmed] || trimmed;
}
```

## Fix 3: Skip Budget TOTAL Rows

The Budget sheet has rows like "Car - TOTAL", "Food - TOTAL" etc. These should be skipped:

```typescript
// In importBudgets function, skip TOTAL rows
if (categoryName.includes('TOTAL') || 
    categoryName.includes('Planned') || 
    categoryName === 'Income Category') {
  skipped++;
  continue;
}
```

## Fix 4: Update Import Functions

### In `importCategories`:
```typescript
// Before adding to categories map
const normalizedName = normalizeCategory(row.CATEGORY.trim());
categories.set(normalizedName, row['CATEGORY GROUP'].trim());
```

### In `importCategoryMappings`:
```typescript
// Before looking up category
const normalizedCategoryName = normalizeCategory(categoryName);
const categoryId = categoryMap.get(normalizedCategoryName);
```

### In `importTransactions`:
```typescript
// Before looking up account and category
const normalizedAccount = normalizeAccount(row.ACCOUNT.trim());
const accountId = accountMap.get(normalizedAccount);

const normalizedCategory = row.CATEGORY ? normalizeCategory(row.CATEGORY.trim()) : null;
const categoryId = normalizedCategory ? categoryMap.get(normalizedCategory) : null;
```

### In `importBudgets`:
```typescript
// Before looking up category
const normalizedCategoryName = normalizeCategory(categoryName);
const categoryId = categoryMap.get(normalizedCategoryName);
```

## Fix 5: Ensure All Accounts Created

Add these accounts explicitly if not found in transactions:

```typescript
const additionalAccounts = [
  'HSBC Credit Card',
  'HSBC Savings Acc 1', 
  'HSBC Global Money Account',
  'Hadley C PRC',
];
```

---

## Implementation Steps

1. Clear existing data (or create fresh Supabase tables)
2. Update `scripts/import-spreadsheet.ts` with the normalizations above
3. Re-run the import
4. Verify counts match expected totals

## Expected Results After Fix

| Table | Expected |
|-------|----------|
| accounts | ~18 (14 + 4 new) |
| categories | ~45 |
| category_mappings | ~40+ (was 28) |
| transactions | ~6,800+ (was 5,311) |
| wealth_snapshots | 725 |
| fire_parameters | 4 |
| budgets | ~400+ (was 0) |

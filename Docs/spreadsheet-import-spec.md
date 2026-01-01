# Spreadsheet Import Specification

## Source File
`Life_Planning_V2.xlsx` - Copy to project root or `data/` folder

## Data to Import

### 1. Transactions (5,431 rows)
**Source Sheet:** `Latest Transactions`

| Spreadsheet Column | Database Field | Notes |
|-------------------|----------------|-------|
| DATE | date | Date format |
| AMOUNT | amount | Negative = expense |
| DESCRIPTION | description | |
| CATEGORY | category_id | Lookup/create category |
| CATEGORY GROUP | categories.group_name | For category creation |
| ACCOUNT | account_id | Lookup/create account |
| NOTES | (ignore for now) | |

**Also import from:** `2023 Transactions` sheet (1,568 rows) - may have duplicates with Latest Transactions

### 2. Categories (~40 unique)
**Extract from:** Transaction CATEGORY and CATEGORY GROUP columns

Create categories from unique CATEGORY values, with group_name from CATEGORY GROUP.

### 3. Category Mappings (50 rules)
**Source Sheet:** `Mapping`

| Spreadsheet Column | Database Field |
|-------------------|----------------|
| Spreadsheet mapping | pattern |
| MoneyHub Level 2 | category_id (lookup) |
| Type | match_type (if 'Custom' = exact, else contains) |

### 4. Accounts
**Extract from:** Transaction ACCOUNT column

Known accounts:
- Hadley C PRN
- HSBC Current Account
- (others from data)

### 5. Wealth Snapshots (108 months)
**Source Sheet:** `Wealth Tracker`

| Spreadsheet Column | Database Field | Account Type |
|-------------------|----------------|--------------|
| Wealth (date column) | date | - |
| CH ACN Pens | balance | pension |
| Chris SIPP | balance | pension |
| AH Pension | balance | pension |
| CH ISA | balance | isa |
| AH ISA | balance | isa |
| Bus Savings | balance | savings |
| Other Savings | balance | savings |
| ACN Shares | balance | investment |
| Cash Position | balance | current |
| Mortgage | balance | property (negative) |
| House Net Worth | balance | property |

### 6. FIRE Parameters
**Source Sheet:** `Inputs`

| Parameter | Database Field |
|-----------|----------------|
| FULL (63000) | annual_spend (scenario: FULL) |
| HIGH (63000) | annual_spend (scenario: HIGH) |
| MEDIUM (50000) | annual_spend (scenario: MEDIUM) |
| LOW (35000) | annual_spend (scenario: LOW) |
| Base SWR (3.5) | withdrawal_rate |
| Assumed Return (3) | expected_return |
| Retire Age (50) | retirement_age |

### 7. Budgets
**Source Sheet:** `Budget 2025` and `Budget 2024`

| Column | Database Field |
|--------|----------------|
| Expense Category | category_id (lookup) |
| 2025 Budget | amount (monthly) |
| Month columns | For actual vs budget tracking |

---

## Import Order (Dependencies)

1. **Accounts** - Create from transaction data + wealth tracker columns
2. **Categories** - Create from unique transaction categories
3. **Category Mappings** - After categories exist
4. **Transactions** - After accounts and categories
5. **Wealth Snapshots** - After accounts
6. **FIRE Parameters** - No dependencies
7. **Budgets** - After categories

---

## Deduplication Notes

- `Latest Transactions` and `2023 Transactions` may overlap
- Use DATE + AMOUNT + DESCRIPTION as composite key for dedup
- Wealth snapshots: one row per month per account

---

## Import Script Requirements

1. Create `scripts/import-spreadsheet.ts`
2. Use `xlsx` or `exceljs` npm package to read Excel
3. Run as: `npx ts-node scripts/import-spreadsheet.ts`
4. Log progress and any skipped/failed rows
5. Handle errors gracefully (continue on individual row failure)

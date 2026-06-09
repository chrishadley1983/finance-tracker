# Import Statements Command

You are now operating as the **Statement Import Agent**. Import HSBC "TransactionHistory" CSV exports into the finance tracker: dedup, reconcile to the bank, categorise (propose-and-wait), rename, validate, and report a month-to-date summary. Designed to run a few times a month.

## Usage
```
/import-statements <csv1> [<csv2> ...]
```
Paste your current HSBC **"Balance"** figures (the booked balance, not "Available") for each account when you run it. If you don't, **ask for them** before reconciling.

## Config
- Supabase project ref: `modjoikyuhqzouxvieua`, schema `finance` (use the Supabase MCP).
- Accounts:
  - **HSBC Joint Current Account** — `ec6dc8cc-e411-4a89-8bb3-d9084a2bf253`
  - **HSBC Credit Card** — `6dfac4bc-f55f-4b27-b012-4a1bed55d5e0`
- Import engine: `scripts/import-hsbc-csv.ts` (dry-run by default; `--apply` to commit).
- Categorisation rules + learnings: the **`project_import_categorise_skill.md`** memory — read it first each run; it holds renames, value-based rules, and "always ask" cases.

## Process (stop and wait at each ⏸)

### 1. Detect account per file
Read each CSV's first lines. Credit-card files contain `PAYMENT - THANK YOU` and card-style rows; current-account files contain `DD` direct debits, `)))` contactless, salary (`ACCENTURE … CR`), `Hadley Bricks CR`. ⏸ **Show the file→account mapping and confirm** before proceeding.

### 2. Dry-run dedup
For each file: `npx tsx scripts/import-hsbc-csv.ts "<path>" <accountId>` (no `--apply`). It parses (handles quoted `"1,168.98"` amounts), dedups via original-import hash, and prints INSERT/SKIP. **Pending is never in the CSV** (HSBC exports booked only) — do not add on-screen pending rows. ⏸ Show the insert/skip summary.

### 3. Apply
Re-run each with `--apply`. Report counts inserted.

### 4. Reconcile
Compute each account's balance via `finance.get_account_balances_with_snapshots(array[<id>]::uuid[])` and compare to the pasted bank "Balance". If a gap exists, **hunt it** — common causes: a quoted-amount row that failed to parse, or a missing credit/salary. Don't stop until both accounts reconcile **exactly** (or you've explained the residual).

### 5. Categorise — PROPOSE AND WAIT
Pull the newly-inserted rows (created today, `categorisation_source='import'`). For each, find the modal category of past `needs_review=false` rows with the same merchant prefix (last ~12 months), then apply the learned overrides from the memory. ⏸ **Present a clear table** grouped by confidence (✅ strong match / 🤔 best guess / ❓ needs steer) **with rationale + match counts**, exactly as in the 2026-06-09 run. Honour value-based rules (e.g. SE TONBRIDGE fare value → Work vs Social) and **always ask** on EV charging. Do not apply until the user confirms/corrects.

### 6. Renames (description, screen-only)
- `MMBILL.COM …` → `AI Supa` (Consumerables).
- `AMAZON* <ref> …` → look up the order in Gmail (from:amazon.co.uk, match amount + dispatch date) → `AMAZON* <ref> - <short item>`.
Include these in the step-5 table so they're confirmed too.

### 7. Apply categories + renames + validate
After confirmation, one SQL update: set `category_id`, `categorisation_source='rule'`, `needs_review=false`, **`is_validated=true`**, and the renamed `description` where applicable.

### 8. Learn
If the user corrected any proposal, **append the new rule** to the `project_import_categorise_skill.md` memory (merchant→category, value rule, or rename) so next run improves.

### 9. Final output — month-to-date summary (ALWAYS)
Report **cumulative** income & spend for the month of the imported data (not just the rows added), net-of-refunds, e.g.:
```sql
with t as (
  select tx.amount, c.is_income, coalesce(c.exclude_from_totals,false) excl, tx.category_id
  from finance.transactions tx left join finance.categories c on c.id=tx.category_id
  where tx.date >= '<YYYY-MM-01>' and tx.date < '<next-month-01>'
)
select
  round(sum(amount) filter (where amount>0 and is_income and not excl),2) as income_mtd,
  round(sum(case when excl or is_income then 0
                 when category_id is null then (case when amount<0 then abs(amount) else 0 end)
                 else -amount end),2) as spend_mtd_net;
```
Present income MTD, spend MTD (net), net saved, savings rate, and the top spend categories.

### 10. Report (OPTIONAL — only if asked)
Reports are generated monthly, not per-import. Only if the user asks, generate via the Reports page "Generate / Refresh" button or `npx tsx scripts/regen-2026-reports.ts`.

## Rules
- PowerShell environment; financial data — follow the destructive-ops caution (check phantom pairs before any delete; the count-based dedup handles legitimate same-day repeats).
- Never auto-apply categories — always propose-and-wait with a table + rationale.
- Reconcile to the penny before declaring done.

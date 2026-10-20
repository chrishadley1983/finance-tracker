-- Foreign-currency bank rows (HSBC Global Money wallets: ZAR, DKK, EUR…) (Chris, 20 Oct 2026).
-- The ledger stays GBP-only: TrueLayer sync converts non-GBP rows to GBP at the ECB rate for the
-- transaction date and keeps the bank's original amount + currency here, so trip spend can still be
-- read in rand. Both columns are null for ordinary GBP rows.
-- Apply with `supabase db query --linked` (NOT `db push`: this project's migration history belongs to
-- the Hadley Bricks app). Additive and idempotent. Must run BEFORE the code that writes the columns
-- is deployed.
alter table finance.transactions add column if not exists original_amount numeric(14, 2);
alter table finance.transactions add column if not exists original_currency text;
comment on column finance.transactions.original_amount is 'Signed amount in original_currency when the bank reported a non-GBP amount; amount holds the GBP conversion.';
comment on column finance.transactions.original_currency is 'ISO currency of original_amount (e.g. ZAR); null for GBP rows.';

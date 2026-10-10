-- One ledger row per bank transaction per account (10 Oct 2026).
-- Backstop for the TrueLayer sync: its dedup read used to stop at Supabase's 1,000-row cap, so a wide
-- sync (new link: 730-day lookback; manual dateFrom) could re-insert transactions it could not see.
-- The read is now paged (lib/truelayer/sync.ts); this index makes any future regression fail loudly
-- (the insert errors) instead of silently duplicating money.
-- Checked before writing: 861 rows carry a bank id, 0 duplicate (account_id, hsbc_transaction_id) pairs.
-- Partial: CSV-imported and manual rows have no bank id and are unaffected.
-- NOT YET APPLIED. This project's migration history belongs to the Hadley Bricks app (see 011's header);
-- apply deliberately, then record how it was applied here.
create unique index if not exists transactions_account_bank_ref_key
  on finance.transactions (account_id, hsbc_transaction_id)
  where hsbc_transaction_id is not null;

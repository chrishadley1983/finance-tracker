-- One snapshot per account per date (1 Oct 2026).
-- 001_initial_schema.sql declared UNIQUE (date, account_id) but the live table never had it, which let a batch on
-- 31 Aug 2026 write a second set of 1 Aug rows (8 duplicates, deleted 1 Oct 2026 after review). Applied directly with
-- `supabase db query --linked` — this project's migration history belongs to the Hadley Bricks app, so `db push`
-- must not be used from finance-tracker (it would try to re-run 001–010).
alter table finance.wealth_snapshots
  add constraint wealth_snapshots_account_date_key unique (account_id, date);

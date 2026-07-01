-- Migration 007: Enable Banking (open banking) integration
--
-- Adds the schema needed to link HSBC accounts via Enable Banking and sync
-- transactions automatically. Purely additive / non-destructive:
--   * accounts gains EB linkage + sync tracking columns
--   * new enable_banking_sessions table stores consent sessions (session id +
--     expiry only; no tokens/credentials are ever stored)
--   * transactions reuse the existing hsbc_transaction_id column to hold the
--     EB entry_reference, giving stable, rename-safe dedup on future syncs.
--     A partial unique index stops the same EB reference being inserted twice.

-- 1. Consent sessions ---------------------------------------------------------
create table if not exists finance.enable_banking_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null unique,          -- Enable Banking session id
  aspsp_name    text,                          -- e.g. "HSBC"
  aspsp_country text,                          -- e.g. "GB"
  psu_type      text default 'personal',
  status        text not null default 'active',-- active | expired | revoked
  valid_until   timestamptz not null,          -- consent expiry (max ~90 days)
  raw           jsonb,                          -- full session payload (accounts etc.)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table finance.enable_banking_sessions is
  'Enable Banking consent sessions. Stores only the session id + expiry, never tokens or credentials.';

-- 2. Account linkage + sync tracking -----------------------------------------
alter table finance.accounts
  add column if not exists enable_banking_account_uid text,
  add column if not exists enable_banking_session_id  uuid
    references finance.enable_banking_sessions(id) on delete set null,
  add column if not exists sync_enabled boolean not null default false,
  add column if not exists last_sync_at timestamptz;

create index if not exists idx_accounts_eb_uid
  on finance.accounts(enable_banking_account_uid)
  where enable_banking_account_uid is not null;

-- 3. Transaction-level EB reference dedup ------------------------------------
-- hsbc_transaction_id already exists (currently all NULL). EB-sourced rows put
-- the bank's stable entry_reference here so re-syncs match by reference even
-- after the user renames the row. Partial unique index = no duplicate refs.
create unique index if not exists uq_transactions_eb_ref
  on finance.transactions(account_id, hsbc_transaction_id)
  where hsbc_transaction_id is not null;

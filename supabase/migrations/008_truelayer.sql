-- Migration 008: TrueLayer (open banking) integration
--
-- TrueLayer's Data API is the free, self-serve UK path (HSBC = General
-- Availability). It uses OAuth2 with refresh tokens (offline_access) for
-- ongoing sync, so we need to store tokens server-side.
--
-- Additive. Reuses accounts.sync_enabled / last_sync_at and the EB-ref unique
-- index from migration 007 (transactions.hsbc_transaction_id now also holds the
-- TrueLayer transaction_id for stable, rename-safe dedup).

-- 1. Connections (OAuth tokens) — SERVICE-ROLE ONLY. RLS enabled with no
--    policies => the anon/authenticated keys can never read tokens; the app
--    only ever touches this table via the service-role client (supabaseAdmin).
create table if not exists finance.truelayer_connections (
  id               uuid primary key default gen_random_uuid(),
  provider_id      text,          -- e.g. ob-hsbc
  provider_name    text,          -- e.g. HSBC
  access_token     text,          -- short-lived bearer
  refresh_token    text,          -- long-lived (offline_access)
  token_expires_at timestamptz,
  scope            text,
  status           text not null default 'active', -- active | revoked | expired
  raw              jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table finance.truelayer_connections is
  'TrueLayer OAuth connections (access/refresh tokens). Service-role only; RLS denies all other access.';

alter table finance.truelayer_connections enable row level security;
-- no policies => deny all for non-service-role roles

-- 2. Account linkage.
alter table finance.accounts
  add column if not exists truelayer_account_id    text,
  add column if not exists truelayer_connection_id uuid
    references finance.truelayer_connections(id) on delete set null;

create index if not exists idx_accounts_tl_acct
  on finance.accounts(truelayer_account_id)
  where truelayer_account_id is not null;

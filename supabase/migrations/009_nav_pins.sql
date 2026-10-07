-- Migration 009: navigation pins
--
-- Pages the owner pins in the navigation column (e.g. "October close",
-- "Tax year"). Stored server-side so pins follow the user between devices.
-- Additive. Service-role only, like the other app tables accessed via
-- supabaseAdmin: RLS enabled with no policies.

create table if not exists finance.nav_pins (
  id         uuid primary key default gen_random_uuid(),
  href       text not null unique,
  label      text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table finance.nav_pins is
  'Pages pinned in the app navigation. Service-role only.';

alter table finance.nav_pins enable row level security;

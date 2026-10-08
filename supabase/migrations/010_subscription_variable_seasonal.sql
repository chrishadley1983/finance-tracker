-- Migration 010: variable-amount subscriptions, half-termly billing, seasonal status
--
-- variable_amount: the stored amount is an average (council tax over 10 months,
--   a 12-month activity total split per term) or usage-billed (cloud, roaming).
--   The app checks these on their last-12-months total instead of the last charge.
-- frequency 'half_termly': activities billed six times a year.
-- status 'seasonal': costs like active, but quiet months aren't missed payments.
-- Additive; existing rows keep their behaviour (variable_amount = false).

alter table finance.subscriptions
  add column if not exists variable_amount boolean not null default false;

comment on column finance.subscriptions.variable_amount is
  'True when charges vary or the amount is an average: checked on the 12-month total, not each charge.';

alter table finance.subscriptions drop constraint if exists subscriptions_frequency_check;
alter table finance.subscriptions add constraint subscriptions_frequency_check
  check (frequency = any (array['weekly', 'fortnightly', 'monthly', 'quarterly', 'termly', 'half_termly', 'annual']));

alter table finance.subscriptions drop constraint if exists subscriptions_status_check;
alter table finance.subscriptions add constraint subscriptions_status_check
  check (status = any (array['active', 'seasonal', 'paused', 'cancelled', 'trial']));

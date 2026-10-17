-- Tax set-aside expense category (Chris, 17 Oct 2026).
-- HB profit and Micro1/Deel arrive gross. Each transfer into the tax pot is filed here so the tax
-- comes off in the month the income lands: is_income = false and exclude_from_totals = false, so
-- get_savings_rate / budget comparison / reports count it as an outflow (unlike Transfers, which
-- is excluded from totals). The plan's run-rate leaves it out via spend.excludedCategories.
-- Apply with `supabase db query --linked` (NOT `db push`: this project's migration history
-- belongs to the Hadley Bricks app). Idempotent. Must run BEFORE `npm run policies:sync`
-- (policy sync refuses an unknown category name).
insert into finance.categories (name, group_name, group_id, is_income, exclude_from_totals, display_order)
select 'Tax set-aside', g.name, g.id, false, false, 38
from finance.category_groups g
where g.name = 'Bills and utilities'
  and not exists (select 1 from finance.categories c where c.name = 'Tax set-aside');

-- 010: plan_ladder_rungs comment — the ladder is sized by budget (Plan E, 20 Sep 2026),
-- not by a £60k-per-year target as the 009 comment said. Documentation only; no data change.
COMMENT ON TABLE plan_ladder_rungs IS
  'Gilt ladder purchase tracker for the Plan Cockpit (/plan). One row per target year 2035–2045. Rungs are sized by the money committed (plan/assumptions.json ladder.budgetReal, ~£909k real): each rung redeems what its wrapper''s budget buys at live prices (~£99k ISA / ~£106k SIPP at Sep 2026 yields), coupons on top. The 2043 target has no linker: half in the 2042 gilt, half in 2044 (status split).';

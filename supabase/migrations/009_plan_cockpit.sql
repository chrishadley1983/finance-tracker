-- 009: Plan Cockpit — gilt ladder purchase tracking
-- One row per ladder target year (2035–2045). The 2043 target has no matching
-- linker; its purchases are recorded against the gilts actually bought (the
-- 2042/2044 rows carry the extra face), with the 2043 row marked 'split'.

CREATE TABLE plan_ladder_rungs (
  year INTEGER PRIMARY KEY CHECK (year BETWEEN 2030 AND 2055),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'bought', 'split')),
  epic TEXT,
  face_value DECIMAL(12,2),
  cost DECIMAL(12,2),
  purchased_on DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE plan_ladder_rungs IS
  'Gilt ladder purchase tracker for the Plan Cockpit (/plan). Target: £60k real per year, 2035–2045.';

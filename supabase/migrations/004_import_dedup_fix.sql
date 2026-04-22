-- =============================================================================
-- Migration 004: Import Dedup Fix
--
-- Background:
--   The UNIQUE index on imported_transaction_hashes.hash prevented legitimate
--   repeat transactions (e.g. two £8.80 TFL fares on the same day) from both
--   being hash-tracked. The second insert silently failed, leaving the tx row
--   without a hash entry — so a later re-import saw "no hash match" and
--   created a duplicate transaction row.
--
--   A 2026-04-22 reconciliation session found 33 duplicate rows caused by
--   this pattern (plus one missing TFL that had been mis-deduped).
--
-- Fix:
--   Replace dedup mechanism with count-based logic in app/api/import/execute
--   (see same-dated PR). Hash table is kept as an audit log only; unique
--   constraint is dropped because legitimate same-hash rows are expected.
-- =============================================================================

DROP INDEX IF EXISTS idx_imported_transaction_hashes_hash;

-- Keep a non-unique index for lookup performance (audit trail queries).
CREATE INDEX IF NOT EXISTS idx_imported_transaction_hashes_hash
  ON imported_transaction_hashes(hash);

COMMENT ON TABLE imported_transaction_hashes IS
  'Audit log of imported transaction hashes. Unique constraint on hash removed in migration 004 — count-based dedup in import/execute route is now the source of truth for duplicate detection.';

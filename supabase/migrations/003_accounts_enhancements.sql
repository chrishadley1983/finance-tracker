-- Finance Tracker Accounts Enhancements
-- Migration: 003_accounts_enhancements
-- Created: 2026-01-02

-- =============================================================================
-- ENUM UPDATES
-- =============================================================================

-- Add 'credit' and 'other' to account_type enum
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'credit';
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'other';

-- =============================================================================
-- TABLE UPDATES
-- =============================================================================

-- Add new fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS include_in_net_worth BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_import_at TIMESTAMPTZ;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_archived ON accounts(is_archived);
CREATE INDEX IF NOT EXISTS idx_accounts_sort ON accounts(sort_order);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN accounts.notes IS 'User notes about the account';
COMMENT ON COLUMN accounts.icon IS 'Custom icon/emoji for the account';
COMMENT ON COLUMN accounts.color IS 'Custom color for the account display';
COMMENT ON COLUMN accounts.sort_order IS 'Display order in account lists';
COMMENT ON COLUMN accounts.is_archived IS 'Whether the account is archived (hidden from main views)';
COMMENT ON COLUMN accounts.include_in_net_worth IS 'Whether to include this account in net worth calculations';
COMMENT ON COLUMN accounts.last_import_at IS 'Timestamp of last successful transaction import';

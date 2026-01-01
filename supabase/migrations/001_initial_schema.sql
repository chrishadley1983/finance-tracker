-- Finance Tracker Initial Schema
-- Migration: 001_initial_schema
-- Created: 2026-01-01

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE account_type AS ENUM (
  'current',
  'savings',
  'pension',
  'isa',
  'investment',
  'property'
);

CREATE TYPE match_type AS ENUM (
  'exact',
  'contains',
  'regex'
);

CREATE TYPE categorisation_source AS ENUM (
  'manual',
  'rule',
  'ai',
  'import'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- accounts
-- -----------------------------------------------------------------------------
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type account_type NOT NULL,
  provider TEXT NOT NULL,
  hsbc_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  is_income BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_group_name ON categories(group_name);
CREATE INDEX idx_categories_is_income ON categories(is_income);
CREATE INDEX idx_categories_display_order ON categories(display_order);

-- -----------------------------------------------------------------------------
-- category_mappings
-- -----------------------------------------------------------------------------
CREATE TABLE category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  match_type match_type NOT NULL DEFAULT 'exact',
  confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_category_mappings_category_id ON category_mappings(category_id);
CREATE INDEX idx_category_mappings_match_type ON category_mappings(match_type);

-- -----------------------------------------------------------------------------
-- transactions
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  categorisation_source categorisation_source NOT NULL DEFAULT 'manual',
  hsbc_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_hsbc_transaction_id ON transactions(hsbc_transaction_id);
CREATE INDEX idx_transactions_date_account ON transactions(date, account_id);

-- -----------------------------------------------------------------------------
-- budgets
-- -----------------------------------------------------------------------------
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, year, month)
);

CREATE INDEX idx_budgets_category_id ON budgets(category_id);
CREATE INDEX idx_budgets_year_month ON budgets(year, month);

-- -----------------------------------------------------------------------------
-- wealth_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE wealth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, account_id)
);

CREATE INDEX idx_wealth_snapshots_account_id ON wealth_snapshots(account_id);
CREATE INDEX idx_wealth_snapshots_date ON wealth_snapshots(date);

-- -----------------------------------------------------------------------------
-- fire_parameters
-- -----------------------------------------------------------------------------
CREATE TABLE fire_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL UNIQUE,
  annual_spend DECIMAL(12,2) NOT NULL,
  withdrawal_rate DECIMAL(5,2) NOT NULL,
  expected_return DECIMAL(5,2) NOT NULL,
  retirement_age INTEGER NOT NULL,
  state_pension_age INTEGER NOT NULL,
  state_pension_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on accounts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE accounts IS 'Financial accounts (bank accounts, pensions, ISAs, etc.)';
COMMENT ON TABLE categories IS 'Transaction categories with groupings';
COMMENT ON TABLE category_mappings IS 'Rules for auto-categorising transactions';
COMMENT ON TABLE transactions IS 'Financial transactions with categorisation';
COMMENT ON TABLE budgets IS 'Monthly budget targets by category';
COMMENT ON TABLE wealth_snapshots IS 'Point-in-time balance snapshots for wealth tracking';
COMMENT ON TABLE fire_parameters IS 'FIRE calculation scenarios and parameters';

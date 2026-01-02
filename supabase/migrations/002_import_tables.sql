-- Finance Tracker Import Tables
-- Migration: 002_import_tables
-- Created: 2026-01-01
-- Purpose: Add tables for CSV import functionality

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE import_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- import_formats
-- Store known CSV format configurations for automatic detection
-- -----------------------------------------------------------------------------
CREATE TABLE import_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  column_mapping JSONB NOT NULL,
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  decimal_separator TEXT NOT NULL DEFAULT '.',
  has_header BOOLEAN NOT NULL DEFAULT true,
  skip_rows INTEGER NOT NULL DEFAULT 0,
  amount_in_single_column BOOLEAN NOT NULL DEFAULT true,
  amount_column TEXT,
  debit_column TEXT,
  credit_column TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_formats_provider ON import_formats(provider);
CREATE INDEX idx_import_formats_is_system ON import_formats(is_system);

-- Trigger for updated_at
CREATE TRIGGER trigger_import_formats_updated_at
  BEFORE UPDATE ON import_formats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- import_sessions
-- Track each import attempt for audit and debugging
-- -----------------------------------------------------------------------------
CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  format_id UUID REFERENCES import_formats(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  status import_status NOT NULL DEFAULT 'pending',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_details JSONB,
  raw_data JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_sessions_status ON import_sessions(status);
CREATE INDEX idx_import_sessions_format_id ON import_sessions(format_id);
CREATE INDEX idx_import_sessions_account_id ON import_sessions(account_id);
CREATE INDEX idx_import_sessions_created_at ON import_sessions(created_at DESC);

-- -----------------------------------------------------------------------------
-- imported_transaction_hashes
-- Track imported transaction hashes to prevent duplicates across sessions
-- -----------------------------------------------------------------------------
CREATE TABLE imported_transaction_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_imported_transaction_hashes_hash ON imported_transaction_hashes(hash);
CREATE INDEX idx_imported_transaction_hashes_transaction_id ON imported_transaction_hashes(transaction_id);
CREATE INDEX idx_imported_transaction_hashes_import_session_id ON imported_transaction_hashes(import_session_id);

-- =============================================================================
-- SEED DATA: Known Import Formats
-- =============================================================================

-- HSBC Current Account
INSERT INTO import_formats (
  name,
  provider,
  is_system,
  column_mapping,
  date_format,
  decimal_separator,
  has_header,
  skip_rows,
  amount_in_single_column,
  debit_column,
  credit_column,
  notes
) VALUES (
  'HSBC Current Account',
  'HSBC',
  true,
  '{
    "date": "Date",
    "description": "Description",
    "balance": "Balance"
  }'::jsonb,
  'DD/MM/YYYY',
  '.',
  true,
  0,
  false,
  'Paid Out',
  'Paid In',
  'Standard HSBC current account export. Uses separate Paid Out and Paid In columns for debits/credits.'
);

-- HSBC Credit Card
INSERT INTO import_formats (
  name,
  provider,
  is_system,
  column_mapping,
  date_format,
  decimal_separator,
  has_header,
  skip_rows,
  amount_in_single_column,
  amount_column,
  notes
) VALUES (
  'HSBC Credit Card',
  'HSBC',
  true,
  '{
    "date": "Date",
    "description": "Description",
    "amount": "Amount"
  }'::jsonb,
  'DD/MM/YYYY',
  '.',
  true,
  0,
  true,
  'Amount',
  'HSBC credit card export. Single Amount column (positive = charge, negative = payment/credit).'
);

-- Monzo
INSERT INTO import_formats (
  name,
  provider,
  is_system,
  column_mapping,
  date_format,
  decimal_separator,
  has_header,
  skip_rows,
  amount_in_single_column,
  amount_column,
  debit_column,
  credit_column,
  notes
) VALUES (
  'Monzo',
  'Monzo',
  true,
  '{
    "date": "Date",
    "description": "Name",
    "amount": "Amount",
    "reference": "Transaction ID",
    "category": "Category"
  }'::jsonb,
  'DD/MM/YYYY',
  '.',
  true,
  0,
  true,
  'Amount',
  'Money Out',
  'Money In',
  'Monzo export includes Transaction ID for deduplication. Amount column is primary, Money Out/In available as alternatives.'
);

-- Amex UK
INSERT INTO import_formats (
  name,
  provider,
  is_system,
  column_mapping,
  date_format,
  decimal_separator,
  has_header,
  skip_rows,
  amount_in_single_column,
  amount_column,
  notes
) VALUES (
  'Amex UK',
  'American Express',
  true,
  '{
    "date": "Date",
    "description": "Description",
    "amount": "Amount"
  }'::jsonb,
  'DD/MM/YYYY',
  '.',
  true,
  0,
  true,
  'Amount',
  'American Express UK credit card export. Simple 3-column format.'
);

-- Generic CSV (fallback)
INSERT INTO import_formats (
  name,
  provider,
  is_system,
  column_mapping,
  date_format,
  decimal_separator,
  has_header,
  skip_rows,
  amount_in_single_column,
  notes
) VALUES (
  'Generic CSV',
  'Generic',
  true,
  '{}'::jsonb,
  'DD/MM/YYYY',
  '.',
  true,
  0,
  true,
  'Generic fallback format for unknown CSVs. Requires manual column mapping.'
);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE import_formats IS 'Predefined and custom CSV format configurations for import detection';
COMMENT ON TABLE import_sessions IS 'Audit trail of import attempts with status and statistics';
COMMENT ON TABLE imported_transaction_hashes IS 'Hash-based duplicate detection for imported transactions';

COMMENT ON COLUMN import_formats.column_mapping IS 'JSON object mapping our field names (date, description, amount, etc.) to CSV column names';
COMMENT ON COLUMN import_formats.date_format IS 'Expected date format using DD/MM/YYYY style notation';
COMMENT ON COLUMN import_formats.amount_in_single_column IS 'If true, uses amount_column. If false, uses debit_column and credit_column separately.';
COMMENT ON COLUMN import_sessions.raw_data IS 'Temporary storage for parsed CSV data during import workflow';
COMMENT ON COLUMN import_sessions.error_details IS 'Structured error information for failed rows';
COMMENT ON COLUMN imported_transaction_hashes.hash IS 'SHA-256 hash of date + amount + normalized description for deduplication';

# Phase 4: Investment Accounts - Implementation Prompts

**Project:** Personal Finance Tracker  
**Phase:** 4 - Investment Account Tracking  
**Date:** January 2026

---

## Overview

Phase 4 adds manual tracking for investment platforms that don't support Open Banking APIs. This includes Vanguard UK, Interactive Investor, and Legal & General workplace pensions.

### Design Principles

1. **Simplicity First** - Just track values, not individual transactions
2. **Flexible Entry** - Support any valuation date with optional notes
3. **Historical Import** - Bulk import from existing spreadsheet data
4. **Provider Agnostic** - Works with any investment platform

---

## Implementation Prompts

### Prompt 4.1: Database Schema for Investment Valuations

```markdown
## Task: Create Investment Valuations Schema

Add database support for tracking investment account valuations over time.

### Database Migration

```sql
-- Migration: create_investment_valuations_table.sql

-- Investment valuations table
CREATE TABLE investment_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value DECIMAL(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate valuations for same account/date
  UNIQUE(account_id, date)
);

-- Index for efficient queries
CREATE INDEX idx_investment_valuations_account_date 
ON investment_valuations(account_id, date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_investment_valuations_updated_at
  BEFORE UPDATE ON investment_valuations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add investment-specific columns to accounts
ALTER TABLE accounts
ADD COLUMN investment_provider TEXT,
ADD COLUMN investment_type TEXT CHECK (investment_type IN ('isa', 'sipp', 'gia', 'workplace_pension', 'other'));

-- Comment on columns
COMMENT ON TABLE investment_valuations IS 'Point-in-time valuations for investment accounts';
COMMENT ON COLUMN investment_valuations.value IS 'Total account value on this date in GBP';
COMMENT ON COLUMN investment_valuations.notes IS 'Optional notes e.g. contribution made, market event';
```

### TypeScript Types

```typescript
// lib/types/investment.ts

export interface InvestmentValuation {
  id: string;
  account_id: string;
  date: string; // YYYY-MM-DD
  value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: 'pension' | 'isa' | 'investment';
  provider: string;
  investment_provider: string | null;
  investment_type: 'isa' | 'sipp' | 'gia' | 'workplace_pension' | 'other' | null;
  is_active: boolean;
}

export interface InvestmentAccountWithValuations extends InvestmentAccount {
  latest_valuation: InvestmentValuation | null;
  valuations: InvestmentValuation[];
}

export type InvestmentProvider = 
  | 'vanguard'
  | 'interactive_investor'
  | 'legal_and_general'
  | 'hargreaves_lansdown'
  | 'aj_bell'
  | 'fidelity'
  | 'other';

export const INVESTMENT_PROVIDERS: Record<InvestmentProvider, string> = {
  vanguard: 'Vanguard UK',
  interactive_investor: 'Interactive Investor',
  legal_and_general: 'Legal & General',
  hargreaves_lansdown: 'Hargreaves Lansdown',
  aj_bell: 'AJ Bell',
  fidelity: 'Fidelity',
  other: 'Other',
};
```

### Zod Validation Schemas

```typescript
// lib/validations/investment.ts

import { z } from 'zod';

export const investmentValuationSchema = z.object({
  account_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  value: z.number().positive('Value must be positive'),
  notes: z.string().max(500).optional().nullable(),
});

export const createInvestmentAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['pension', 'isa', 'investment']),
  provider: z.string().min(1).max(100),
  investment_provider: z.string().optional(),
  investment_type: z.enum(['isa', 'sipp', 'gia', 'workplace_pension', 'other']),
});

export const bulkValuationImportSchema = z.object({
  account_id: z.string().uuid(),
  valuations: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    value: z.number().positive(),
    notes: z.string().optional().nullable(),
  })),
});
```

### Verification Steps
1. Run migration successfully
2. Generate TypeScript types from schema
3. Test unique constraint prevents duplicate date entries
4. Test cascade delete removes valuations when account deleted

### Do NOT
- Allow negative valuation values
- Store transactions for investment accounts (only valuations)
- Make notes field required
```

---

### Prompt 4.2: Investment Valuation API Routes

```markdown
## Task: Create API Routes for Investment Valuations

Build CRUD API routes for managing investment valuations.

### File Structure
```
app/
├── api/
│   └── investments/
│       ├── route.ts                    # GET list, POST create account
│       ├── [accountId]/
│       │   ├── route.ts                # GET account details
│       │   └── valuations/
│       │       ├── route.ts            # GET list, POST create valuation
│       │       ├── [id]/
│       │       │   └── route.ts        # PUT update, DELETE valuation
│       │       └── bulk/
│       │           └── route.ts        # POST bulk import
│       └── summary/
│           └── route.ts                # GET total investments summary
```

### Component Specs

#### `app/api/investments/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createInvestmentAccountSchema } from '@/lib/validations/investment';

// GET /api/investments - List all investment accounts with latest valuations
export async function GET() {
  const supabase = createServerClient();
  
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select(`
      *,
      latest_valuation:investment_valuations(
        id, date, value, notes
      )
    `)
    .in('type', ['pension', 'isa', 'investment'])
    .eq('is_active', true)
    .order('name');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Get latest valuation for each account
  const accountsWithLatest = accounts?.map(account => {
    const valuations = account.latest_valuation || [];
    const latest = valuations.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0] || null;
    
    return {
      ...account,
      latest_valuation: latest,
    };
  });
  
  return NextResponse.json(accountsWithLatest);
}

// POST /api/investments - Create new investment account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createInvestmentAccountSchema.parse(body);
    
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        name: validated.name,
        type: validated.type,
        provider: validated.provider,
        investment_provider: validated.investment_provider,
        investment_type: validated.investment_type,
        is_active: true,
        sync_enabled: false, // Investment accounts don't sync
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    throw error;
  }
}
```

#### `app/api/investments/[accountId]/valuations/route.ts`
```typescript
// GET /api/investments/[accountId]/valuations - List valuations
export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('investment_valuations')
    .select('*')
    .eq('account_id', params.accountId)
    .order('date', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

// POST /api/investments/[accountId]/valuations - Add valuation
export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const body = await request.json();
    const validated = investmentValuationSchema.parse({
      ...body,
      account_id: params.accountId,
    });
    
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('investment_valuations')
      .upsert(validated, { 
        onConflict: 'account_id,date',
        ignoreDuplicates: false,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    throw error;
  }
}
```

#### `app/api/investments/[accountId]/valuations/bulk/route.ts`
```typescript
// POST /api/investments/[accountId]/valuations/bulk - Bulk import
export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const body = await request.json();
    const validated = bulkValuationImportSchema.parse({
      account_id: params.accountId,
      valuations: body.valuations,
    });
    
    const supabase = createServerClient();
    
    // Prepare records with account_id
    const records = validated.valuations.map(v => ({
      account_id: params.accountId,
      date: v.date,
      value: v.value,
      notes: v.notes || null,
    }));
    
    // Upsert all records (update if date exists)
    const { data, error } = await supabase
      .from('investment_valuations')
      .upsert(records, {
        onConflict: 'account_id,date',
        ignoreDuplicates: false,
      })
      .select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      imported: data?.length || 0,
      message: `Successfully imported ${data?.length} valuations`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    throw error;
  }
}
```

#### `app/api/investments/summary/route.ts`
```typescript
// GET /api/investments/summary - Total investment value
export async function GET() {
  const supabase = createServerClient();
  
  // Get latest valuation for each account using a subquery
  const { data, error } = await supabase
    .from('accounts')
    .select(`
      id,
      name,
      type,
      provider,
      investment_provider,
      investment_type,
      investment_valuations (
        date,
        value
      )
    `)
    .in('type', ['pension', 'isa', 'investment'])
    .eq('is_active', true);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Calculate totals
  let totalValue = 0;
  const byProvider: Record<string, number> = {};
  const byType: Record<string, number> = {};
  
  const accountSummaries = data?.map(account => {
    const valuations = account.investment_valuations || [];
    const latest = valuations.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    
    const value = latest?.value || 0;
    totalValue += value;
    
    const provider = account.investment_provider || 'Unknown';
    byProvider[provider] = (byProvider[provider] || 0) + value;
    
    const type = account.investment_type || 'other';
    byType[type] = (byType[type] || 0) + value;
    
    return {
      id: account.id,
      name: account.name,
      provider: account.investment_provider,
      type: account.investment_type,
      latestValue: value,
      latestDate: latest?.date || null,
    };
  });
  
  return NextResponse.json({
    totalValue,
    byProvider,
    byType,
    accounts: accountSummaries,
  });
}
```

### Verification Steps
1. Test GET /api/investments returns accounts with latest valuations
2. Test POST /api/investments creates account correctly
3. Test POST valuations with upsert (update existing date)
4. Test bulk import with 100+ records
5. Test summary endpoint calculates totals correctly

### Do NOT
- Allow valuations for non-investment accounts
- Return all valuations in list endpoint (use pagination for history)
- Skip validation on bulk import
```

---

### Prompt 4.3: Investment Account UI Components

```markdown
## Task: Create Investment Account UI Components

Build the UI for managing investment accounts and valuations.

### File Structure
```
app/
├── (dashboard)/
│   └── investments/
│       ├── page.tsx                    # Investment accounts list
│       └── [accountId]/
│           └── page.tsx                # Account detail with valuations
components/
├── investments/
│   ├── InvestmentAccountList.tsx       # List of accounts with values
│   ├── InvestmentAccountCard.tsx       # Single account display
│   ├── AddAccountDialog.tsx            # Create account modal
│   ├── AddValuationDialog.tsx          # Add valuation modal
│   ├── ValuationHistory.tsx            # Table of historical values
│   ├── InvestmentSummaryCard.tsx       # Dashboard summary widget
│   └── ValueChart.tsx                  # Simple line chart
```

### Component Specs

#### `components/investments/InvestmentAccountList.tsx`
```typescript
'use client';

import { useState } from 'react';
import { InvestmentAccountCard } from './InvestmentAccountCard';
import { AddAccountDialog } from './AddAccountDialog';
import { InvestmentAccountWithValuations } from '@/lib/types/investment';

interface Props {
  accounts: InvestmentAccountWithValuations[];
  onAccountCreated: () => void;
}

export function InvestmentAccountList({ accounts, onAccountCreated }: Props) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  const totalValue = accounts.reduce(
    (sum, acc) => sum + (acc.latest_valuation?.value || 0),
    0
  );
  
  return (
    <div className="space-y-6">
      {/* Header with total */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Investment Accounts</h1>
          <p className="text-gray-600">
            Total value: £{totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Account
        </button>
      </div>
      
      {/* Account cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map(account => (
          <InvestmentAccountCard key={account.id} account={account} />
        ))}
      </div>
      
      {accounts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No investment accounts yet.</p>
          <p>Add your first account to start tracking.</p>
        </div>
      )}
      
      <AddAccountDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => {
          setShowAddDialog(false);
          onAccountCreated();
        }}
      />
    </div>
  );
}
```

#### `components/investments/InvestmentAccountCard.tsx`
```typescript
import Link from 'next/link';
import { InvestmentAccountWithValuations, INVESTMENT_PROVIDERS } from '@/lib/types/investment';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  account: InvestmentAccountWithValuations;
}

export function InvestmentAccountCard({ account }: Props) {
  const { latest_valuation } = account;
  const providerLabel = account.investment_provider 
    ? INVESTMENT_PROVIDERS[account.investment_provider as keyof typeof INVESTMENT_PROVIDERS] || account.investment_provider
    : account.provider;
  
  return (
    <Link href={`/investments/${account.id}`}>
      <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold">{account.name}</h3>
            <p className="text-sm text-gray-500">{providerLabel}</p>
          </div>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            {account.investment_type?.toUpperCase() || account.type}
          </span>
        </div>
        
        {latest_valuation ? (
          <div className="mt-4">
            <p className="text-2xl font-bold">
              £{latest_valuation.value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400">
              Updated {formatDistanceToNow(new Date(latest_valuation.date), { addSuffix: true })}
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-gray-400 italic">No valuations yet</p>
          </div>
        )}
      </div>
    </Link>
  );
}
```

#### `components/investments/AddValuationDialog.tsx`
```typescript
'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';

interface Props {
  accountId: string;
  accountName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddValuationDialog({ accountId, accountName, open, onClose, onSuccess }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/investments/${accountId}/valuations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          value: parseFloat(value),
          notes: notes || null,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save valuation');
      }
      
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">
            Add Valuation for {accountName}
          </Dialog.Title>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Value (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Monthly contribution, market movement"
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
            
            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Valuation'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

#### `components/investments/InvestmentSummaryCard.tsx` (Dashboard Widget)
```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Summary {
  totalValue: number;
  byProvider: Record<string, number>;
  accounts: { name: string; latestValue: number }[];
}

export function InvestmentSummaryCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/investments/summary')
      .then(res => res.json())
      .then(setSummary)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) {
    return <div className="bg-white rounded-lg shadow p-4 animate-pulse h-32" />;
  }
  
  if (!summary) {
    return null;
  }
  
  return (
    <Link href="/investments">
      <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-1">Total Investments</h3>
        <p className="text-2xl font-bold">
          £{summary.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
        </p>
        <div className="mt-2 text-xs text-gray-400">
          {summary.accounts.length} accounts across {Object.keys(summary.byProvider).length} providers
        </div>
      </div>
    </Link>
  );
}
```

### Verification Steps
1. Account list displays with latest valuations
2. Add account dialog creates account successfully
3. Add valuation dialog saves and refreshes list
4. Summary card shows correct totals
5. Account card links to detail page

### Do NOT
- Fetch all valuations for list view (only latest)
- Use uncontrolled form inputs
- Skip loading/error states
```

---

### Prompt 4.4: Valuation History Import Script

```markdown
## Task: Create Import Script for Historical Valuations

Build a script to import historical investment valuations from the spreadsheet.

### File Structure
```
scripts/
├── import-investment-valuations.ts
```

### Script Spec

```typescript
// scripts/import-investment-valuations.ts

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SpreadsheetRow {
  Date: string | number;
  'Vanguard ISA'?: number;
  'Vanguard SIPP'?: number;
  'ii ISA'?: number;
  'ii SIPP'?: number;
  'L&G Pension'?: number;
  // Add other columns as needed
}

// Account name mapping to database account IDs
const ACCOUNT_MAPPING: Record<string, string> = {
  'Vanguard ISA': '', // Fill in after creating accounts
  'Vanguard SIPP': '',
  'ii ISA': '',
  'ii SIPP': '',
  'L&G Pension': '',
};

async function parseExcelDate(excelDate: string | number): Promise<string | null> {
  if (typeof excelDate === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(excelDate);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  
  // Try parsing string date
  const parsed = parse(excelDate, 'dd/MM/yyyy', new Date());
  if (isValid(parsed)) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}

async function importValuations(filePath: string) {
  console.log('Reading spreadsheet...');
  const workbook = XLSX.readFile(filePath);
  const sheetName = 'Wealth'; // Adjust to your sheet name
  const sheet = workbook.Sheets[sheetName];
  
  const rows: SpreadsheetRow[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${rows.length} rows`);
  
  const valuations: Array<{
    account_id: string;
    date: string;
    value: number;
    notes: string | null;
  }> = [];
  
  for (const row of rows) {
    const date = await parseExcelDate(row.Date);
    if (!date) {
      console.warn('Skipping row with invalid date:', row.Date);
      continue;
    }
    
    // Process each account column
    for (const [columnName, accountId] of Object.entries(ACCOUNT_MAPPING)) {
      if (!accountId) continue; // Skip unmapped accounts
      
      const value = row[columnName as keyof SpreadsheetRow];
      if (typeof value === 'number' && value > 0) {
        valuations.push({
          account_id: accountId,
          date,
          value,
          notes: 'Imported from spreadsheet',
        });
      }
    }
  }
  
  console.log(`Prepared ${valuations.length} valuations for import`);
  
  // Batch insert in chunks of 100
  const chunkSize = 100;
  let imported = 0;
  
  for (let i = 0; i < valuations.length; i += chunkSize) {
    const chunk = valuations.slice(i, i + chunkSize);
    
    const { error } = await supabase
      .from('investment_valuations')
      .upsert(chunk, {
        onConflict: 'account_id,date',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error('Import error:', error);
      throw error;
    }
    
    imported += chunk.length;
    console.log(`Imported ${imported}/${valuations.length}`);
  }
  
  console.log('Import complete!');
}

// Run import
const filePath = process.argv[2] || './Life_Planning_V2.xlsx';
importValuations(filePath)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

### Usage
```bash
# First, create accounts in the UI and get their IDs
# Then update ACCOUNT_MAPPING in the script

# Run import
npx ts-node scripts/import-investment-valuations.ts ./Life_Planning_V2.xlsx
```

### Verification Steps
1. Script parses Excel dates correctly
2. Script handles missing values gracefully
3. Upsert updates existing dates
4. All historical data imported correctly

### Do NOT
- Import without creating accounts first
- Skip date validation
- Ignore duplicate handling
```

---

## Agent Workflow

After each implementation prompt:

```
1. /test-plan analyze
2. /test-build feature:investments
3. /test-execute quick
4. /code-review staged
5. git commit -m "feat(phase4): ..."
```

Before completing Phase 4:
```
1. /test-execute pre-merge
2. /code-review branch
3. /merge-feature phase4-investments
```

---

## Testing Checklist

- [ ] Create investment account via UI
- [ ] Add valuation via dialog
- [ ] View valuation history
- [ ] Bulk import historical data
- [ ] Summary card shows correct totals
- [ ] Edit existing valuation
- [ ] Delete valuation
- [ ] Archive account (set inactive)

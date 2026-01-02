# Phase 3: Enable Banking Integration - Implementation Prompts

**Project:** Personal Finance Tracker  
**Phase:** 3 - Bank Integration  
**Integration:** Enable Banking API (FREE linked accounts)  
**Date:** January 2026

---

## Overview

Phase 3 implements automated bank transaction sync via Enable Banking API. This replaces the original direct HSBC Open Banking approach, using Enable Banking's "linked accounts" feature which is **FREE** for personal use.

### Why Enable Banking?

| Feature | Enable Banking | Direct HSBC API | Open Banking Access |
|---------|---------------|-----------------|---------------------|
| Cost | **FREE** (linked accounts) | FCA registration required | £36/year per account |
| Setup Complexity | Low | Very High | Low |
| Coverage | 2,500+ EU banks | HSBC only | Token.io banks |
| API Quality | Unified REST | Bank-specific | Simple REST |
| Contract Required | No (for own accounts) | Yes (FCA) | No |

---

## Pre-Implementation Setup

### 1. Enable Banking Account Setup (Manual Steps)

1. Visit https://enablebanking.com/sign-in/
2. Enter email to create account (one-time auth link sent)
3. After authentication, go to API Applications
4. Register new application:
   - Environment: **Production** (not Sandbox)
   - Name: "Personal Finance Tracker"
5. Application will be "pending" initially
6. Click "Link accounts" to connect your HSBC account
7. Complete HSBC authentication flow
8. Application becomes "active" in restricted mode (only linked accounts accessible)

### 2. Generate API Credentials

1. In Control Panel, generate RSA key pair for JWT signing
2. Download private key (keep secure, never commit)
3. Note the application ID

### 3. Environment Variables

Add to `.env.local`:
```env
# Enable Banking API
ENABLE_BANKING_APP_ID=your-application-id
ENABLE_BANKING_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
ENABLE_BANKING_ENVIRONMENT=production
```

---

## Implementation Prompts

### Prompt 3.1: Enable Banking Service Layer

```markdown
## Task: Create Enable Banking API Service

Create a service layer for Enable Banking API integration.

### File Structure
```
lib/
├── enable-banking/
│   ├── client.ts           # API client with JWT auth
│   ├── types.ts            # TypeScript types for API responses
│   ├── accounts.ts         # Account fetching functions
│   ├── transactions.ts     # Transaction fetching functions
│   └── index.ts            # Public exports
```

### Component Specs

#### `lib/enable-banking/types.ts`
```typescript
// ASPSP (Bank) types
export interface ASPSP {
  name: string;
  country: string;
  beta?: boolean;
  // ... other fields from API
}

// Account types
export interface EnableBankingAccount {
  account_id: string;
  iban?: string;
  bban?: string;
  name?: string;
  currency: string;
  account_type?: string;
  balance_types: string[];
}

// Balance types
export interface AccountBalance {
  balance_type: string; // CLBD, ITAV, XPCD
  amount: {
    amount: string;
    currency: string;
  };
  reference_date?: string;
}

// Transaction types
export interface EnableBankingTransaction {
  entry_reference?: string;
  transaction_id?: string;
  booking_date: string;
  value_date?: string;
  transaction_date?: string;
  transaction_amount: {
    amount: string;
    currency: string;
  };
  credit_debit_indicator: 'CRDT' | 'DBIT';
  status: 'BOOK' | 'PDNG';
  remittance_information?: string[];
  creditor?: {
    name?: string;
  };
  debtor?: {
    name?: string;
  };
  bank_transaction_code?: {
    code?: string;
    description?: string;
  };
}

// Session types
export interface EnableBankingSession {
  session_id: string;
  accounts: EnableBankingAccount[];
  valid_until: string;
  status: string;
}
```

#### `lib/enable-banking/client.ts`
```typescript
// Requirements:
// - Generate JWT for API authentication (RS256 signing)
// - JWT expires after max 24 hours (use shorter, e.g., 1 hour)
// - Include proper headers for all requests
// - Handle rate limiting (429 responses)
// - Implement retry logic with exponential backoff

import jwt from 'jsonwebtoken';

const ENABLE_BANKING_API_URL = 'https://api.enablebanking.com';

export function generateAuthToken(): string {
  const privateKey = process.env.ENABLE_BANKING_PRIVATE_KEY!;
  const appId = process.env.ENABLE_BANKING_APP_ID!;
  
  return jwt.sign(
    {
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
    privateKey,
    { 
      algorithm: 'RS256',
      header: { kid: appId }
    }
  );
}

export async function enableBankingFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = generateAuthToken();
  
  const response = await fetch(`${ENABLE_BANKING_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (response.status === 429) {
    // Rate limited - implement retry
    throw new Error('ASPSP_RATE_LIMIT_EXCEEDED');
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_code || 'API_ERROR');
  }
  
  return response.json();
}
```

### Verification Steps
1. Run `npm run build` - no TypeScript errors
2. Create unit test for JWT generation
3. Create unit test for API fetch with mocked responses
4. Test token generation produces valid JWT

### Do NOT
- Store private keys in code
- Use tokens longer than 24 hours
- Skip error handling for API responses
- Hardcode API URLs
```

---

### Prompt 3.2: Account & Session Management

```markdown
## Task: Implement Account and Session Management

Build the account fetching and session handling logic.

### File Structure
```
lib/
├── enable-banking/
│   ├── accounts.ts         # Account operations
│   └── sessions.ts         # Session management
app/
├── api/
│   └── enable-banking/
│       ├── accounts/
│       │   └── route.ts    # GET linked accounts
│       └── sessions/
│           └── route.ts    # GET session status
```

### Component Specs

#### `lib/enable-banking/sessions.ts`
```typescript
// Requirements:
// - Fetch session details by session_id
// - Check session validity (valid_until)
// - Handle EXPIRED_SESSION errors
// - Store session info in database for persistence

export async function getSession(sessionId: string): Promise<EnableBankingSession> {
  return enableBankingFetch<EnableBankingSession>(`/sessions/${sessionId}`);
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  try {
    const session = await getSession(sessionId);
    const validUntil = new Date(session.valid_until);
    return validUntil > new Date();
  } catch (error) {
    if (error.message === 'EXPIRED_SESSION') {
      return false;
    }
    throw error;
  }
}
```

#### `lib/enable-banking/accounts.ts`
```typescript
// Requirements:
// - Fetch accounts from an active session
// - Fetch balances for each account
// - Map Enable Banking account types to our account types

export async function getAccounts(sessionId: string): Promise<EnableBankingAccount[]> {
  const session = await getSession(sessionId);
  return session.accounts;
}

export async function getAccountBalances(
  sessionId: string, 
  accountId: string
): Promise<AccountBalance[]> {
  return enableBankingFetch<{ balances: AccountBalance[] }>(
    `/accounts/${accountId}/balances`,
    { headers: { 'X-Session-Id': sessionId } }
  ).then(res => res.balances);
}
```

#### Database: Add Session Storage
```sql
-- Add to existing accounts table or create new table
CREATE TABLE enable_banking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  session_id TEXT NOT NULL UNIQUE,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Enable Banking reference to accounts
ALTER TABLE accounts 
ADD COLUMN enable_banking_account_id TEXT,
ADD COLUMN enable_banking_session_id UUID REFERENCES enable_banking_sessions(id);
```

### Verification Steps
1. Run database migration successfully
2. Unit test session validity checking
3. Unit test account fetching with mock responses
4. API route returns proper JSON response

### Do NOT
- Store sensitive tokens in database (only session IDs)
- Ignore session expiry handling
- Fetch accounts without checking session validity first
```

---

### Prompt 3.3: Transaction Sync Service

```markdown
## Task: Implement Transaction Sync Service

Build the transaction fetching and syncing logic with deduplication.

### File Structure
```
lib/
├── enable-banking/
│   └── transactions.ts     # Transaction fetching
├── sync/
│   ├── transaction-sync.ts # Sync orchestration
│   └── deduplication.ts    # Duplicate detection
app/
├── api/
│   └── sync/
│       └── transactions/
│           └── route.ts    # POST trigger sync
```

### Component Specs

#### `lib/enable-banking/transactions.ts`
```typescript
// Requirements:
// - Fetch transactions with date range filtering
// - Handle continuation_key for pagination
// - Support PSU headers for online fetching
// - Handle empty transaction lists with continuation keys

export interface FetchTransactionsOptions {
  sessionId: string;
  accountId: string;
  dateFrom?: string;  // YYYY-MM-DD
  dateTo?: string;
  continuationKey?: string;
  psuHeaders?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface TransactionsResponse {
  transactions: EnableBankingTransaction[];
  continuation_key?: string;
}

export async function fetchTransactions(
  options: FetchTransactionsOptions
): Promise<TransactionsResponse> {
  const { sessionId, accountId, dateFrom, dateTo, continuationKey, psuHeaders } = options;
  
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (continuationKey) params.append('continuation_key', continuationKey);
  
  const headers: Record<string, string> = {
    'X-Session-Id': sessionId,
  };
  
  // Add PSU headers for online fetching (avoids rate limits)
  if (psuHeaders?.ipAddress) {
    headers['Psu-Ip-Address'] = psuHeaders.ipAddress;
  }
  if (psuHeaders?.userAgent) {
    headers['Psu-User-Agent'] = psuHeaders.userAgent;
  }
  
  return enableBankingFetch<TransactionsResponse>(
    `/accounts/${accountId}/transactions?${params}`,
    { headers }
  );
}

// Fetch all transactions with automatic pagination
export async function fetchAllTransactions(
  options: Omit<FetchTransactionsOptions, 'continuationKey'>
): Promise<EnableBankingTransaction[]> {
  const allTransactions: EnableBankingTransaction[] = [];
  let continuationKey: string | undefined;
  
  do {
    const response = await fetchTransactions({
      ...options,
      continuationKey,
    });
    
    allTransactions.push(...response.transactions);
    continuationKey = response.continuation_key;
    
    // Safety limit to prevent infinite loops
    if (allTransactions.length > 10000) {
      console.warn('Transaction limit reached, stopping pagination');
      break;
    }
  } while (continuationKey);
  
  return allTransactions;
}
```

#### `lib/sync/deduplication.ts`
```typescript
// Requirements:
// - Generate consistent hash for transaction matching
// - Handle transactions without entry_reference
// - Match on date + amount + description combination
// - Mark source as 'sync' for Enable Banking transactions

export function generateTransactionHash(tx: EnableBankingTransaction): string {
  // Prefer entry_reference if available
  if (tx.entry_reference) {
    return `eb:${tx.entry_reference}`;
  }
  
  // Fallback: hash of date + amount + description
  const description = tx.remittance_information?.join(' ') || 
                     tx.creditor?.name || 
                     tx.debtor?.name || 
                     'unknown';
  
  const hashInput = [
    tx.booking_date,
    tx.transaction_amount.amount,
    tx.transaction_amount.currency,
    tx.credit_debit_indicator,
    description.substring(0, 50).toLowerCase(),
  ].join('|');
  
  return `hash:${createHash('sha256').update(hashInput).digest('hex').substring(0, 16)}`;
}

export async function findDuplicates(
  supabase: SupabaseClient,
  accountId: string,
  transactions: EnableBankingTransaction[]
): Promise<Set<string>> {
  const hashes = transactions.map(generateTransactionHash);
  
  const { data: existing } = await supabase
    .from('transactions')
    .select('enable_banking_id')
    .eq('account_id', accountId)
    .in('enable_banking_id', hashes);
  
  return new Set(existing?.map(t => t.enable_banking_id) || []);
}
```

#### `lib/sync/transaction-sync.ts`
```typescript
// Requirements:
// - Orchestrate full sync for an account
// - Skip duplicates
// - Map Enable Banking fields to our schema
// - Trigger categorisation for new transactions
// - Update last_sync timestamp

export interface SyncResult {
  accountId: string;
  transactionsProcessed: number;
  transactionsAdded: number;
  transactionsSkipped: number;
  errors: string[];
}

export async function syncTransactions(
  accountId: string,
  options?: { dateFrom?: string; dateTo?: string }
): Promise<SyncResult> {
  // Implementation:
  // 1. Get account with Enable Banking session
  // 2. Validate session is active
  // 3. Fetch transactions from Enable Banking
  // 4. Find duplicates
  // 5. Map and insert new transactions
  // 6. Update sync timestamp
  // 7. Return result summary
}

function mapToTransaction(
  ebTx: EnableBankingTransaction,
  accountId: string
): Omit<Transaction, 'id'> {
  const amount = parseFloat(ebTx.transaction_amount.amount);
  const signedAmount = ebTx.credit_debit_indicator === 'DBIT' ? -amount : amount;
  
  return {
    account_id: accountId,
    date: ebTx.booking_date,
    amount: signedAmount,
    description: ebTx.remittance_information?.join(' ') || 
                 ebTx.creditor?.name || 
                 ebTx.debtor?.name || 
                 'Unknown transaction',
    category_id: null, // To be categorised
    categorisation_source: null,
    enable_banking_id: generateTransactionHash(ebTx),
    created_at: new Date().toISOString(),
  };
}
```

### Database Changes
```sql
-- Add Enable Banking reference to transactions
ALTER TABLE transactions
ADD COLUMN enable_banking_id TEXT UNIQUE;

-- Add sync tracking to accounts
ALTER TABLE accounts
ADD COLUMN last_sync_at TIMESTAMPTZ,
ADD COLUMN sync_enabled BOOLEAN DEFAULT false;

-- Index for deduplication lookups
CREATE INDEX idx_transactions_enable_banking_id 
ON transactions(enable_banking_id) 
WHERE enable_banking_id IS NOT NULL;
```

### Verification Steps
1. Unit test transaction hash generation (consistent, deterministic)
2. Unit test duplicate detection with mock data
3. Integration test full sync with test account
4. Verify no duplicate transactions created
5. Verify correct amount sign (negative for debits)

### Do NOT
- Insert duplicate transactions
- Ignore continuation_key pagination
- Skip PSU headers (may cause rate limiting)
- Hardcode date ranges
```

---

### Prompt 3.4: Sync Scheduling & Manual Trigger

```markdown
## Task: Implement Sync Scheduling and Manual Trigger

Create API routes and optional cron job for transaction syncing.

### File Structure
```
app/
├── api/
│   └── sync/
│       ├── trigger/
│       │   └── route.ts      # POST manual sync trigger
│       └── status/
│           └── route.ts      # GET sync status
├── (dashboard)/
│   └── settings/
│       └── sync/
│           └── page.tsx      # Sync settings UI
```

### Component Specs

#### `app/api/sync/trigger/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { syncTransactions } from '@/lib/sync/transaction-sync';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, dateFrom, dateTo } = body;
    
    // Validate account exists and has sync enabled
    const supabase = createServerClient();
    const { data: account } = await supabase
      .from('accounts')
      .select('*, enable_banking_sessions(*)')
      .eq('id', accountId)
      .single();
    
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    if (!account.sync_enabled) {
      return NextResponse.json({ error: 'Sync not enabled for this account' }, { status: 400 });
    }
    
    // Perform sync
    const result = await syncTransactions(accountId, { dateFrom, dateTo });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
```

#### `app/api/sync/status/route.ts`
```typescript
// GET sync status for all accounts
export async function GET() {
  const supabase = createServerClient();
  
  const { data: accounts } = await supabase
    .from('accounts')
    .select(`
      id,
      name,
      sync_enabled,
      last_sync_at,
      enable_banking_sessions (
        valid_until
      )
    `)
    .eq('sync_enabled', true);
  
  return NextResponse.json({
    accounts: accounts?.map(a => ({
      id: a.id,
      name: a.name,
      lastSync: a.last_sync_at,
      sessionValid: a.enable_banking_sessions?.[0]?.valid_until 
        ? new Date(a.enable_banking_sessions[0].valid_until) > new Date()
        : false,
    })) || [],
  });
}
```

#### Cron Job (Optional - Vercel Cron)
```typescript
// app/api/cron/sync/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Sync all enabled accounts
  const supabase = createServerClient();
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('sync_enabled', true);
  
  const results = await Promise.allSettled(
    (accounts || []).map(a => syncTransactions(a.id))
  );
  
  return NextResponse.json({
    synced: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}

export const runtime = 'edge';
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Verification Steps
1. Manual trigger API returns sync result
2. Status API shows all sync-enabled accounts
3. Cron route protected by secret
4. Sync respects session validity

### Do NOT
- Expose cron endpoint without authentication
- Sync accounts with expired sessions
- Block on slow syncs (use background processing for production)
```

---

## Agent Workflow

After each implementation prompt, follow the standard agent workflow:

```
1. /test-plan analyze                    # Check coverage gaps
2. /test-build feature:enable-banking    # Generate tests
3. /test-execute quick                   # Run tests
4. /code-review staged                   # Review before commit
5. git commit -m "feat(phase3): ..."     # Commit changes
```

Before completing Phase 3:
```
1. /test-execute pre-merge
2. /code-review branch
3. /merge-feature phase3-enable-banking
```

---

## Testing Strategy

### Unit Tests
- JWT generation and signing
- Transaction hash generation (deterministic)
- Duplicate detection logic
- Field mapping (Enable Banking → our schema)

### Integration Tests
- Full sync with mock Enable Banking responses
- Database operations (insert, dedup)
- API route responses

### Manual Testing
- Link real HSBC account via Enable Banking Control Panel
- Trigger sync via API
- Verify transactions appear in UI
- Verify no duplicates on re-sync

---

## Rollback Plan

If Enable Banking integration fails:
1. Set `sync_enabled = false` for all accounts
2. Continue with manual CSV import (Phase 3 fallback)
3. Transactions already synced remain in database
4. Remove Enable Banking code in future cleanup

---

## Security Considerations

1. **Private Key Storage**: Use environment variables, never commit
2. **Session IDs**: Store in database, not in client
3. **API Tokens**: Generate fresh JWT for each request
4. **Rate Limiting**: Respect 429 responses, implement backoff
5. **Consent**: Sessions expire after 90 days max, handle re-auth

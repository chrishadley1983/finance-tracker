# Personal Finance Application

**Product Requirements Document**  
**Version:** 3.0  
**Date:** January 2026  
**Methodology:** Agent-First Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technical Stack](#2-technical-stack)
3. [Core Features](#3-core-features)
4. [Database Schema](#4-database-schema)
5. [Implementation Phases](#5-implementation-phases-agent-first)
6. [Agent System](#6-agent-system)
7. [Success Metrics](#7-success-metrics)

---

## 1. Executive Summary

A single-user web application to replace the "Life Planning V2" spreadsheet and MoneyHub aggregator. The app provides transaction tracking, budgeting, wealth monitoring, and FIRE projections backed by Supabase, with AI-powered CSV import for bank transaction data.

**Key Differentiator:** This project follows an agent-first development methodology using the Domain Memory Pattern. The agent infrastructure is built and validated before any feature development begins, ensuring consistent quality and verifiable progress throughout the project.

### 1.1 Related Documents

| Document | Purpose |
|----------|---------|
| `agent-infrastructure-spec.md` | Complete domain memory pattern implementation |
| `skeleton-app-setup-prompt.md` | Instructions for building the agent test harness |
| `phase3a-csv-import-prompts.md` | Core CSV import implementation |
| `phase3b-ai-import-prompts.md` | AI-powered import enhancements |
| `phase4-investment-accounts-prompts.md` | Investment tracking implementation |
| `docs/agents/*/spec.md` | Individual agent specifications |

### 1.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial PRD |
| 2.0 | Dec 2025 | Agent-first methodology, converted to markdown |
| 3.0 | Jan 2026 | Enable Banking integration, Investment Accounts feature |

---

## 2. Technical Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 14 (App Router) | Familiar stack, good DX, server components |
| **Database** | Supabase (Postgres) | Rapid development, good tooling |
| **Auth** | None (MVP) | Single user, local deployment |
| **CSV Parsing** | PapaParse | Robust parsing, encoding detection |
| **AI/LLM** | Claude API | Column mapping & transaction categorisation |
| **Hosting** | Vercel | Easy deployment, free tier |

---

## 3. Core Features

### 3.1 Transaction Management

- **CSV import** with auto-format detection (HSBC, Monzo, Amex, custom)
- **AI-powered column mapping** for unknown CSV formats
- Manual transaction entry for one-off items
- Multi-account support with account types
- Smart deduplication on import (hash-based + fuzzy matching)
- Historical import from spreadsheet (6,848 transactions imported)

### 3.2 Investment Account Tracking (NEW)

Investment platforms (Vanguard, Interactive Investor, L&G) don't support Open Banking APIs. These accounts use manual value tracking:

- Add investment accounts with provider, type, and reference
- Record periodic valuations (amount, date, notes)
- Track holdings value over time
- Support for ISA, SIPP, GIA account types
- No transaction-level detail (just point-in-time values)

### 3.3 AI Categorisation

- Seed 50+ existing mapping rules from spreadsheet
- Exact match → Fuzzy match → Claude API fallback
- User corrections feed learning loop
- Category review queue for uncertain matches

### 3.4 Budget Tracking

- Monthly budgets by category (~40 categories)
- Budget vs Actual dashboard (monthly + YTD)
- Historical comparison (2021 onwards)
- Category groupings with subtotals

### 3.5 Wealth Tracking

- Monthly snapshots of all assets (automated for bank accounts)
- Investment account valuations (manual entry)
- Property value + mortgage tracking
- Net worth over time visualisation
- Consolidated view across all account types

### 3.6 FIRE Calculator

- Configurable inputs (save rate, return assumptions, retire age)
- Multiple spend scenarios (FULL/HIGH/MEDIUM/LOW)
- Year-by-year projection table
- Coast FI calculations
- State pension integration

---

## 4. Database Schema

### 4.1 accounts

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| name | text | Display name (e.g., "HSBC Current") |
| type | enum | current, savings, pension, isa, investment, property |
| provider | text | Bank/provider name |
| account_reference | text nullable | External reference (account number, policy ID) |
| is_active | boolean | Whether account is actively tracked |
| sync_enabled | boolean | Whether Enable Banking sync is enabled |
| last_sync_at | timestamptz nullable | Last successful sync timestamp |
| enable_banking_account_id | text nullable | Enable Banking account reference |
| created_at | timestamptz | Record creation timestamp |

### 4.2 enable_banking_sessions (NEW)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| account_id | uuid FK | Reference to accounts table |
| session_id | text UNIQUE | Enable Banking session ID |
| valid_until | timestamptz | Session expiry timestamp |
| created_at | timestamptz | Record creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### 4.3 transactions

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| account_id | uuid FK | Reference to accounts table |
| date | date | Transaction date |
| amount | decimal(12,2) | Amount (negative = expense) |
| description | text | Transaction description |
| category_id | uuid FK | Reference to categories table |
| categorisation_source | enum | manual, rule, ai, import, sync |
| enable_banking_id | text nullable UNIQUE | Enable Banking transaction hash (dedup) |
| created_at | timestamptz | Record creation timestamp |

### 4.4 categories

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| name | text | Category name |
| group_name | text | Parent group for subtotals |
| is_income | boolean | Income vs expense |
| display_order | int | Sort order in UI |

### 4.5 category_mappings

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| pattern | text | Match pattern (exact or fuzzy) |
| category_id | uuid FK | Target category |
| match_type | enum | exact, contains, regex |
| confidence | decimal | Match confidence threshold |

### 4.6 budgets

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| category_id | uuid FK | Reference to categories |
| year | int | Budget year |
| month | int | Budget month (1-12) |
| amount | decimal(12,2) | Budgeted amount |

### 4.7 investment_valuations (NEW)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| account_id | uuid FK | Reference to accounts table |
| date | date | Valuation date |
| value | decimal(14,2) | Account value on this date |
| notes | text nullable | Optional notes (e.g., "Added £500 contribution") |
| created_at | timestamptz | Record creation timestamp |

### 4.8 wealth_snapshots

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| date | date | Snapshot date (typically month-end) |
| account_id | uuid FK | Reference to accounts |
| balance | decimal(12,2) | Account balance |
| notes | text nullable | Optional notes |

### 4.9 fire_parameters

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| scenario_name | text | e.g., "FULL", "MEDIUM" |
| annual_spend | decimal(12,2) | Projected annual spend |
| withdrawal_rate | decimal(4,2) | Safe withdrawal rate % |
| expected_return | decimal(4,2) | Expected investment return % |
| retirement_age | int | Target retirement age |
| state_pension_age | int | State pension start age |
| state_pension_amount | decimal(12,2) | Expected annual state pension |

---

## 5. Implementation Phases (Agent-First)

> **Critical:** This project follows an agent-first development methodology. Phase 0 builds and validates the complete agent infrastructure before any feature development begins. Refer to the `agent-infrastructure-spec.md` for detailed implementation guidance.

### Phase 0: Agent Infrastructure (Days 1-2) ✅ COMPLETE

**Goal:** Build and validate the complete agent framework before writing any feature code.

1. ✅ Create Next.js 14 project scaffold
2. ✅ Set up `docs/agents/` directory structure
3. ✅ Create `state.json` files for all 5 agents
4. ✅ Create `feature-status.json` truth file
5. ✅ Create `file-feature-map.json` for invalidation
6. ✅ Create `.claude/commands/` slash command files
7. ✅ Create minimal skeleton app (health endpoint, Button component)
8. ✅ Validate all 5 agents work correctly
9. ✅ Validate boot sequence and change detection

**Exit Criteria:** All agents operational, boot sequence working, change detection validated.

---

### Phase 1: Data Layer (Week 1-2) ✅ COMPLETE

**Goal:** Database schema and historical data import.

1. ✅ Supabase project setup
2. ✅ Database migrations (7 tables)
3. ✅ Spreadsheet import scripts
4. ✅ Import 6,848 transactions
5. ✅ Import wealth snapshots (109 months)
6. ✅ Import categories and budgets
7. ✅ Seed category mappings (50+ rules)
8. ✅ API routes with Zod validation (131 tests passing)

**Agent Workflow:** `/test-plan analyze` → `/test-build feature:data-layer` → `/test-execute` → `/code-review` → `/merge-feature`

---

### Phase 2: Core UI (Week 3-4) ✅ COMPLETE

**Goal:** Transaction list, categories, basic budgets.

1. ✅ Layout structure (Sidebar, Header)
2. ✅ Transaction list with filtering/sorting/pagination
3. ✅ Dashboard with summary cards
4. ✅ Recent transactions widget
5. ✅ Spending by category chart
6. ✅ Monthly trend chart
7. ✅ Dashboard API routes

---

### Phase 3a: Core CSV Import (Week 5-6) 🔄 IN PROGRESS

**Goal:** Robust CSV import with format detection and duplicate handling.

> **Architecture Decision:** UK Open Banking requires FCA registration for personal use. Enable Banking only covers EU/EEA post-Brexit. Instead, we're building a best-in-class CSV import experience that handles HSBC, Monzo, Amex, and custom formats.

#### 3a.1 Database & Types
- [ ] import_sessions table (track imports)
- [ ] import_formats table (known format templates)
- [ ] imported_transaction_hashes table (deduplication)
- [ ] TypeScript types for import pipeline

#### 3a.2 CSV Parsing Service
- [ ] Core parser with encoding detection
- [ ] Format auto-detection (HSBC, Monzo, Amex)
- [ ] Date/amount normalizers
- [ ] Row validation

#### 3a.3 Import API Routes
- [ ] POST /api/import/upload (parse & detect)
- [ ] GET/POST /api/import/formats (templates)
- [ ] POST /api/import/preview (with mapping)
- [ ] POST /api/import/duplicates (check)
- [ ] POST /api/import/execute (commit)

#### 3a.4 UI: Upload & Mapping
- [ ] Drag-drop upload zone
- [ ] Format detection display
- [ ] Column mapping interface
- [ ] Date/amount format options

#### 3a.5 UI: Preview & Execute
- [ ] Transaction preview table
- [ ] Validation summary
- [ ] Duplicate review modal
- [ ] Import progress & completion

#### 3a.6 Integration & Polish
- [ ] Navigation integration
- [ ] Error handling & edge cases
- [ ] Mobile responsiveness

**Implementation Guide:** See `phase3a-csv-import-prompts.md`

---

### Phase 3b: AI-Powered Import (Week 7) 🆕

**Goal:** Intelligent categorisation and advanced editing during import.

#### 3b.1 AI Column Mapping
- [ ] Claude-powered format analysis
- [ ] Mapping suggestion API
- [ ] Caching and rate limiting

#### 3b.2 Categorisation Engine
- [ ] Rule-based matching (exact, pattern)
- [ ] Similar transaction lookup
- [ ] AI fallback categorisation

#### 3b.3 Categorisation UI
- [ ] Auto-categorise on preview
- [ ] Confidence indicators
- [ ] Inline category editing
- [ ] Bulk categorisation tools

#### 3b.4 Bulk Edit Mode
- [ ] Inline cell editing
- [ ] Multi-select & bulk actions
- [ ] Transaction splitting
- [ ] Undo/redo support

#### 3b.5 Import Templates
- [ ] Save custom mappings
- [ ] Template selector
- [ ] Template management page

#### 3b.6 Category Learning
- [ ] Correction tracking
- [ ] Rule suggestion system
- [ ] Rules management UI

**Implementation Guide:** See `phase3b-ai-import-prompts.md`

---

### Phase 4: Investment Accounts (Week 8) 🆕 NEW PHASE

**Goal:** Manual tracking for investment platforms (Vanguard, ii, L&G).

> **Rationale:** Investment platforms don't support Open Banking. This phase adds a simple manual valuation tracking system for these accounts.

#### 4.1 Database Schema
- [ ] Create `investment_valuations` table
- [ ] Add investment-specific fields to accounts

#### 4.2 Investment Account Management
- [ ] Add investment account form (provider, type, reference)
- [ ] List investment accounts with latest valuations
- [ ] Edit/archive investment accounts

#### 4.3 Valuation Entry
- [ ] Add valuation form (date, value, notes)
- [ ] Valuation history list per account
- [ ] Edit/delete valuations
- [ ] Import historical valuations from spreadsheet

#### 4.4 Investment Dashboard Widget
- [ ] Total investment value card
- [ ] Value by provider breakdown
- [ ] Simple growth chart over time

**Supported Providers:**
- Vanguard UK (ISA, SIPP)
- Interactive Investor (ISA, SIPP, GIA)
- Legal & General (Workplace Pension)
- Other (manual entry)

---

### Phase 5: AI Categorisation (Week 9-10)

**Goal:** Smart categorisation with learning.

1. Rule-based exact match
2. Fuzzy matching for similar descriptions
3. Claude API fallback for novel transactions
4. User correction capture
5. Category review queue
6. Auto-categorise synced transactions

---

### Phase 6: Wealth & FIRE (Week 11-12)

**Goal:** Wealth tracking and FIRE projections.

1. Consolidated net worth view (bank + investments)
2. Net worth over time charts
3. FIRE calculator with multiple scenarios
4. Year-by-year projection tables
5. Coast FI calculations
6. Investment growth projections

---

### Phase 7: Polish (Week 13)

**Goal:** Production readiness and deployment.

1. Error handling improvements
2. Performance optimisation
3. UI polish and responsiveness
4. Vercel deployment
5. Documentation

---

## 6. Agent System

Development is supported by 5 specialised agents following the Domain Memory Pattern. See `agent-infrastructure-spec.md` for complete details.

### 6.1 Core Agents

| Agent | Command | Purpose | Output |
|-------|---------|---------|--------|
| Test Plan | `/test-plan` | Analyse coverage gaps | coverage-analysis.md |
| Test Build | `/test-build` | Generate test files | tests/**/*.test.ts |
| Test Execute | `/test-execute` | Run tests, update truth | feature-status.json |
| Code Review | `/code-review` | Review against standards | Review report |
| Merge Feature | `/merge-feature` | Safe branch merge | Merge report |

### 6.2 Standard Development Workflow

- **During development:** `/test-execute quick`, `/code-review staged`
- **Before merge:** `/test-execute pre-merge`, `/code-review branch`
- **To merge:** `/merge-feature <branch>`
- **Adding tests:** `/test-plan analyze` → `/test-build` → `/test-execute`

### 6.3 Future Agents (Optional)

| Agent | Purpose | When to Add |
|-------|---------|-------------|
| Feature Spec | Transform ideas to specs | When planning becomes bottleneck |
| Documentation | Maintain knowledge base | When docs become stale |
| Database | Manage migrations, RLS | When schema changes frequently |
| Security | Scan vulnerabilities | Before production |
| Performance | Analyse bundle, queries | When performance matters |

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Transaction import accuracy | 100% (no missing transactions) |
| CSV format detection accuracy | >95% for known formats |
| Auto-categorisation accuracy | >90% after training period |
| Time to import monthly transactions | <2 minutes |
| Spreadsheet feature parity | 100% by MVP |
| Test coverage | >80% for all features |
| Agent framework validation | All 5 agents operational before Phase 1 |

---

## Appendix A: Integration Approach Summary

| Data Source | Integration Method | Frequency | Automation |
|-------------|-------------------|-----------|------------|
| **HSBC** | CSV Import | Weekly/Monthly | Manual upload |
| **Monzo** | CSV Import | Weekly/Monthly | Manual upload |
| **Amex** | CSV Import | Monthly | Manual upload |
| **Vanguard UK** | Manual valuation entry | Monthly | Manual |
| **Interactive Investor** | Manual valuation entry | Monthly | Manual |
| **L&G Pension** | Manual valuation entry | Quarterly | Manual |
| **Property** | Manual value update | Annually | Manual |

---

## Appendix B: Supported CSV Formats

### HSBC Current Account
- Columns: Date, Type, Description, Paid Out, Paid In, Balance
- Date format: DD/MM/YYYY
- Separate debit (Paid Out) and credit (Paid In) columns

### HSBC Credit Card
- Columns: Date, Description, Amount
- Date format: DD/MM/YYYY
- Single amount column (positive = charge)

### Monzo
- Columns: Transaction ID, Date, Time, Type, Name, Emoji, Category, Amount, Currency, Local amount, Local currency, Notes and #tags, Address, Receipt, Description, Category split, Money Out, Money In
- Date format: DD/MM/YYYY
- Amount column primary

### Amex UK
- Columns: Date, Description, Amount
- Date format: DD/MM/YYYY
- Single amount column

### Custom Formats
- AI-powered column mapping for unknown formats
- Save as templates for reuse

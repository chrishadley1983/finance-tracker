# Personal Finance Application

**Product Requirements Document**  
**Version:** 2.0  
**Date:** December 2025  
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

A single-user web application to replace the "Life Planning V2" spreadsheet and MoneyHub aggregator. The app provides transaction tracking, budgeting, wealth monitoring, and FIRE projections backed by Supabase, with HSBC Open Banking integration for automated transaction import.

**Key Differentiator:** This project follows an agent-first development methodology using the Domain Memory Pattern. The agent infrastructure is built and validated before any feature development begins, ensuring consistent quality and verifiable progress throughout the project.

### 1.1 Related Documents

| Document | Purpose |
|----------|---------|
| `agent-infrastructure-spec.md` | Complete domain memory pattern implementation |
| `skeleton-app-setup-prompt.md` | Instructions for building the agent test harness |
| `docs/agents/*/spec.md` | Individual agent specifications |

---

## 2. Technical Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 14 (App Router) | Familiar stack, good DX, server components |
| **Database** | Supabase (Postgres) | Rapid development, good tooling |
| **Auth** | None (MVP) | Single user, local deployment |
| **Open Banking** | HSBC Direct API | Free, no aggregator needed |
| **AI/LLM** | Claude API | Transaction categorisation fallback |
| **Hosting** | Vercel | Easy deployment, free tier |

---

## 3. Core Features

### 3.1 Transaction Management

- HSBC Open Banking auto-sync (90-day consent refresh)
- Manual transaction entry for non-HSBC accounts
- Multi-account support with account types
- Deduplication on import
- Historical import from spreadsheet (5,400+ transactions)

### 3.2 AI Categorisation

- Seed 50+ existing mapping rules from spreadsheet
- Exact match → Fuzzy match → Claude API fallback
- User corrections feed learning loop
- Category review queue for uncertain matches

### 3.3 Budget Tracking

- Monthly budgets by category (~40 categories)
- Budget vs Actual dashboard (monthly + YTD)
- Historical comparison (2021 onwards)
- Category groupings with subtotals

### 3.4 Wealth Tracking

- Monthly snapshots of all assets
- Manual entry for pensions/ISAs
- Property value + mortgage tracking
- Net worth over time visualisation

### 3.5 FIRE Calculator

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
| hsbc_account_id | text nullable | HSBC API account reference |
| is_active | boolean | Whether account is actively tracked |

### 4.2 transactions

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| account_id | uuid FK | Reference to accounts table |
| date | date | Transaction date |
| amount | decimal(12,2) | Amount (negative = expense) |
| description | text | Transaction description |
| category_id | uuid FK | Reference to categories table |
| categorisation_source | enum | manual, rule, ai, import |
| hsbc_transaction_id | text nullable | HSBC API transaction ID (dedup) |

### 4.3 categories

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| name | text | Category name |
| group_name | text | Parent group for subtotals |
| is_income | boolean | Income vs expense |
| display_order | int | Sort order in UI |

### 4.4 category_mappings

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| pattern | text | Match pattern (exact or fuzzy) |
| category_id | uuid FK | Target category |
| match_type | enum | exact, contains, regex |
| confidence | decimal | Match confidence threshold |

### 4.5 budgets

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| category_id | uuid FK | Reference to categories |
| year | int | Budget year |
| month | int | Budget month (1-12) |
| amount | decimal(12,2) | Budgeted amount |

### 4.6 wealth_snapshots

| Field | Type | Description |
|-------|------|-------------|
| id | uuid PK | Primary key |
| date | date | Snapshot date (typically month-end) |
| account_id | uuid FK | Reference to accounts |
| balance | decimal(12,2) | Account balance |
| notes | text nullable | Optional notes |

### 4.7 fire_parameters

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

### Phase 0: Agent Infrastructure (Days 1-2)

**Goal:** Build and validate the complete agent framework before writing any feature code.

1. Create Next.js 14 project scaffold
2. Set up `docs/agents/` directory structure
3. Create `state.json` files for all 5 agents
4. Create `feature-status.json` truth file
5. Create `file-feature-map.json` for invalidation
6. Create `.claude/commands/` slash command files
7. Create minimal skeleton app (health endpoint, Button component)
8. Validate all 5 agents work correctly
9. Validate boot sequence and change detection

**Exit Criteria:** All agents operational, boot sequence working, change detection validated.

---

### Phase 1: Data Layer (Week 1-2)

**Goal:** Database schema and historical data import.

1. Supabase project setup
2. Database migrations (7 tables)
3. Spreadsheet import scripts
4. Import 5,400+ transactions
5. Import wealth snapshots (109 months)
6. Import categories and budgets
7. Seed category mappings (50+ rules)

**Agent Workflow:** `/test-plan analyze` → `/test-build feature:data-layer` → `/test-execute` → `/code-review` → `/merge-feature`

---

### Phase 2: Core UI (Week 3-4)

**Goal:** Transaction list, categories, basic budgets.

1. Transaction list with filtering/sorting
2. Manual transaction entry form
3. Category CRUD interface
4. Budget setup dashboard
5. Budget vs Actual reporting

---

### Phase 3: HSBC Integration (Week 5-6)

**Goal:** Open Banking connection and transaction sync.

1. HSBC Developer Portal registration
2. OAuth consent flow implementation
3. Account Info API integration
4. Transaction sync with deduplication
5. Balance sync
6. 90-day consent refresh handling

---

### Phase 4: AI Categorisation (Week 7-8)

**Goal:** Smart categorisation with learning.

1. Rule-based exact match
2. Fuzzy matching for similar descriptions
3. Claude API fallback for novel transactions
4. User correction capture
5. Category review queue

---

### Phase 5: Wealth & FIRE (Week 9-10)

**Goal:** Wealth tracking and FIRE projections.

1. Wealth snapshot entry interface
2. Net worth over time charts
3. FIRE calculator with multiple scenarios
4. Year-by-year projection tables
5. Coast FI calculations

---

### Phase 6: Polish (Week 11-12)

**Goal:** Production readiness and deployment.

1. Error handling improvements
2. Performance optimisation
3. UI polish and responsiveness
4. Vercel deployment
5. Documentation

---

## 6. Agent System

Development is supported by 5 specialised agents following the Domain Memory Pattern. See `agent-infrastructure-spec.md` for complete details.

### 6.1 Core Agents (Phase 1)

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

### 6.3 Future Agents (Phase 2)

When the project grows, additional agents can be added:

| Agent | Purpose | When to Add |
|-------|---------|-------------|
| Feature Spec | Transform ideas to specs | When planning becomes bottleneck |
| Documentation | Maintain knowledge base | When docs become stale |
| Database | Manage migrations, RLS | When schema changes frequently |
| Security | Scan vulnerabilities | Before production |
| Performance | Analyse bundle, queries | When performance matters |
| Release Manager | Coordinate deployments | Regular production releases |
| Dependency | Package updates | When deps become overhead |
| Monitor | Production observability | Production workloads |
| Incident Response | Production issues | When stability is critical |

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Transaction import accuracy | 100% (no missing transactions) |
| Auto-categorisation accuracy | >90% after training period |
| Time to view daily transactions | <30 seconds |
| Spreadsheet feature parity | 100% by MVP |
| Test coverage | >80% for all features |
| Agent framework validation | All 5 agents operational before Phase 1 |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial PRD |
| 2.0 | Dec 2025 | Agent-first methodology, converted to markdown |

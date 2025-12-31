# Agent Infrastructure Specification

**Version:** 1.1  
**Project:** Personal Finance App  
**Methodology:** Domain Memory Pattern  
**Last Updated:** December 2025

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Design Principles](#2-design-principles)
3. [Factory Pattern](#3-factory-pattern)
4. [Memory Architecture](#4-memory-architecture)
5. [Standard Boot Sequence](#5-standard-boot-sequence)
6. [Phase 1 Agents (Core Development)](#6-phase-1-agents-core-development)
7. [Phase 2 Agents (Future Roadmap)](#7-phase-2-agents-future-roadmap)
8. [Agent Workflows](#8-agent-workflows)
9. [Implementation Plan](#9-implementation-plan)
10. [Appendices](#10-appendices)

---

## 1. Introduction

### 1.1 Problem Statement

AI-assisted development suffers from "amnesia" - each session starts fresh with no memory of previous work, decisions, or progress. This leads to:

- Repeated analysis of the same codebase
- Inconsistent approaches across sessions
- No verifiable progress tracking
- Difficulty maintaining quality standards

### 1.2 Solution: Domain Memory Pattern

Based on Anthropic's methodology for building effective AI agents, we implement a **Domain Memory Pattern** where:

- Agents maintain state between runs via external files
- A single "truth file" tracks verifiable progress
- Standard boot sequences ensure agents know what changed
- Atomic work units prevent partial/inconsistent states

### 1.3 Document Relationships

| Document | Purpose |
|----------|---------|
| **This document** | Complete agent framework specification |
| `skeleton-app-setup-prompt.md` | Instructions to build test harness |
| `personal-finance-prd.md` | Product requirements with agent-first phasing |
| `docs/agents/*/spec.md` | Individual agent specifications |

---

## 2. Design Principles

### The 5 Rules

Every agent in this system follows these non-negotiable rules:

#### Rule 1: Externalise the Goal
- Machine-readable backlogs with pass/fail criteria
- No prose-based task lists
- Everything traceable to a state file

#### Rule 2: Atomic Progress
- Pick ONE item from backlog
- Complete it fully
- Update state before moving to next
- Never leave work half-done

#### Rule 3: Clean Campsite
- Every run ends with clean state
- Documentation updated
- No orphaned files or processes
- Next agent can pick up seamlessly

#### Rule 4: Standard Boot-up
- Every run starts identically:
  1. Read memory
  2. Detect changes
  3. Check prerequisites
  4. Act
- No shortcuts or assumptions

#### Rule 5: Tests as Truth
- Pass/fail states tied directly to memory
- Only Test Execution Agent writes to truth file
- Other agents read truth, never write

---

## 3. Factory Pattern

### 3.1 Two Agent Types

All agents fall into one of two categories:

#### Initializer Agents (Stage Managers)

**Characteristics:**
- Set the stage for work
- Expand prompts into structured plans
- Bootstrap domain memory
- Define rules and constraints
- **Do NOT write implementation code**

**Examples:** Test Plan Agent, Code Review Agent, Feature Spec Agent

#### Actor Agents (Coding Agents)

**Characteristics:**
- Start as "amnesiac" - know nothing until they read state
- Follow strict protocol: Read → Pick ONE → Act → Update → Exit
- Rely entirely on external memory
- Produce concrete outputs (code, test results)

**Examples:** Test Build Agent, Test Execution Agent, Merge Feature Agent

### 3.2 Why This Matters

The split prevents:
- Agents that plan AND execute (scope creep)
- Hallucinated progress (claiming work done without verification)
- State corruption (multiple agents writing same files)

---

## 4. Memory Architecture

### 4.1 Directory Structure

```
project-root/
├── .claude/
│   └── commands/           # Slash command definitions
│       ├── test-plan.md
│       ├── test-build.md
│       ├── test-execute.md
│       ├── code-review.md
│       └── merge-feature.md
│
├── docs/
│   ├── agents/
│   │   ├── config/
│   │   │   ├── boot-sequence.md      # Standard boot procedure
│   │   │   └── file-feature-map.json # For invalidation detection
│   │   │
│   │   ├── truth/
│   │   │   └── feature-status.json   # THE source of truth
│   │   │
│   │   ├── test-plan/
│   │   │   ├── spec.md               # Agent specification
│   │   │   └── state.json            # Agent state
│   │   │
│   │   ├── test-build/
│   │   │   ├── spec.md
│   │   │   └── state.json
│   │   │
│   │   ├── test-execute/
│   │   │   ├── spec.md
│   │   │   └── state.json
│   │   │
│   │   ├── code-review/
│   │   │   ├── spec.md
│   │   │   └── state.json
│   │   │
│   │   └── merge-feature/
│   │       ├── spec.md
│   │       └── state.json
│   │
│   ├── knowledge/            # Project documentation
│   │   ├── index.md
│   │   ├── architecture/
│   │   ├── patterns/
│   │   ├── features/
│   │   └── operations/
│   │
│   ├── testing/
│   │   ├── analysis/         # Coverage analysis outputs
│   │   └── execution-history/ # Test run reports
│   │
│   ├── reviews/              # Code review reports
│   └── merges/               # Merge reports
│
├── tests/
│   ├── unit/
│   ├── api/
│   └── e2e/
│
└── CLAUDE.md                 # Router to knowledge base
```

### 4.2 State File Schema

Each agent maintains a `state.json` with this structure:

```json
{
  "agent": "agent-name",
  "lastRun": "2025-01-15T10:30:00Z",
  "lastCommit": "abc123def456",
  "status": "success | failed | partial | blocked",
  "completedWork": [
    {
      "item": "description",
      "timestamp": "ISO-8601",
      "hash": "file-hash-if-applicable"
    }
  ],
  "metrics": {
    "agent-specific-metrics": "here"
  },
  "blockers": [
    {
      "type": "dependency | error | human-required",
      "description": "What's blocking",
      "since": "ISO-8601"
    }
  ],
  "nextAction": "Recommended next command"
}
```

### 4.3 Truth File Schema

`docs/agents/truth/feature-status.json` - The ONLY source of test truth:

```json
{
  "lastUpdated": "2025-01-15T12:00:00Z",
  "updatedBy": "test-execute",
  "features": {
    "transactions": {
      "unit": {
        "status": "pass | fail | none",
        "count": 12,
        "passed": 12,
        "failed": 0,
        "coverage": 85,
        "lastRun": "2025-01-15T12:00:00Z"
      },
      "api": { "...": "..." },
      "e2e": { "...": "..." }
    }
  },
  "summary": {
    "totalFeatures": 6,
    "passing": 4,
    "failing": 1,
    "untested": 1,
    "overallCoverage": 68
  }
}
```

**Critical:** Only the Test Execution Agent may write to this file.

### 4.4 File-Feature Map

`docs/agents/config/file-feature-map.json` - Maps source files to features for invalidation:

```json
{
  "description": "Maps source files to features they affect",
  "patterns": [
    { "glob": "app/api/transactions/**", "features": ["transactions"] },
    { "glob": "app/api/categories/**", "features": ["categories", "budgets"] },
    { "glob": "components/TransactionList*", "features": ["transactions"] },
    { "glob": "lib/supabase/**", "features": ["*"] },
    { "glob": "lib/hsbc/**", "features": ["banking", "transactions"] }
  ]
}
```

---

## 5. Standard Boot Sequence

**EVERY agent run MUST execute this sequence. No exceptions.**

### Phase 0: Read Core Context
```bash
cat CLAUDE.md
```
Extract: Project rules, current focus, critical patterns.

### Phase 1: Read Agent State
```bash
cat docs/agents/<agent-name>/state.json
```
Extract: lastRun, lastCommit, completedWork, blockers.

If state.json doesn't exist, this is first run - proceed with defaults.

### Phase 2: Detect Changes Since Last Run
```bash
# Get commits since last run (skip if first run)
git log <lastCommit>..HEAD --oneline

# Get changed files since last run
git diff --name-only <lastCommit>..HEAD
```
Record: Number of commits, files changed, days elapsed.

### Phase 3: Check for Invalidations
1. Read `docs/agents/config/file-feature-map.json`
2. For each changed file, identify affected features
3. For each item in `completedWork`, check if source files changed
4. Mark affected work as "invalidated"

### Phase 4: Read Feature Truth
```bash
cat docs/agents/truth/feature-status.json
```
Merge with invalidation results to get effective backlog.

### Phase 5: Report Boot Status
```markdown
## <Agent Name> - Boot Complete

**Last run:** X days ago (<date>)
**Commits since:** N
**Files changed:** N

**Invalidations:**
- <list any invalidated work>

**Effective backlog:**
- <list items needing work>

**Proceeding with mode:** <mode>
```

### Phase 6: Proceed or Wait
- If blockers exist → Report and stop
- If human decision needed → Ask and wait
- Otherwise → Proceed with work

### Phase 7: Update State on Completion
After work completes, update state.json:
- Set `lastRun` to current timestamp
- Set `lastCommit` to current HEAD
- Update `status`
- Add to `completedWork`
- Clear resolved `blockers`
- Set `nextAction` recommendation

---

## 6. Phase 1 Agents (Core Development)

These 5 agents form the core development workflow and are implemented immediately.

### 6.1 Test Plan Agent

| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/test-plan <mode>` |
| **Purpose** | Analyse codebase for test coverage gaps |
| **Modes** | `analyze`, `validate-regression`, `generate-manifest`, `feature:<n>` |
| **Output** | `docs/testing/analysis/coverage-analysis.md` |
| **Hands off to** | Test Build Agent |

**Specification:** `docs/agents/test-plan/spec.md`

### 6.2 Test Build Agent

| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/test-build <mode>` |
| **Purpose** | Generate test files to fill coverage gaps |
| **Modes** | `critical`, `high`, `feature:<n>`, `type:<type>`, `all` |
| **Output** | `tests/**/*.test.ts`, `tests/**/*.spec.ts` |
| **Hands off to** | Test Execution Agent |

**Specification:** `docs/agents/test-build/spec.md`

### 6.3 Test Execution Agent

| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/test-execute <mode>` |
| **Purpose** | Run tests, capture results, update truth file |
| **Modes** | `quick`, `unit`, `api`, `e2e`, `pre-merge`, `feature:<n>` |
| **Output** | `docs/agents/truth/feature-status.json` (updated) |
| **Special** | ONLY agent that writes to feature-status.json |

**Specification:** `docs/agents/test-execute/spec.md`

### 6.4 Code Review Agent

| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/code-review <mode>` |
| **Purpose** | Review code changes against standards |
| **Modes** | `staged`, `branch`, `dry`, `security`, `performance`, `full` |
| **Output** | `docs/reviews/YYYY-MM-DD_HH-MM_review.md` |
| **Verdict** | `APPROVED`, `CHANGES_REQUIRED`, `CRITICAL_ISSUES` |

**Specification:** `docs/agents/code-review/spec.md`

### 6.5 Merge Feature Agent

| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/merge-feature <branch>` |
| **Purpose** | Safely merge feature branches with verification |
| **Modes** | `<branch-name>`, `auto`, `list`, `status` |
| **Output** | `docs/merges/YYYY-MM-DD_<branch>.md` |
| **Prerequisites** | Tests pass, code review approved |

**Specification:** `docs/agents/merge-feature/spec.md`

---

## 7. Phase 2 Agents (Future Roadmap)

These agents extend the system for larger projects and production operations. Implement as needed.

### 7.1 Supporting Agents

#### Feature Spec Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/feature-spec <feature-name>` |
| **Purpose** | Transform feature ideas into implementation specifications |
| **Modes** | `create`, `update`, `validate` |
| **Output** | `docs/knowledge/features/<feature>.md` |
| **When to add** | When feature planning becomes a bottleneck |

**Key responsibilities:**
- Parse feature requests into structured specs
- Identify affected components and APIs
- Generate acceptance criteria
- Estimate complexity and dependencies
- Create implementation checklist

---

#### Documentation Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/docs <mode>` |
| **Purpose** | Maintain project knowledge base |
| **Modes** | `update`, `audit`, `query`, `slim`, `onboard` |
| **Output** | `docs/knowledge/**/*.md` |
| **When to add** | When CLAUDE.md exceeds 10k chars or docs become stale |

**Key responsibilities:**
- Keep documentation current with code changes
- Audit for outdated or conflicting information
- Serve relevant context to other agents
- Maintain CLAUDE.md as lean router
- Generate onboarding guides

---

#### Database Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/db <mode>` |
| **Purpose** | Manage database schema and migrations |
| **Modes** | `migrate`, `rollback`, `seed`, `sync`, `audit-rls` |
| **Output** | Migration files, schema documentation |
| **When to add** | When schema changes become frequent |

**Key responsibilities:**
- Generate migration files from schema changes
- Validate RLS policies
- Manage seed data
- Sync local with remote schema
- Document schema decisions

---

#### Security Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/security <mode>` |
| **Purpose** | Scan for vulnerabilities and security issues |
| **Modes** | `scan`, `audit-deps`, `check-auth`, `report` |
| **Output** | `docs/security/YYYY-MM-DD_scan.md` |
| **When to add** | Before production deployment |

**Key responsibilities:**
- Scan code for security vulnerabilities
- Audit npm dependencies for CVEs
- Verify authentication implementation
- Check for hardcoded secrets
- Generate security compliance reports

---

#### Performance Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/perf <mode>` |
| **Purpose** | Analyse and optimise performance |
| **Modes** | `bundle`, `queries`, `lighthouse`, `report` |
| **Output** | `docs/performance/YYYY-MM-DD_report.md` |
| **When to add** | When performance becomes a concern |

**Key responsibilities:**
- Analyse bundle size and suggest code splitting
- Identify slow database queries
- Run Lighthouse audits
- Track performance metrics over time
- Suggest optimisation strategies

---

### 7.2 Operations Agents

#### Release Manager Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/release <version>` |
| **Purpose** | Coordinate deployments and releases |
| **Modes** | `check`, `prepare`, `deploy`, `rollback` |
| **Output** | CHANGELOG.md, git tags, deployment |
| **When to add** | When deploying to production regularly |

**Key responsibilities:**
- Validate release readiness (tests, reviews)
- Generate changelog from commits
- Create version tags
- Coordinate deployment
- Handle rollbacks if needed

---

#### Dependency Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/deps <mode>` |
| **Purpose** | Manage package dependencies |
| **Modes** | `check`, `update`, `audit`, `licenses` |
| **Output** | Dependency reports, update PRs |
| **When to add** | When dependency management becomes overhead |

**Key responsibilities:**
- Check for outdated dependencies
- Assess update risk (breaking changes)
- Audit for security vulnerabilities
- Verify license compliance
- Create safe update PRs

---

#### Monitor Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Initializer |
| **Command** | `/monitor <mode>` |
| **Purpose** | Production observability |
| **Modes** | `status`, `metrics`, `alerts`, `report` |
| **Output** | Health reports, alert configurations |
| **When to add** | When running production workloads |

**Key responsibilities:**
- Monitor application health
- Track key metrics (errors, latency, usage)
- Configure alerting thresholds
- Generate health reports
- Trigger incident response when needed

---

#### Incident Response Agent
| Attribute | Value |
|-----------|-------|
| **Type** | Actor |
| **Command** | `/incident <mode>` |
| **Purpose** | Respond to production incidents |
| **Modes** | `create`, `diagnose`, `resolve`, `postmortem` |
| **Output** | Incident reports, post-mortems |
| **When to add** | When production stability is critical |

**Key responsibilities:**
- Acknowledge and categorise incidents
- Gather diagnostic information
- Identify likely root cause
- Coordinate resolution
- Generate post-mortem documentation

---

### 7.3 Agent Interaction Map

```
                                    ┌─────────────────┐
                                    │  Feature Spec   │
                                    │     Agent       │
                                    └────────┬────────┘
                                             │ creates spec
                                             ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  Documentation  │◄─────────────│   Code Review   │─────────────►│    Security     │
│     Agent       │   updates    │     Agent       │   checks     │     Agent       │
└─────────────────┘              └────────┬────────┘              └─────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│   Test Plan     │─────────────►│   Test Build    │─────────────►│  Test Execute   │
│     Agent       │              │     Agent       │              │     Agent       │
└─────────────────┘              └─────────────────┘              └────────┬────────┘
                                                                           │
                                                                           ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│   Database      │              │ Merge Feature   │◄─────────────│    Release      │
│     Agent       │              │     Agent       │              │    Manager      │
└─────────────────┘              └────────┬────────┘              └────────┬────────┘
                                          │                                │
                                          │                                ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  Dependency     │              │   Performance   │              │    Monitor      │
│     Agent       │              │     Agent       │              │     Agent       │
└─────────────────┘              └─────────────────┘              └────────┬────────┘
                                                                           │
                                                                           ▼
                                                                  ┌─────────────────┐
                                                                  │   Incident      │
                                                                  │   Response      │
                                                                  └─────────────────┘
```

---

## 8. Agent Workflows

### 8.1 Standard Development Cycle

```
1. Developer writes code on feature branch
2. /code-review staged           → Review before commit
3. Developer commits (fix issues if any)
4. /test-execute quick           → Fast validation
5. Repeat 1-4 until feature complete
6. /test-execute pre-merge       → Full test suite
7. /code-review branch           → Complete review
8. /merge-feature <branch>       → Safe merge
```

### 8.2 Adding Test Coverage

```
1. /test-plan analyze            → Identify gaps
2. Review coverage-analysis.md
3. /test-build critical          → Generate critical tests
4. /test-execute quick           → Verify tests pass
5. /test-build high              → Generate high-priority tests
6. Repeat until coverage target met
7. /test-plan analyze            → Verify improvement
```

### 8.3 Agent Dependencies

| Agent | Depends On | Provides |
|-------|------------|----------|
| Test Plan | codebase, feature-status.json | coverage-analysis.md |
| Test Build | coverage-analysis.md | test files |
| Test Execute | test files | feature-status.json (truth) |
| Code Review | git diff, CLAUDE.md | review report |
| Merge Feature | test pass, review approval | merged code |

---

## 9. Implementation Plan

### Phase 0: Agent Infrastructure (Days 1-2)

**Goal:** Build and validate the complete agent framework.

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

### Skeleton App Structure

```
personal-finance/
├── .claude/commands/          # Agent slash commands
├── docs/agents/               # State + truth files
├── app/api/health/route.ts    # One endpoint
├── components/Button.tsx      # One component
├── tests/                     # Empty initially
├── CLAUDE.md                  # Router
└── package.json
```

### Validation Checklist

- [ ] `/test-plan analyze` identifies missing tests
- [ ] `/test-build critical` generates valid test files
- [ ] `/test-execute quick` runs tests, updates feature-status.json
- [ ] `/code-review staged` produces review report
- [ ] `/merge-feature` merges test branch successfully
- [ ] Boot sequence detects changes correctly
- [ ] Invalidation marks stale work correctly
- [ ] State files persist between runs

---

## 10. Appendices

### A. State File Templates

#### Test Plan Agent
```json
{
  "agent": "test-plan",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "featuresAnalysed": 0,
    "gapsIdentified": 0
  },
  "blockers": [],
  "nextAction": "/test-plan analyze"
}
```

#### Test Build Agent
```json
{
  "agent": "test-build",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "testsCreated": 0,
    "filesCreated": 0
  },
  "blockers": [],
  "nextAction": "Awaiting /test-plan analyze"
}
```

#### Test Execution Agent
```json
{
  "agent": "test-execute",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "testsRun": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0
  },
  "blockers": [],
  "nextAction": "Awaiting tests"
}
```

#### Code Review Agent
```json
{
  "agent": "code-review",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "filesReviewed": 0,
    "issuesFound": 0,
    "criticalIssues": 0
  },
  "blockers": [],
  "nextAction": "/code-review staged"
}
```

#### Merge Feature Agent
```json
{
  "agent": "merge-feature",
  "lastRun": null,
  "lastCommit": null,
  "status": null,
  "completedWork": [],
  "metrics": {
    "branchesMerged": 0,
    "conflictsResolved": 0
  },
  "blockers": [],
  "nextAction": "/merge-feature list"
}
```

### B. Initial Truth File

```json
{
  "lastUpdated": null,
  "updatedBy": null,
  "features": {},
  "summary": {
    "totalFeatures": 0,
    "passing": 0,
    "failing": 0,
    "untested": 0,
    "overallCoverage": 0
  }
}
```

### C. Initial File-Feature Map

```json
{
  "description": "Maps source files to features. Used for invalidation detection.",
  "patterns": [
    { "glob": "app/api/health/**", "features": ["health"] },
    { "glob": "components/**", "features": ["ui"] },
    { "glob": "lib/**", "features": ["*"] }
  ],
  "overrides": {}
}
```

### D. References

- Anthropic: "Building Effective Agents" (2024)
- Domain Memory Pattern methodology
- FamilyFuel agent implementation (prior project)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial specification with 5 core agents |
| 1.1 | Dec 2025 | Added Phase 2 agents roadmap, converted to markdown |

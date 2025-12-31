# Personal Finance App - CLAUDE.md

## Project Overview

A personal finance application for tracking transactions, budgets, wealth, and FIRE projections.

**Current Phase:** Phase 0 - Agent Framework Testing

---

## Critical Rules

1. **ALWAYS execute the Standard Boot Sequence** before any agent work
2. **NEVER claim work is complete** without updating state.json
3. **ONLY Test Execution Agent** may write to feature-status.json
4. **Read docs/agents/config/boot-sequence.md** at start of every agent run

---

## Agent Commands

| Command | Purpose |
|---------|---------|
| `/test-plan` | Analyse test coverage gaps |
| `/test-build` | Generate tests for gaps |
| `/test-execute` | Run tests, update truth |
| `/code-review` | Review code changes |
| `/merge-feature` | Safe branch merge |

---

## Directory Structure

```
personal-finance/
├── .claude/commands/     # Agent slash commands
├── docs/
│   ├── agents/           # Agent state & config
│   │   ├── config/       # Shared config
│   │   ├── truth/        # feature-status.json
│   │   └── <agent>/      # Per-agent state
│   ├── knowledge/        # Project documentation
│   ├── testing/          # Test analysis outputs
│   ├── reviews/          # Code review reports
│   └── merges/           # Merge reports
├── app/                  # Next.js app router
├── components/           # React components
├── lib/                  # Shared utilities
└── tests/                # Test files
```

---

## Development Workflow

1. Before any work: Run agent boot sequence
2. During development: `/test-execute quick`, `/code-review staged`
3. Before merge: `/test-execute pre-merge`, `/code-review branch`
4. To merge: `/merge-feature <branch>`

---

## Knowledge Base

- Architecture: `docs/knowledge/architecture.md`
- Patterns: `docs/knowledge/patterns.md`
- Testing: `docs/knowledge/testing.md`

---

## Current Focus

Testing the agent framework with a minimal skeleton app.

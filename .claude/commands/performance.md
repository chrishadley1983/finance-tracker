# Performance Command

You are now operating as the **Performance Agent**. Follow the comprehensive instructions in `docs/agents/performance/spec.md`.

## Quick Reference

### Usage
```
/performance <mode>
```

### Available Modes

| Mode | Description | App Required |
|------|-------------|--------------|
| `full` | Comprehensive analysis | Yes |
| `ui` | React rendering, components | Yes |
| `query` | Supabase queries, indexes | No |
| `bundle` | Bundle size, code splitting | No |
| `api` | Route response times, N+1 | Yes |
| `memory` | Memory leaks, GC pressure | Yes |
| `quick` | Static analysis only | No |
| `compare` | Compare vs baseline | Yes |
| `focus:<path>` | Analyse specific area | Depends |

### Examples
```powershell
/performance quick          # Fast static analysis
/performance full           # Comprehensive audit
/performance ui             # UI performance focus
/performance query          # Database query analysis
/performance focus:app/transactions
```

### Mode Selection Guide

- Pre-merge check? -> `quick`
- Comprehensive audit? -> `full`
- User reporting slow pages? -> `ui`
- Dashboard queries slow? -> `query`
- Build times increasing? -> `bundle`
- API timeouts? -> `api`
- Memory warnings? -> `memory`
- After optimisation? -> `compare`

### Output Files

- Reports: `docs/agents/performance/reports/{date}-performance-report.md`
- Baselines: `docs/agents/performance/reports/baselines/`
- State: `docs/agents/performance/state.json`

### Finance Tracker Focus Areas

- Transaction table (large datasets, pagination)
- Dashboard aggregate queries (summary cards, charts)
- FIRE projection calculations (compound interest over decades)
- Monthly report generation (HTML rendering)
- PDF statement parsing (file processing)
- Wealth snapshot queries (time-series data)

ARGUMENTS: <mode>

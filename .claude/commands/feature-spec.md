# Feature Spec Command

You are now operating as the **Feature Spec Agent**. Follow the comprehensive instructions in `docs/agents/feature-spec/spec.md`.

## Quick Reference

### Usage
```
/feature-spec <feature-name> [mode]
```

### Available Modes

| Mode | Description |
|------|-------------|
| (default) / `new` | Generate fresh spec from criteria |
| `--update` | Update spec based on changed criteria |
| `--validate` | Check spec against current codebase |
| `--review` | Display current spec |

### Examples
```powershell
/feature-spec budget-alerts           # Generate new spec
/feature-spec budget-alerts --update  # After criteria changed
/feature-spec budget-alerts --validate # Pre-build validation
/feature-spec budget-alerts --review   # Show current spec
```

## Purpose

Transforms success criteria (from Define Done) into a concrete implementation plan:

```
Define Done -> Feature Spec -> Build Feature
     |              |              |
done-criteria   feature-spec   Working code
```

**Feature Spec is OPTIONAL** - Build Feature can work directly from done-criteria.md. Use Feature Spec for:
- Complex features with multiple integration points
- Features requiring architecture decisions
- When you want to surface risks before building

## Prerequisites

- `docs/features/<feature>/done-criteria.md` must exist (run `/define-done` first)

## Output

- Feature spec: `docs/features/<feature>/feature-spec.md`

## Spec Sections

1. **Summary** - One paragraph overview
2. **Criteria Mapping** - How spec addresses each criterion
3. **Architecture** - Integration points, diagrams, tech decisions
4. **File Changes** - Create/modify list with estimates
5. **Implementation Details** - Component, API, data flow specs
6. **Build Order** - Sequence of implementation steps
7. **Risks** - Technical, scope, integration risks
8. **Feasibility Validation** - Confirm each criterion is achievable

## Status Outcomes

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `READY_FOR_BUILD` | All criteria feasible | `/build-feature <feature>` |
| `NEEDS_CRITERIA_UPDATE` | Criteria issues found | Update done-criteria.md |
| `BLOCKED_ON_DATABASE` | Schema changes needed | Run migration first |

## Criteria-Driven Planning

Every spec element must trace back to a criterion:

| Criterion | Spec Element |
|-----------|--------------|
| F1: Budget bar visible | UI: Add progress bar to /budgets |
| F2: Alert triggers at threshold | API: Create budget-alert route |
| P1: < 3s for projections | API: Use streaming for FIRE calc |

If a spec element doesn't serve a criterion, question why it's there.

## Feasibility Validation

For each criterion, confirm:
- **Can it be met?** With the planned approach
- **Are there constraints?** That make it impossible
- **Should it be flagged?** For revision

If criteria are not feasible, report with options:
- A) Modify criterion
- B) Remove criterion (descope)
- C) Requires additional work

## Right-Sized Detail

| Feature Size | Spec Detail |
|--------------|-------------|
| Small (1-2 files) | Brief - file paths + key changes |
| Medium (3-10 files) | Moderate - component breakdown + contracts |
| Large (10+ files) | Detailed - full architecture + phases |

Don't over-spec simple features. Don't under-spec complex ones.

## Finance Tracker Patterns

When speccing for Finance Tracker, consider:
- **API features:** Next.js API routes + Zod validation + Supabase (finance schema)
- **CRUD features:** API routes + Supabase queries + forms + tables
- **Dashboard features:** Recharts visualisation + aggregate queries
- **AI features:** Anthropic API + rate limiting + categorisation logic
- **UI:** Tailwind CSS v4 components, Lucide icons, loading/error states

ARGUMENTS: <feature-name> [mode]

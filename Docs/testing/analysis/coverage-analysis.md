# Coverage Analysis

**Generated:** 2025-12-31T12:00:00.000Z
**Agent:** test-plan
**Mode:** analyze

## Summary

| Metric | Value |
|--------|-------|
| Files analysed | 2 |
| Files with tests | 0 |
| Coverage gaps | 2 |

## Source Files Discovered

### API Routes (1 file)
| File | Feature | Has Tests |
|------|---------|-----------|
| `app/api/health/route.ts` | health | No |

### Components (1 file)
| File | Feature | Has Tests |
|------|---------|-----------|
| `components/Button.tsx` | ui | No |

### Library Functions (0 files)
No lib files found.

## Gaps by Priority

### CRITICAL
- `app/api/health/route.ts`: API endpoint with no API or unit tests. Health endpoint is foundational infrastructure - must verify it works before building on it.

### HIGH
- `components/Button.tsx`: UI component with no unit tests. Button is a core reusable component - test all variants and disabled states.

### MEDIUM
None identified.

### LOW
None identified.

## Recommended Test Plan

### Immediate (Phase 0 Validation)

1. **API Test for Health Endpoint**
   - File: `tests/api/health.test.ts`
   - Coverage: GET /api/health returns 200 with status "healthy" and timestamp

2. **Unit Tests for Button Component**
   - File: `tests/unit/Button.test.tsx`
   - Coverage:
     - Renders children correctly
     - Primary variant applies correct styles
     - Secondary variant applies correct styles
     - onClick handler is called when clicked
     - Disabled state prevents clicks and applies disabled styles

## Test Generation Backlog

| Priority | File | Test Type | Suggested Test File |
|----------|------|-----------|---------------------|
| CRITICAL | `app/api/health/route.ts` | API | `tests/api/health.test.ts` |
| HIGH | `components/Button.tsx` | Unit | `tests/unit/Button.test.tsx` |

## Next Steps

Run `/test-build critical` to generate tests for CRITICAL priority gaps.

# Merge Feature Agent Specification

**Version:** 1.0  
**Type:** Actor (Coding Agent)  
**Command:** `/merge-feature <branch>`

---

## Overview

The Merge Feature Agent safely merges feature branches into main with full verification, conflict handling, and cleanup. This agent enforces that all prerequisites are met before merging.

---

## Modes

| Mode | Description |
|------|-------------|
| `<branch-name>` | Merge specific branch into main |
| `auto` | Merge first branch that passes all checks |
| `list` | List all mergeable branches with status |
| `status` | Show current branch merge readiness |

---

## Prerequisites (Required Before Merge)

| Prerequisite | Check |
|--------------|-------|
| Tests pass | `/test-execute pre-merge` status = pass |
| Code review | `/code-review branch` verdict = APPROVED |
| No conflicts | Git merge check passes |
| Branch up to date | Rebased on latest main |

---

## Standard Boot Sequence

**MANDATORY: Execute before any work.**

### Phase 0: Read Core Context
```bash
cat CLAUDE.md
```

### Phase 1: Read Agent State
```bash
cat docs/agents/merge-feature/state.json
```

### Phase 2: Detect Changes
```bash
git log <lastCommit>..HEAD --oneline
```

### Phase 3: Read Feature Truth
```bash
cat docs/agents/truth/feature-status.json
```

### Phase 4: Report Boot Status
```markdown
## Merge Feature Agent - Boot Complete

**Last run:** X days ago
**Target branch:** <branch>

**Proceeding with merge verification**
```

---

## Execution Flow: `<branch-name>` Mode

### Step 1: Pre-Merge Verification

```bash
# Check for uncommitted changes
git status --porcelain
# Must be empty

# Check current branch
git branch --show-current
# Should be main or will switch

# Fetch latest
git fetch origin

# Check branch exists
git branch -a | grep <branch-name>
```

### Step 2: Check Prerequisites

#### 2.1 Test Status
```bash
cat docs/agents/truth/feature-status.json
```

Check that all features affected by this branch have:
- `status: "pass"` for all test types
- No failing tests

If tests haven't been run:
```
❌ Prerequisites not met

/test-execute pre-merge has not been run.

Run: /test-execute pre-merge
Then: /merge-feature <branch>
```

#### 2.2 Code Review Status

Check recent review reports:
```bash
ls -la docs/reviews/ | tail -5
cat docs/reviews/<most-recent>_branch_review.md
```

Look for:
- `Verdict: APPROVED`
- Branch name matches
- Review is recent (within 24 hours or since last commit)

If no review or not approved:
```
❌ Prerequisites not met

Code review not approved.

Run: /code-review branch
Fix any issues
Then: /merge-feature <branch>
```

#### 2.3 Conflict Check
```bash
# Simulate merge
git checkout main
git pull origin main
git merge --no-commit --no-ff <branch-name>

# Check for conflicts
git diff --name-only --diff-filter=U
```

If conflicts:
```
❌ Merge conflicts detected

Conflicting files:
- lib/categories.ts
- app/api/categories/route.ts

Resolution required:
1. git checkout <branch-name>
2. git rebase main
3. Resolve conflicts
4. git push --force-with-lease
5. /merge-feature <branch-name>
```

### Step 3: Prepare Merge

```bash
# Ensure on main
git checkout main

# Pull latest
git pull origin main

# Show what will be merged
echo "Commits to merge:"
git log main..<branch-name> --oneline

echo "Files changed:"
git diff --stat main..<branch-name>
```

### Step 4: Execute Merge

```bash
# Merge with no-ff to preserve history
git merge --no-ff <branch-name> -m "Merge <branch-name> into main

Features:
- <extracted from commits>

Verified:
- Tests: All passing
- Review: Approved
- Conflicts: None"
```

### Step 5: Post-Merge Verification

```bash
# TypeScript check
npx tsc --noEmit

# Run quick tests
npm test -- --run

# Start dev server briefly
npm run dev &
DEV_PID=$!
sleep 5
curl http://localhost:3000/api/health
kill $DEV_PID
```

If any check fails:
```bash
# Abort merge
git reset --hard HEAD~1
```

### Step 6: Push and Cleanup

```bash
# Push to origin
git push origin main

# Delete local branch
git branch -D <branch-name>

# Delete remote branch
git push origin --delete <branch-name>
```

### Step 7: Generate Merge Report

Create `docs/merges/<date>_<branch-name>.md`:

```markdown
# Merge Report

**Branch:** feature/add-categories
**Merged:** 2025-01-15T15:00:00Z
**Merged by:** merge-feature-agent

---

## Pre-Merge Verification

| Check | Status |
|-------|--------|
| Tests | ✅ All 45 passing |
| Code Review | ✅ Approved (2025-01-15) |
| Conflicts | ✅ None |
| Up to date | ✅ Rebased on main |

---

## Commits Merged

| SHA | Message |
|-----|---------|
| abc123 | feat: add category CRUD |
| def456 | feat: add category API routes |
| ghi789 | test: add category tests |

---

## Files Changed

| File | Insertions | Deletions |
|------|------------|-----------|
| app/api/categories/route.ts | +85 | +0 |
| lib/categories.ts | +120 | +0 |
| components/CategoryList.tsx | +95 | +0 |
| tests/api/categories.test.ts | +65 | +0 |

**Total:** 4 files, +365 insertions

---

## Post-Merge Verification

| Check | Status |
|-------|--------|
| TypeScript | ✅ Pass |
| Tests | ✅ Pass |
| Dev Server | ✅ Running |
| Health Check | ✅ 200 OK |

---

## Cleanup

| Action | Status |
|--------|--------|
| Push to origin | ✅ Complete |
| Delete local branch | ✅ Complete |
| Delete remote branch | ✅ Complete |

---

## Feature Status Updated

The following features are now fully tested and merged:
- categories: unit ✅, api ✅, e2e ⏳
```

---

## Execution Flow: `list` Mode

Show all branches and their merge readiness:

```markdown
## Mergeable Branches

| Branch | Tests | Review | Conflicts | Ready |
|--------|-------|--------|-----------|-------|
| feature/add-categories | ✅ | ✅ | ✅ | ✅ Ready |
| feature/budget-tracking | ✅ | ⏳ | ✅ | ⚠️ Needs review |
| feature/hsbc-integration | ❌ 3 failing | - | - | ❌ Tests failing |
| fix/transaction-bug | ✅ | ✅ | ❌ | ⚠️ Has conflicts |

Recommended: /merge-feature feature/add-categories
```

---

## Execution Flow: `auto` Mode

1. Run `list` to find ready branches
2. Select first branch with all prerequisites met
3. Execute merge for that branch
4. Report result

---

## State File Schema

`docs/agents/merge-feature/state.json`:

```json
{
  "agent": "merge-feature",
  "lastRun": "2025-01-15T15:00:00Z",
  "lastCommit": "xyz789abc",
  "status": "success",
  "completedWork": [
    {
      "branch": "feature/add-categories",
      "timestamp": "2025-01-15T15:00:00Z",
      "commits": 3,
      "filesChanged": 4,
      "insertions": 365,
      "deletions": 0,
      "result": "merged"
    }
  ],
  "metrics": {
    "totalMerges": 8,
    "successRate": 1.0,
    "avgCommitsPerMerge": 4.2,
    "conflictsEncountered": 1,
    "conflictsResolved": 1
  },
  "blockers": [],
  "nextAction": "Continue development or /merge-feature auto for next branch"
}
```

---

## Conflict Resolution Guide

When conflicts are detected:

### Step 1: Switch to Feature Branch
```bash
git checkout <branch-name>
```

### Step 2: Rebase on Main
```bash
git fetch origin main
git rebase origin/main
```

### Step 3: Resolve Conflicts
For each conflicting file:
1. Open file
2. Find conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Choose correct code
4. Remove markers
5. `git add <file>`

### Step 4: Continue Rebase
```bash
git rebase --continue
```

### Step 5: Force Push
```bash
git push --force-with-lease
```

### Step 6: Retry Merge
```
/merge-feature <branch-name>
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Prerequisites not met | Report which are missing, suggest commands |
| Conflicts detected | Provide resolution steps |
| Post-merge tests fail | Abort merge, report issues |
| Push fails | Report, suggest force push if safe |
| Branch doesn't exist | Report error, suggest /merge-feature list |

---

## Handoff

### On Success
```
✅ Merge complete

Branch feature/add-categories merged into main.
- 3 commits
- 4 files changed
- All verifications passed

Branch cleaned up (local and remote).

Merge report: docs/merges/2025-01-15_feature-add-categories.md
```

### On Failure
```
❌ Merge blocked

Reason: Tests failing

3 tests failed in test-execute pre-merge.

Next steps:
1. Fix failing tests
2. /test-execute pre-merge
3. /merge-feature <branch>
```

# Merge Feature Agent

Execute the Standard Boot Sequence first: `cat docs/agents/config/boot-sequence.md`

## Purpose

Safely merge feature branches with verification.

## Usage

`/merge-feature <branch-name>`

## Execution

### 1. Boot Sequence
Execute all phases from boot-sequence.md

### 2. Pre-Merge Verification

```bash
# Check for uncommitted changes
git status --porcelain

# Ensure on main
git branch --show-current

# Fetch latest
git fetch origin

# Check branch exists
git branch -a | grep <branch-name>
```

### 3. Prepare Merge

```bash
# Switch to main
git checkout main

# Pull latest
git pull origin main

# Show what will be merged
git log main..<branch-name> --oneline
```

### 4. Execute Merge

```bash
# Merge with --no-ff to preserve history
git merge --no-ff <branch-name> -m "Merge <branch-name> into main"
```

### 5. Post-Merge Verification

```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npm test

# Start dev server (briefly)
npm run dev &
sleep 5
curl http://localhost:3000/api/health
kill %1
```

### 6. Push and Cleanup

```bash
# Push to origin
git push origin main

# Delete local branch
git branch -D <branch-name>

# Delete remote branch
git push origin --delete <branch-name>
```

### 7. Generate Report

Create `docs/merges/YYYY-MM-DD_<branch-name>.md`:

```markdown
# Merge Report

**Branch:** <branch-name>
**Merged:** <timestamp>
**Commits:** N

## Verification Results

| Check | Status |
|-------|--------|
| TypeScript | Pass |
| Tests | Pass |
| Dev Server | Running |

## Files Changed
- <list>

## Cleanup
- Local branch deleted
- Remote branch deleted
```

### 8. Update State

Update `docs/agents/merge-feature/state.json`

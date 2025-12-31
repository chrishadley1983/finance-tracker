# Standard Boot Sequence

**EVERY agent run MUST execute this sequence. No exceptions.**

---

## Phase 0: Read Core Context

1. Read `CLAUDE.md` - Get project rules
2. Read agent specification from `.claude/commands/<agent>.md`

---

## Phase 1: Read Agent State

```bash
cat docs/agents/<agent-name>/state.json
```

Extract:
- `lastRun` - When agent last executed
- `lastCommit` - Git commit at last run
- `completedWork` - What was done
- `blockers` - Any issues

If state.json doesn't exist, this is first run - proceed with defaults.

---

## Phase 2: Detect Changes Since Last Run

```bash
# Get commits since last run (skip if first run)
git log <lastCommit>..HEAD --oneline

# Get changed files since last run
git diff --name-only <lastCommit>..HEAD
```

Record:
- Number of commits
- Files changed
- Days elapsed

---

## Phase 3: Check for Invalidations

1. Read `docs/agents/config/file-feature-map.json`
2. For each changed file, identify affected features
3. For each item in `completedWork`, check if source files changed
4. Mark affected work as 'invalidated'

---

## Phase 4: Read Feature Truth

```bash
cat docs/agents/truth/feature-status.json
```

Merge with invalidation results to get effective backlog.

---

## Phase 5: Report Boot Status

Output:

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

---

## Phase 6: Proceed or Wait

- If blockers exist → Report and stop
- If human decision needed → Ask
- Otherwise → Proceed with work

---

## Phase 7: Update State on Completion

After work completes, update state.json:

```json
{
  "lastRun": "<current ISO timestamp>",
  "lastCommit": "<current HEAD>",
  "status": "success|failed|partial",
  "completedWork": [/* updated */],
  "metrics": {/* updated */}
}
```

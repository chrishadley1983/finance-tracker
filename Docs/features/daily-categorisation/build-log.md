# Build log — daily-categorisation (Phase A, finance-tracker)

## Iteration 1 — 2026-10-01

**Branch:** `feature/daily-categorisation` (finance-tracker) · `feature/finance-categorisation-migrations` (hadley-bricks-inventory-management)

### Overlapping branches (A6 / A11)
- `origin/fix/retired-claude-models` — **already merged** to main as #24 (`22dc50b`, categoriser on `claude-sonnet-5`). Nothing to do.
- `feat/ai-usage-audit` — **already merged** as #13 (`07af479`, Anthropic usage → shared `ai_api_usage` audit). It doesn't touch the daily-cap counter; A11 was a separate bug (below).

### Schema (I1) — HB repo, applied 2026-10-01 via `supabase db query --linked`
`supabase/migrations/20261013100000_finance_daily_categorisation.sql` (additive):
- `category_mappings`: `account_id`, `amount_sign`, `amount_min`, `amount_max`, `action` (default `categorise`), `updated_at`; uniqueness widened from `(lower(pattern), match_type)` to include the conditions.
- `category_corrections.transaction_id` (FK, `ON DELETE SET NULL`) — 66/90 historical corrections backfilled where exactly one manual transaction matched.
- `category_rule_events` (audit of rule created/repointed/deleted/updated).
- `categorisation_digests` (C4, for the Peter job): `id, created_at, window_start, window_end, status built|posted|failed, posted_message_ids text[], items jsonb, meta jsonb`.
- **A11 root cause:** `ai_usage_tracking` had no unique index on `(date, usage_type)`, so `upsert(onConflict)` failed silently on every call since Feb 2026 (last row 2026-02-03) and the daily cap never counted. Fixed: unique index + `increment_ai_usage(date, text, int)` (atomic `INSERT … ON CONFLICT DO UPDATE count = count + n`), service_role only.
- RLS on, no policies, revoked from anon/authenticated (matches the 2026-07-25 lockdown).
- Extra (coordinator request, unrelated to categorisation): `20261013090000_finance_manual_income_avc_uplift.sql` — `add_monthly_manual_income()` with the £3,907.25 AVC uplift from Sep 2026. **Already applied live; checked in only, not re-run.**

Backups taken before any live change: `finance._backup_recat_20261001_{mappings,transactions,corrections,ai_usage}` (210 / 4,247 / 90 / 7 rows; RLS on).

`lib/supabase/database.types.ts`: hand-patched for the new columns/tables/function. A full `supabase gen types` regenerate pulls in nullability drift elsewhere (72 unrelated type errors), so only this feature's types were added.

### Spec refinements (recorded, not silently changed)
- **A7(a)** "drop the 1–2 letter token before a digit token": two-letter real words are kept (`uk`, `co`, `st`, `sf`, `of`, …) — otherwise `SAINSBURYS.CO.UK 0800…` → `sainsburys co` and `AMAZON UK* NL19…` → `amazon`. `ebay o 23 …` still → `ebay …`.
- **A2** check: the audit's q9 used raw `LIKE '%pattern%'`; A7(b) makes contains-rules token-bounded on the normalised description, so the A2 check (`npm run rules:check`) uses the engine's own matcher and asks "for each settled row, does the rule that would win TODAY disagree with how Chris settled it?".
- **A10** "auto-applied": engine_source ∈ {policy, rule_exact, rule_pattern, merchant_rule, similar, ai}; `policy_ask` rows are questions by design and excluded. Corrections are matched by `category_corrections.transaction_id`.
- **A8** runs rules + precedent only (no AI) — re-running Claude over the same queue on every rule change would spend the cap without new information.
- **"always" on a policy row (A9)** updates that policy (an `ask` policy becomes `categorise`); `policies:sync` then leaves it alone and reports it as `overridden` so `policies.ts` can be updated to match.

### Verification evidence (pre-deploy)
- `npm test`: 90 files, **1,419/1,419** pass.
- `npx tsc --noEmit`: 0 errors · `npm run build`: green · ESLint on changed files: 0 errors.
- Code review (branch): `Docs/reviews/2026-10-01_17-00_review.md` — 3 Major + 2 Minor fixed; pre-existing unauthenticated `/api/*` flagged.

| Criterion | Status | Evidence |
|---|---|---|
| A1 supersession | PASS | `tests/unit/categorisation/rule-supersession.test.ts` (re-point, delete, system-protected, conditions, end-to-end on fake DB with events) |
| A2 contradicted rules resolved | PENDING live run | `npm run rules:check` after policies:sync + hygiene + mining on production data |
| A3 policy rules | PASS | `tests/unit/categorisation/rule-policies.test.ts` (account, sign, min/max, ask, precedence, specificity) |
| A4 seeded policies | PASS (unit) / PENDING live seed | 16 real-description cases + 6 EV ask cases in `rule-policies.test.ts`; live `npm run policies:sync` after deploy |
| A5 edit paths | PASS | `tests/api/categorisation-edit-paths.test.ts` — PUT [id], bulk, review-queue, answers each assert correction row (with transaction_id) + `manual` + `needs_review=false` |
| A6 AI context | PASS | `tests/unit/categorisation/prompt-context.test.ts` (snapshot), `ai-categoriser-batch.test.ts` (context reaches the API call), `engine.test.ts` (new-merchant → review) |
| A7 rule hygiene | PASS (code) / PENDING live | `normalise.test.ts`, `rule-policies.test.ts` (token-bounded), `rule-supersession.test.ts` (digit rules); live hygiene script after deploy |
| A8 recategorise-pending | PASS | `categorisation-edit-paths.test.ts` (clears answerable rows, never touches manual/validated) |
| A9 answers | PASS | `categorisation-edit-paths.test.ts` (apply, always→rule, ask-policy update, re-point not duplicate, invalid category → 400 nothing written, idempotent, missing ids, 401) |
| A10 learning stats | PASS | `categorisation-edit-paths.test.ts` (exact rates per source/window, top merchants, endpoint shape, bad param) |
| A11 AI cap | PASS | `ai-categoriser.test.ts` (rpc increment), `engine.test.ts` (partial quota per batch) |
| A12 timing + invalid id | PASS (invalid id) / PENDING timing | `ai-categoriser-batch.test.ts`, `engine.test.ts`; production timing after deploy |
| I1 migrations | PASS | HB migration applied + verified (columns, tables, function, 66/90 links) |
| I2 skill aligned | PASS | `~/.claude/skills/finance-recategorise/SKILL.md` uses `POST /api/categorisation/answers` and reads policies from the DB |
| I3 weekly script | PASS (code) | `sync-truelayer.ts` skips the TrueLayer step when a digest exists in the last 36h (`--force` overrides); dry run after deploy |
| I4 tests green | PASS | 1,419/1,419 |

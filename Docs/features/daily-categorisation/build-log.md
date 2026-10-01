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

Merged: finance-tracker #25 (`ead4442`), HB #825 (`927ef7b4`). Production deploy `finance-tracker-7b0xwd0j2` Ready.

## Iteration 2 — live data run + fixes (2026-10-01, after deploy)

### Production smoke
- `POST /api/categorisation/answers` returns 401 with no key or a wrong key, and 400 (nothing written) for an unknown category.
- `GET /api/categorisation/learning-stats?days=30` returns 200 in 2.0s.
- Correction rate is 4.3% for the last 30 days vs 13.3% for the 30 days before. By source this window: AI 12.5%, rule_pattern 0%, similar 2.6%.

### Live data steps
1. `npm run policies:sync`: 21 inserted, 3 updated (the existing system rules for FX fee, card repayment and HSBC Premier). The queue re-run cleared 1 row: Shopify £28.80, AI "Lego In" → policy, Chris Income.
2. `tsx scripts/rule-hygiene-2026-10-01.ts --apply`: 29 legacy labels deleted, `Clothing` and `Energy` lowered to 0.85, the mined `interest` rule deleted (replaced by the debit policy).
3. `npm run mine:rules`:
   - 3 rules superseded and re-pointed: **`stripe payments ukshopify` Transfers → Chris Income**, `justpark london`, `worldofbooks cogoring by`.
   - 26 digit-token rules deleted, including `ebay o 23/02/16` → Lego Out.
   - 60 rules created.

### Incident caught by the A2 check: a too-broad mined rule
Step 3 created **`tonbridge` → Takeaway**. As a whole-word contains rule it won for 239 settled rows, and 225 of them disagreed.
- **Cause.** Mining checked agreement only inside the merchant-key group (`merchantKey()` = "tonbridge" for a takeaway). It never checked every row the pattern would actually match. The old matcher had the same gap for multi-word keys (`tonbridge tonbridge`).
- **Containment.**
  - The rule was deleted within about 4 minutes (audit event `mining:broad-pattern-fix`).
  - The same mining run's queue re-run had cleared 3 rows to Takeaway with it: NEVLL FIX IT, and SPOND TPC Thursday and Wednesday. All 3 were restored from `_backup_recat_20261001_transactions`.
  - No sync ran in that window (0 rows created).
- **Fix (code).**
  - `rejectBroadCandidates`: a candidate must hold ≥90% agreement across every settled row its pattern matches. `tonbridge` scored 5% across 642 rows.
  - `findLowQualityMinedRules`: mined rules that ≥4 settled matches agree with less than 60% of the time are deleted. That removed `tonbridge tonbridge` (33%) and `justpark london` (25%, a context-dependent holiday-vs-social merchant).
  - Tests: `rule-supersession.test.ts` (broad-pattern guard).

### Regression: hand-made digit patterns
Comparing the old and new matchers over all 4,236 settled rows found that **`micro1` (Chris's side income) stopped matching**. The new normaliser drops tokens that contain digits.
- **Fix:** a contains-pattern that itself has a digit is matched, whole-word, against the lightly normalised description, which keeps digits. Test added.

**Final comparison** (old matcher vs new, same live rules): **308 rows newly correct, 9 no longer correct**. Of the 9:
- 7 are SE Tonbridge fares where the amount policy disagrees with mixed history (flagged ⚠ for Chris in `kept-rules.md`);
- 1 is Instavolt (now an ask policy, by design);
- 2 are `BP HILDEN SSERVE` partial-word hits that whole-word matching intentionally drops.

### A2
`npm run rules:check`: 4,236 settled rows, 213 winning rules, 28 contradicted, **0 unlisted** (`kept-rules.md`).

### A12, live production timing (TrueLayer reconnected)
`POST /api/truelayer/sync`, 3-day window (2026-09-28 → 10-01):
- Joint Current: **10.9s** (8 imported and categorised: 6 rule, 1 similar, 1 AI → review).
- Credit Card: **3.1s**.

Both are under 45s. `ai_usage_tracking` gained a 2026-10-01 row, the first since February (A11 confirmed live).

### I3
- Inserted a test digest, then ran `tsx scripts/sync-truelayer.ts`: "Bank sync skipped — the daily finance-categorise job owns it", then mining and the queue summary ran (20.5s).
- Test row deleted.

| Criterion | Final |
|---|---|
| A1–A12, I1–I4 | **PASS** (A12 live 10.9s / 3.1s; A2 0 unlisted) |

## Iteration 3 — Chris's decisions (2026-10-01)

- **MMBILL.COM:** stays Transfers. No change.
- **SE Tonbridge rail fares:** the new policy replaces £19.20/£40.70 → Work:
  - debit under £20 → Social Travel;
  - debit on Sat/Sun → Social Travel;
  - weekday debit of £20 or more → Work Travel.
- **Schema:** `category_mappings.days_of_week smallint[]` (ISO 1=Mon … 7=Sun), with a CHECK constraint and the uniqueness key widened.
  - Migration `20261013120000_finance_rule_days_of_week.sql` in the HB repo, applied with `db query` before the code deploy.
  - The first attempt was rejected (`days_of_week::text` isn't IMMUTABLE in an index) and rolled back cleanly. Fixed by indexing the array directly.
- **Matcher:**
  - `RuleContext.date`; `isoWeekday()`.
  - `days_of_week` counts as a condition; an unknown date never matches.
  - A deterministic final tie-break by rule id.
  - The date is passed through the engine, re-categorisation, answers, mining evidence and `rules:check`.
- **Seeded ordering:** three disjoint debit rows: weekend → Social (sign + days), ≤£19.99 → Social (sign + max), and weekday £20+ → Work (sign + min + Mon–Fri).
  - Every Work/Social outcome comes from exactly one row, so the result never depends on tie-breaking.
  - Weekend fares under £20 match both Social rows, which agree.
  - Tests cover Chris's cases (weekday £19.20/£19.99 → Social, £20.00/£22.90 → Work, Fri £40.70 → Work, Sat £40.70 / Sun £37.60 / Sun £19.20 → Social, refund → Social) and reversed rule order.
- **Retiring policies:** `policies:sync` deletes rows for `RETIRED_POLICY_KEYS` (`se-tonbridge-commute-1920/4070`).
- **No retro-categorisation of settled history** (Chris). Only `recategorise-pending` runs.
- **Tests:** 1,434/1,434 pass.

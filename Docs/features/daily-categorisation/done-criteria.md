# Done Criteria — daily-categorisation

**Feature:** Peter-driven daily categorisation of personal + business transactions, with a learning loop that actually learns
**Defined:** 2026-10-01 · **Iteration budget:** 8 (build per phase: A → B → C)
**Repos touched:** finance-tracker (A), hadley-bricks-inventory-management (B + all SQL migrations — HB owns the shared migration history; never `supabase db push` from finance-tracker), Discord-Messenger via `Discord-Messenger-dev` PR + `peter_git deploy` (C)

**Problem:** Categorisation is a weekly, manually-driven chore and it doesn't learn reliably. Audit 2026-10-01:
90 `finance.category_corrections` logged, 0 ever read or turned into rules; rule mining never overrides an existing rule and
rules (0.9) beat the 0.8 review gate, so `stripe payments ukshopify → Transfers` persists after 10 corrections and the
2026-09-19 policy; 23 live rules disagree with their own settled matches; bulk edit records no corrections; the Claude
fallback sees no precedent/corrections/policies; Monzo (business) has no rule store and no fail-loud category check.

**Decisions (Chris, 2026-10-01):**
- Daily at **19:00 UK** in a **new Discord #finance channel**
- Scope: personal = HSBC Joint Current + HSBC Credit Card (`finance.transactions`); business = HB Monzo (`public.monzo_transactions.local_category`)
- **Auto-apply confident, ask the rest, report on ALL** — every new transaction appears in the digest, not just the questions
- Business spend on personal cards: **tag only** (Business group category, e.g. Lego Out) — no HB P&L / MTD feed

**Definitions used below:**
- *Confident* = categorised by a policy rule, a non-contradicted rule, or strong precedent (≥3 agreeing, sim ≥0.65), with confidence ≥ 0.8. Everything else is a *question*.
- *Auto-applied* = category set by the engine (`categorisation_source` ≠ `manual`).
- *Correction rate* = auto-applied rows later changed by Chris ÷ auto-applied rows, by engine source, trailing 30 days.

---

## Phase A — Learning loop (finance-tracker)

### A1: Corrections override contradicted rules `AUTO_VERIFY`
Rule mining (`lib/categorisation/rule-mining.ts`) no longer only "surfaces" conflicts. For a non-system rule where the
manual/settled matches from the last 180 days disagree with the rule by majority (≥2 rows, ≥75% agreeing on another
category), the rule is re-pointed to that category (or deleted if no majority) and `notes` records
`superseded:<old category>:<date>`. `is_system` rules are never changed by mining. Unit test with fixture rules +
transactions covers re-point, delete and system-protected cases.

### A2: Contradicted live rules resolved `AUTO_VERIFY`
After running mining against live data, the query "contains-rules whose settled matches disagree" (audit q9) returns
only rules listed in `docs/features/daily-categorisation/kept-rules.md` with a one-line reason each. Specifically
`stripe payments ukshopify` no longer maps to Transfers.

### A3: Policy rules (account / sign / amount / always-ask) `AUTO_VERIFY`
`finance.category_mappings` gains optional `account_id`, `amount_sign` (`debit|credit`), `amount_min`, `amount_max`, and
`action` (`categorise` default | `ask`). The rule matcher only applies a rule when all present conditions match; `ask`
rules set `needs_review = true` with `engine_source = 'policy_ask'` and the rule's category as the suggestion. Policy
rules are evaluated before every other rule. Unit tests cover each condition and the ask action.

### A4: Chris's known policies seeded as policy rules `AUTO_VERIFY`
Seeded `is_system` policy rules (from the finance-recategorise skill + memory), each covered by an engine test with a real
description string:
- Stripe / Shopify / eBay Commerce **credits** into the **Joint** account → Chris Income
- Hadley Bricks credits → Chris Income
- MMBILL.COM → Transfers
- SP HORSHAM COFFEE → Groceries
- Non-sterling transaction / FX fees → Holiday Travel
- SE Tonbridge fares of exactly £19.20 or £40.70 → Work Travel
- EV charging merchants → `ask`

### A5: Every edit path records corrections and clears the flag `AUTO_VERIFY`
`PUT /api/transactions/[id]`, `PUT /api/transactions/bulk`, `PATCH /api/transactions/review-queue` and the new answers
endpoint (A9) all: set `categorisation_source = 'manual'`, set `needs_review = false`, and insert one
`category_corrections` row per transaction whose previous category was auto-assigned and changed. API tests per route
assert the correction row and flag state.

### A6: Claude fallback gets context and can't self-approve new merchants `AUTO_VERIFY`
The AI prompt includes, per transaction batch: up to 5 settled precedents per transaction (via the similarity lookup),
the last 20 corrections whose description is similar, and the active policy rules in plain text. A transaction with **no**
settled precedent (similarity ≥ 0.5) is always `needs_review = true` regardless of Claude's confidence. The model is
`claude-sonnet-5` (merge `origin/fix/retired-claude-models` first). Unit test snapshots the built prompt; engine test
asserts the new-merchant review rule.

### A7: Rule hygiene `AUTO_VERIFY`
(a) The normaliser drops order/reference tokens (any token containing digits, and the 1–2 letter token immediately
preceding a digit token, e.g. `ebay o 23`), with unit tests; mined rules containing digit tokens are deleted.
(b) The rule matcher no longer ORs a raw `includes()` with the token-bounded match — only the token-bounded match counts.
(c) The legacy single-word contains-rules at confidence 1.0 (`Gifts`, `Clothing`, `Energy`, `Activities`, `interest`, …)
are each either deleted or lowered to ≤ 0.9; the list and outcome are recorded in `kept-rules.md`.

### A8: Re-categorise pending after rule changes `AUTO_VERIFY`
`POST /api/categorisation/recategorise-pending` re-runs the engine over rows with `needs_review = true` and
`categorisation_source <> 'manual'`, updating category/source/confidence/flag, and returns `{ examined, changed,
cleared }`. Called automatically at the end of rule mining and of each answers batch. Never touches `manual` or
`is_validated = true` rows. API test with fixtures.

### A9: Answers endpoint `AUTO_VERIFY`
`POST /api/categorisation/answers` (API-key auth, `x-api-key` = `FINANCE_AGENT_KEY`) accepts
`[{ transaction_ids[], category_id, always?: boolean }]`. It applies the categories as in A5. With `always`, it upserts a
contains-rule on the normalised merchant (or the policy rule's conditions if the row came from one) at confidence 0.9,
then runs A8. Returns per-item results. Rejects unknown category ids with 400 and changes nothing (whole batch is
atomic). API tests cover apply, always-rule creation and invalid-category rejection.

### A10: Correction-rate metric `AUTO_VERIFY`
`GET /api/categorisation/learning-stats?days=30` returns correction rate overall and per `engine_source`, plus the
previous 30-day window, rules created/re-pointed/deleted in the window, and the current review-queue size. Unit test with
fixture transactions + corrections asserts exact rates.

### A11: AI usage tracking counts correctly `AUTO_VERIFY`
`trackAIUsage` increments (not overwrites) the daily count, and the daily cap blocks further AI calls once it's reached
(rows then go to review with the weak guess). Unit test with mocked Supabase. Reconcile with `feat/ai-usage-audit` (merge
or supersede — record which in the build log).

### A12: Daily sync fits the production time limit `AUTO_VERIFY`
`POST /api/truelayer/sync` for one account over a ≤ 3-day window, including categorisation, completes in < 45s (measured
against production, both accounts, logged in the build log). The AI categoriser's invalid-category bug is fixed: an
unknown id with no name match leaves the row uncategorised + `needs_review`, and never aborts the chunk insert (unit test).

## Phase B — Business categorisation (Hadley Bricks app)

### B1: Monzo merchant rules `AUTO_VERIFY`
New table `public.monzo_merchant_rules (merchant_key text unique, local_category text, source text, created_at)`.
`resolveLocalCategory` consults it **first**, before strong precedent. `merchant_key` uses the same merchant derivation as
`buildMerchantPrecedentMap`. Unit test: a rule beats a conflicting precedent.

### B2: Monzo categorise + answers endpoints `AUTO_VERIFY`
- `GET /api/finance-agent/monzo/pending?since=<iso>` returns Monzo rows created since `since` with `local_category`, how it
was decided (`rule | strong_precedent | sheet | majority | none`) and a suggestion for NULL rows (majority precedent if
any).
- `POST /api/finance-agent/monzo/answers` accepts `[{ ids[], local_category, always? }]`, validates `local_category`
against the registry (B3), updates rows, and with `always` upserts a `monzo_merchant_rules` row.
Both use the existing service-key auth. API tests.

### B3: Fail-loud Monzo category registry `AUTO_VERIFY`
A single exported registry lists every allowed `local_category`, each marked `pnl` (one of the 8 the P&L reads) or
`excluded` (Salary, Income, Transfers, General, Personal, …). The P&L report adds a visible "Unclassified Monzo
spend" warning row (amount + count) whenever rows in the report period have a NULL or unregistered category, and the
answers endpoint rejects unregistered categories. Unit test with a fixture row using an unknown category.

### B4: Business-looking personal spend is asked about `AUTO_VERIFY`
On the personal side, a transaction whose merchant matches a business signal list (LEGO, BrickLink, Vistaprint,
packaging/postage merchants, eBay purchases, plus any merchant previously categorised in the Business group) and that
is not already in the Business group becomes a question with "Business (Lego Out)" as one of the options. Tag only — no
P&L/MTD flow. Unit test on the classifier.

## Phase C — Peter daily job (Discord-Messenger)

### C1: #finance channel wired `AUTO_VERIFY`
A #finance Discord channel exists. Its ID is in `scheduler.py` `CHANNEL_IDS`, peter-channel `DISCORD_CHANNEL_IDS`, and
the `audience.py` chat registry with finance allowed. A test message from Chris in #finance gets a Peter reply (evidence:
message ids in the build log).

### C2: Scheduled job `AUTO_VERIFY`
`SCHEDULE.md` has `| Finance categorisation | finance-categorise | 19:00 UK | #finance | yes |`, and
`GET /schedule/jobs` lists it after reload.

### C3: Data fetcher does the work in code, not the LLM `AUTO_VERIFY`
The `finance-categorise` fetcher in `data_fetchers.py`:
1. Calls `POST /api/truelayer/sync` per sync-enabled account over `[last_digest_at − 2 days, now]`, capped at 7 days.
2. Calls A8 (recategorise-pending).
3. Reads personal rows created since the last digest plus open questions, and Monzo rows via B2.
4. Writes a digest record and returns the digest JSON.
No category writes happen in Peter's LLM turn during the scheduled run. Unit test with mocked HTTP asserts the call
order and payload.

### C4: Digest storage `AUTO_VERIFY`
New table `finance.categorisation_digests (id, created_at, posted_message_ids, items jsonb)`. Each item has a number,
a `kind` (`auto | question | flag`), a `ledger` (`personal | business`), transaction ids, merchant, amount(s), date(s),
category or suggestion options, source and confidence. Numbers are stable for the digest's lifetime. Answers reference
`digest_id + number`, never raw ids typed by the LLM. Migration in the HB repo.

### C5: Report on all — coverage `AUTO_VERIFY`
Every personal transaction created since the previous digest, and every Monzo row created since then, appears in
exactly one digest item. Same-merchant same-category rows are grouped into one item with a count and total. Test:
the fixture set of N transactions yields items whose transaction-id union = N with no duplicates.

### C6: Digest message format `AUTO_VERIFY`
Posted to #finance as ≤ 2000-char messages, in this order:
1. A header: date, sync status per account, counts (auto / questions / flags) and review-queue size.
2. **Questions** (numbered, with 2–4 suggested categories and the reason it's a question).
3. **Done** (numbered; merchant → category · source · confidence).
4. **Flags** (rule conflicts, business-looking spend).
Personal and business are labelled. Snapshot test of the rendered messages from a fixture digest.

### C7: Reply grammar `AUTO_VERIFY`
`skills/finance-categorise/SKILL.md` (`conversational: true`) documents and handles all of these:
- `3 groceries`
- `3 groceries always`
- `ok` / `ok 1-5` (accept the top suggestion)
- `fix 7 coffee` (correct an auto item)
- `skip 4`
- Several items in one message, separated by commas or new lines
Category names resolve to existing categories by case-insensitive exact match, then unique prefix/fuzzy match. A parser
unit test in the fetcher module covers each form.

### C8: Answers applied through a governed endpoint `AUTO_VERIFY`
Hadley API `POST /finance/categorise/answer` takes `{ digest_id, answers, requested_by_turn, reason }`. It validates
`requested_by_turn` with the same checks as `db_write` (verified Chris message, ≤ 30 min, reason quotes it), maps
numbers to transaction ids from the stored digest, and forwards to A9 (personal) / B2 (business). It is logged in the
`/peter/db/digest` audit. Rejects a missing or stale turn with 403. Tests cover accept, 403 and number mapping.

### C9: Confirmation after applying `AUTO_VERIFY`
After applying, Peter posts in #finance one line per item applied (number → category, `+rule` when an "always" rule was
created) and the remaining open-question count. Covered by the skill's documented flow plus an end-to-end dry run in the
build log.

### C10: Replies work all evening `AUTO_VERIFY`
A reply in #finance is handled with the finance-categorise skill context at any time until the next digest, not just within
the 60-minute global `active_skill_context` slot, and isn't displaced by another conversational job. Implementation:
channel-bound skill context in peter-channel. Test: a stub context older than 60 minutes is still injected for #finance.

### C11: Unanswered questions carry over `AUTO_VERIFY`
Questions not answered by the next run reappear in the next digest's Questions section (marked "carried over · N days")
and aren't duplicated. Fixture test across two digests.

### C12: Weekly learning summary `AUTO_VERIFY`
Sunday's digest appends a "Learning" block from A10 and the Monzo equivalent:
- correction rate (this vs the previous 30 days), overall and per source
- rules created, re-pointed and deleted this week
- the top 3 most-corrected merchants
Snapshot test.

## Error handling criteria

### E1: Bank sync failure still produces a digest `AUTO_VERIFY`
If sync fails (consent expired, timeout, 5xx), the digest still posts. The header carries a per-account ⚠ line with the
error text (and "reconnect bank" for consent errors), and the rows already in the DB are still reported. Fetcher test
with a mocked 401/504.

### E2: Upstream down → no partial state `AUTO_VERIFY`
If the finance or HB API is unreachable, the fetcher posts a single failure notice in #finance, writes no digest record,
and the next run covers the missed window (`since` = last *successful* digest). Test.

### E3: Bad reply items don't block good ones `AUTO_VERIFY`
For an unknown number, an unresolvable or ambiguous category, or a transaction changed manually since the digest, that
item is skipped with a reason in the confirmation and the rest are applied. Categories are never created. Endpoint and
parser tests.

### E4: Idempotent answers `AUTO_VERIFY`
Re-sending the same answer (e.g. Peter retries) gives the same end state: no duplicate corrections and no duplicate
rules. Test.

## Performance criteria

### P1: Sync window within the production time limit `AUTO_VERIFY`
Covered by A12 (< 45s per account per daily window).

### P2: Digest built quickly `AUTO_VERIFY`
The fetcher completes in < 90s end to end against production on a normal day (≤ 50 new rows), measured from the
job_history.db duration.

## Integration criteria

### I1: Migrations checked in `AUTO_VERIFY`
All schema changes (A3 columns, C4 table, B1 table) are migration files in
`hadley-bricks-inventory-management/supabase/migrations`, applied with `supabase db query --linked`. `lib/supabase/database.types.ts` is regenerated in finance-tracker.

### I2: finance-recategorise skill aligned `AUTO_VERIFY`
`~/.claude/skills/finance-recategorise/SKILL.md` uses the answers endpoint (A9) instead of hand-written UPDATE + INSERT
SQL, and reads policies from the policy rules instead of its own list. The two never disagree.

### I3: Weekly batch script still works `AUTO_VERIFY`
`scripts/run-bank-sync.cmd` still runs (the 1st-of-month snapshots and mining). Its weekly TrueLayer sync step is removed
or made a no-op, because the daily job owns sync. A dry run is logged.

### I4: Existing tests green `AUTO_VERIFY`
`npm test` (finance-tracker), the HB web unit tests for touched modules, and the Discord-Messenger tests for touched
modules all pass.

### I5: Live first run `TOOL_VERIFY` (Discord)
The first real 19:00 run posts to #finance and Chris answers at least one question via reply. The correction row and,
with "always", the rule exist afterwards. Evidence: message ids + DB rows in the build log. (TrueLayer re-consent by
Chris is a prerequisite.)

---

## Out of scope
- HB P&L / MTD feed for business spend paid on personal cards (tag only — decided 2026-10-01)
- New web UI pages (the existing review queue page stays as-is apart from A5)
- Monzo API direct integration (Monzo stays sheet-fed)
- WhatsApp delivery or reminders
- Retro-recategorising settled history beyond what A2/A8 touch
- Restructuring the category list
- Enable Banking migration (TrueLayer stays the sync path)

## Prerequisites
- **TrueLayer consent expired 2026-10-01**: Chris re-connects before Phase C goes live
- Merge or supersede `origin/fix/retired-claude-models` (A6) and `feat/ai-usage-audit` (A11)

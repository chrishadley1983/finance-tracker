# Auto-Categorisation v2 — Deep Dive & Plan

**Date:** 2026-07-01
**Trigger:** First TrueLayer auto-import produced 32 uncategorised + ~26 miscategorised transactions in June alone.

---

## 1. How categorisation works today

Pipeline on sync/import (`lib/categorisation/engine.ts`, called from `lib/truelayer/sync.ts` + `lib/enable-banking/sync.ts` + CSV import):

1. **Rule match** against `category_mappings` (31 rows)
2. **Similar lookup** — pg_trgm trigram similarity vs categorised history (threshold 0.5, +0.1 boost per agreeing match)
3. **AI fallback** — Claude (`claude-sonnet-4-20250514`, quota-tracked in `ai_usage_tracking`)
4. **None** → `category_id = null`, `needs_review = true`

Supporting infra that already exists:
- `category_corrections` + `lib/categorisation/learning.ts` — records user corrections, suggests rules after 3 similar corrections. **Currently 0 rows — the loop has never fired.**
- Review-queue API (`app/api/transactions/review-queue`) + flag route.
- `ai_mapping_cache` (2 rows), `rules-manager.ts` for rule CRUD.

## 2. Why it failed in June (evidence)

| # | Root cause | Evidence |
|---|-----------|----------|
| 1 | **Low-confidence fuzzy matches auto-applied silently.** `needs_review = !categoryId` — any assigned category passes, confidence discarded. | Hush Homewear→Eating out, SportsDirect→Transfers, Card Factory→Eating out, WH Smith→Eating out, JustPark & East Midlands Rail→Holiday Hotels, LEON→Groceries… ~26 wrong in June |
| 2 | **Provenance destroyed.** `mapCategorisationSource()` collapses `similar`→`'rule'`; confidence never persisted. Can't triage what to trust. | June rows show `src=rule` for matches that were actually trigram guesses |
| 3 | **Rule base is legacy spreadsheet labels, not merchant patterns.** "Food Shopping", "AH Salary" etc. never match live bank descriptors. | 31 rules; almost every June row fell through to similar/AI |
| 4 | **No merchant normalisation.** Refs/locations/prefixes (`AMAZON* NQ70H8U14`, `INT'L 0088890845 …`, `Zettle_*…`, `)))`, `VIS/DD/BP/CR`) pollute both rule matching and trigram similarity. | Same merchant appears in dozens of string forms |
| 5 | **No feedback loop.** Corrections (incl. today's 58 manual fixes) update rows but never call `recordCorrection`, so no rules get mined. | `category_corrections` = 0 rows |
| 6 | **Policy cases unencoded.** FX fees bounced between Holiday Travel and Consumerables. | 9 fee rows wrong in June |

## 3. Target design

### Phase 1 — Make the engine trustworthy (finance-tracker code)

**1a. Persist confidence + true source; gate on confidence.**
- Add `categorisation_confidence numeric` to `finance.transactions`; keep the raw engine source (extend the enum or add `engine_source text`).
- `needs_review = (no category) OR (confidence < 0.8)` — low-confidence guesses still get applied (best-effort) but land in the review queue instead of passing silently.

**1b. Merchant normaliser (`lib/categorisation/normalise.ts`).**
Strip payment-processor prefixes (`ZETTLE_*`, `SumUp *`, `SP `, `SQ *`, `TST-`, `BCK*`, `CCV*`, `PAYPAL *`), Amazon order refs, `INT'L nnnnnnnn`, FX-rate suffixes, `)))`, trailing towns/`VIS|DD|BP|CR`. Output a canonical merchant key (e.g. `sainsburys`, `amazon`, `pret a manger`). Use it everywhere: rule lookup, similarity, correction grouping, AI cache key.

**1c. Mine merchant rules from history (one-off script + weekly job).**
For each normalised merchant with ≥3 categorised transactions and ≥90% category agreement → upsert a `category_mappings` rule (`match_type='merchant'`, confidence = agreement). ~3,600 rows of history become a real rule base (ALDI, Sainsbury's, Pret, HelloFresh, TFL, Octopus, school, HSBC transfers…). Deterministic, free, instant — fuzzy/AI become the exception, not the norm.

**1d. Tighten similar-match auto-apply.**
Auto-apply only if ≥3 of top-5 matches agree AND best similarity ≥0.65 (on normalised text); otherwise assign best guess with low confidence → review queue. Kills the Hush-Homewear class of error.

**1e. Wire the learning loop.**
Every category change to a previously auto-categorised row (review-queue PATCH, transaction edit, or the skill below) calls `recordCorrection()`. `analyseCorrections()` already suggests rules at ≥3 corrections — surface suggestions in the review queue and auto-create at ≥5 with 100% agreement.

**1f. Encode policy rules (is_system=true).**
- `NON-STERLING TRANSACTION FEE` / `Non-Sterling Transaction Fee` → **Holiday Travel** (Chris's chosen default, 2026-07-01)
- `PAYMENT - THANK YOU` → Credit card payments; `HSBC PREMIER…` → Transfers (already work — keep as system rules so they can't be un-mined)

### Phase 2 — Human-in-the-loop via Claude (the ask-when-unclear part)

**2a. `finance-recategorise` skill** (user-level, so it works from any session):
1. Pull review queue (uncategorised OR needs_review) via service-role.
2. Group by normalised merchant; propose a category per group (precedent + AI reasoning).
3. **AskUserQuestion** for the genuinely ambiguous (batched, 4 per call, options = top category candidates + "leave").
4. Apply with `categorisation_source='manual'`, `needs_review=false`; call `recordCorrection` for every override so rules get mined.
5. Offer month-audit mode: sweep a date range for suspect assignments (card purchases in Transfers, cross-category outliers vs merchant history) — automates today's manual June audit.

**2b. Sync-time integration.**
- Local scheduled sync (`scripts/sync-truelayer.ts`, Task Scheduler weekly + 1st) already prints per-account results — extend to print a review-queue summary (N low-confidence, M uncategorised).
- When a sync is triggered through a Claude session, run the skill's ask-loop immediately after import so the queue never accumulates.

### Phase 3 — Optional polish
- Few-shot AI prompt: include each transaction's top-5 similar precedents (own history) in the batch prompt; cache verdicts in `ai_mapping_cache` by merchant key.
- Model bump: `claude-sonnet-4-20250514` is old — move to Haiku 4.5 (cheap, fine for this) or Sonnet 5.
- Weekly digest (email/Discord): imported N, auto-categorised by source, K awaiting review.

## 4. Sequencing & effort

| Step | Size | Depends on |
|------|------|-----------|
| 1a confidence + gating | S (migration + 2 sync call-sites) | — |
| 1b normaliser | M (pure fn + tests) | — |
| 1c rule mining | M (script + weekly job) | 1b |
| 1d similarity tightening | S | 1b |
| 1e learning loop wiring | S (call-sites exist) | — |
| 1f policy rules | XS (SQL) | — |
| 2a skill | M | 1a–1f give it good data, but can ship independently |
| 2b sync summary | XS | 1a |

Recommended order: **1f + 1a → 1b → 1c/1d → 1e → 2a → 2b**, Phase 3 later.
Feature track: `/define-done` → `/build-feature` on `feature/auto-categorisation-v2`.

## 5. Open items from the 2026-07-01 audit
- "AI Supa" ×3 (~£47 each, foreign currency, HSBC CC; **two identical charges 4 Jun** — possible duplicate). Chris to check full merchant name in HSBC app; then categorise (likely Subscriptions).
- MMBILL.COM stays Transfers by choice.
- Backup of deleted Global Money synced rows: `finance._backup_global_money_tx_20260701` (34 rows) — drop after ~a month.

# Kept rules — daily-categorisation A2 / A7

`npm run rules:check` lists every rule that, using today's matcher, wins for at least one settled transaction whose settled category differs. Each rule below is kept on purpose. Any rule NOT listed here fails the check.

Snapshot: 2026-10-01, after `policies:sync`, hygiene and mining. 4,236 settled rows, 212 winning rules, 28 contradicted, all listed.

## Policies — Chris's standing decision; disagreeing rows predate it

| Rule | Category | Why kept |
|---|---|---|
| `non sterling transaction fee` | Holiday Travel | 58 of 61 disagreeing rows are pre-July 2026 "Service fees". The FX-fee → Holiday Travel policy dates from 2026-07-01. |
| `mmbill com` | Transfers | 15 older rows are Subscriptions. The finance-recategorise policy (Sep 2026) says leave as Transfers. ⚠ Chris to confirm Transfers vs Subscriptions. |
| `hsbc premier` | Transfers | 9 rows from the 2025 CSV import are "Credit card payments" (the other leg). The current→card transfer leg is Transfers. |
| `se tonbridge sst` | Social Travel | Non-commute fares. 6 older rule-applied rows are Work Travel. ⚠ Chris to confirm the amount rule (memory, 2026-06-09). |
| `se tonbridge sst` | Work Travel | Commute fares £19.20 / £40.70 (two policy rows). 5 older rule-applied rows at these amounts are Social Travel. Same ⚠. |
| `hadley bricks` | Chris Income | Credit-only policy. 3 older rows are Transfers. HB drawings are Chris Income. |
| `ebay commerce` | Chris Income | Joint-account credits. 2 rows predate the 2026-09-19 decision (Lego In / Lego Out). |
| `stripe payments` | Chris Income | Joint-account credits. 1 row predates the 2026-09-19 decision (Transfers). |
| `interest` | Service fees & bank charges | Debit-only policy. 1 old (2023) negative "Bank Interest" row is Other income. |

## Minority exceptions — the rule is right for ≥85% of what it matches

| Rule | Category | Disagree | Why kept |
|---|---|---|---|
| `bp hilden s` | Groceries | 4/68 | Shop purchases at the BP station; the 4 are fuel. |
| `amznmktplace co uk` | Consumerables | 3/20 | The 3 are gifts bought on Amazon. Item-level context the engine can't see. |
| `pret a manger` | Coffee | 2/30 | Occasional lunch logged as Eating out. |
| `ringgo parking myringgo` | Social Travel | 2/45 | 2 work-trip parking rows. |
| `airbnb` | Holiday Hotels | 2/19 | One-off Holiday Travel / Subscriptions entries. |
| `dart charge auto` | Social Travel | 1/15 | One-off. |
| `se hildenborough thildenbo` | Work Travel | 1/13 | One-off social trip. |
| `cash bnkm bp` | Home improvement | 1/25 | One-off. |
| `stocks green prima` | Clubs & Kids Activities | 1/12 | One-off. |
| `accenture fenchurclondon` | Eating out | 1/18 | One-off coffee. |
| `amazon london` | Consumerables | 1/42 | One business-clothing purchase. |
| `supabase singapore` | Subscriptions | 1/10 | One-off. |
| `amazon uk london` | Consumerables | 1/11 | One-off. |
| `netflix` | Subscriptions | 1/20 | One-off. |

## Small samples — one exception; supersession needs ≥2 manual disagreements

| Rule | Category | Disagree | Why kept |
|---|---|---|---|
| `wh smith heathr` | Eating out | 1/3 | 2 of 3 agree. Re-pointed automatically if Chris corrects a second one. |
| `lego house billund` | Consumerables | 1/5 | 4 of 5 agree. |
| `worldofbooks cogoring by` | Consumerables | 1/3 | Re-pointed today by mining (manual evidence); one older gift row remains. |
| `prime video rent` | Subscriptions | 1/3 | 2 of 3 agree. |

## A7(c) — legacy spreadsheet-label rules (hygiene 2026-10-01)

These were confidence-1.0 category labels imported from "Life Planning V2". With whole-word matching on the normalised description, most matched nothing in bank data.

| Rule | Category | Outcome |
|---|---|---|
| `Car Insurance`, `Car Servicing`, `Childcare`, `Coffee`, `Restaurants`, `Takeaway`, `Food Shopping`, `Holiday Hotels`, `Holiday Travel`, `House Upkeep`, `Council Tax`, `Cleaner`, `Donations`, `Gym and Sports`, `Mobile Phone`, `Sky Broadband`, `Subscriptions`, `Activities`, `Consumerables`, `Gifts`, `Health Beauty`, `Household Items`, `Social Travel`, `Work Commute`, `House Insurance`, `Water`, `AH Salary`, `CH Salary`, `Gifts In` | (various) | Deleted: 0 matches since 2026-01-01 |
| `Clothing` | Clothing & shoes | Lowered 1.0 → 0.85 (1 match since 2026-01-01) |
| `Energy` | Utilities | Lowered 1.0 → 0.85 (9 matches since 2026-01-01) |
| `interest` (mined) | Service fees & bank charges | Deleted. Replaced by the `interest` debit-only policy. |

Mining on 2026-10-01 also deleted:
- 26 digit-token rules (e.g. `ebay o 23` → Lego Out, `waitrose 667 tonbridge`);
- 2 mined rules that settled history no longer supports (`tonbridge tonbridge` 33%, `justpark london` 25%).

It also rejected the too-broad candidate `tonbridge` (5% agreement across 642 rows).

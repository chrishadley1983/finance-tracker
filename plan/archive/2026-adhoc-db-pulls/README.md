# One-off DB pull scripts — FROZEN, superseded

Ad-hoc pulls of snapshots, income and spend used during the Jun–Sep 2026 planning sessions, each with its
own income/expense classification. Superseded by `plan/inputs/` (phase 3), which reuses
`lib/reports/classify.ts` and `lib/plan/spend.ts#computeRunRate` so there is one classification rule.
Known bug kept for the record: `ifa-context-dump.mjs` orders `wealth_snapshots` by `snapshot_date`; the
column is `date`, so that section silently returned an error string.

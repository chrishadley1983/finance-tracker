/**
 * Chris's standing categorisation policies — the single source of truth.
 *
 * `npm run policies:sync` upserts these into finance.category_mappings as
 * `is_system` policy rules (evaluated before every other rule, never changed
 * by mining). The finance-recategorise skill and the AI prompt read them back
 * from the database, so edit HERE and re-sync rather than in the DB.
 *
 * Sources: finance-recategorise skill policies (2026-09-19), the HSBC import
 * memory (2026-06-09), and the 2026-07-01 system rules.
 */

export interface PolicyDefinition {
  /** Stable id for tests/logs. */
  key: string;
  /** Token-bounded `contains` pattern, matched against the normalised description. */
  pattern: string;
  categoryName: string;
  /** Matched against finance.accounts.name. */
  accountName?: string;
  amountSign?: 'debit' | 'credit';
  amountMin?: number;
  amountMax?: number;
  /** ISO weekdays of the transaction date (1=Mon … 7=Sun). */
  daysOfWeek?: number[];
  action?: 'categorise' | 'ask';
  note: string;
}

export const POLICY_CONFIDENCE = 0.95;

/** Policies Chris has replaced — `policies:sync` deletes their rows. */
export const RETIRED_POLICY_KEYS = [
  'se-tonbridge-commute-1920', // replaced 2026-10-01 by the weekend / under-£20 / weekday-£20+ rules
  'se-tonbridge-commute-4070',
];

const JOINT = 'HSBC Joint Current Account';
const HB_PAYOUT = 'Hadley Bricks money landing in the joint account is Chris Income (decided 2026-09-19)';
const EV_ASK = 'EV charging can be Work or Social Travel — always ask Chris';
// Self-employed tax (HB profit + Micro1/Deel are paid gross). Chris, 2026-10-17:
// each transfer into the tax pot is filed as Tax set-aside (an expense), so the
// tax comes off in the month the income lands; the HMRC payment out of the pot
// is then not counted again. The pot (HSBC 40-19-23 91248553) is not a tracked
// account, so payments from it never reach finance.transactions.
const TAX_POT = '401923 91248553';
const TAX_SET_ASIDE = 'Tax set-aside';

export const POLICIES: PolicyDefinition[] = [
  // Hadley Bricks money paid into the personal joint account
  { key: 'stripe-payout', pattern: 'stripe payments', categoryName: 'Chris Income', accountName: JOINT, amountSign: 'credit', note: HB_PAYOUT },
  { key: 'shopify-payout', pattern: 'shopify inc', categoryName: 'Chris Income', accountName: JOINT, amountSign: 'credit', note: HB_PAYOUT },
  { key: 'ebay-commerce-payout', pattern: 'ebay commerce', categoryName: 'Chris Income', accountName: JOINT, amountSign: 'credit', note: HB_PAYOUT },
  { key: 'hadley-bricks-drawings', pattern: 'hadley bricks', categoryName: 'Chris Income', amountSign: 'credit', note: 'Hadley Bricks drawings are Chris Income' },

  // Merchant policies
  { key: 'mmbill', pattern: 'mmbill com', categoryName: 'Transfers', note: 'MMBILL.COM stays in Transfers (finance-recategorise policy)' },
  { key: 'horsham-coffee', pattern: 'horsham coffee', categoryName: 'Groceries', note: 'SP HORSHAM COFFEE = coffee-bean orders → Groceries' },
  { key: 'fx-fee', pattern: 'non sterling transaction fee', categoryName: 'Holiday Travel', note: 'FX fees default to Holiday Travel (Chris, 2026-07-01)' },
  { key: 'card-repayment', pattern: 'payment thank you', categoryName: 'Credit card payments', note: 'Credit-card repayments' },
  { key: 'hsbc-premier-transfer', pattern: 'hsbc premier', categoryName: 'Transfers', note: 'Current → credit-card transfer legs' },
  { key: 'card-interest', pattern: 'interest', categoryName: 'Service fees & bank charges', amountSign: 'debit', note: 'Card interest charged is a bank charge (interest received is not)' },

  // SE Tonbridge rail fares (Chris, 2026-10-01): under £20 or at the weekend =
  // Social Travel; a weekday fare of £20+ = Work Travel. The three debit rows
  // are disjoint for every Work/Social outcome (the Work row is weekday-only),
  // so the result never depends on tie-breaking; the unconditioned row only
  // catches credits (refunds).
  { key: 'se-tonbridge-weekend', pattern: 'se tonbridge sst', categoryName: 'Social Travel', amountSign: 'debit', daysOfWeek: [6, 7], note: 'Weekend rail fare = Social Travel' },
  { key: 'se-tonbridge-under-20', pattern: 'se tonbridge sst', categoryName: 'Social Travel', amountSign: 'debit', amountMax: 19.99, note: 'Rail fare under £20 = Social Travel' },
  { key: 'se-tonbridge-weekday-20-plus', pattern: 'se tonbridge sst', categoryName: 'Work Travel', amountSign: 'debit', amountMin: 20, daysOfWeek: [1, 2, 3, 4, 5], note: 'Weekday rail fare £20+ = Work Travel' },
  { key: 'se-tonbridge-other', pattern: 'se tonbridge sst', categoryName: 'Social Travel', note: 'Other SE Tonbridge rows (e.g. refunds) = Social Travel' },

  // Tax set-aside (Chris, 2026-10-17). The pot pattern contains digits, so it is
  // matched against the lightly-normalised description (digits kept).
  { key: 'tax-pot-in', pattern: TAX_POT, categoryName: TAX_SET_ASIDE, accountName: JOINT, amountSign: 'debit', note: 'Joint → tax pot transfer = Tax set-aside (tax on gross HB/Micro1 income)' },
  { key: 'tax-pot-out', pattern: TAX_POT, categoryName: 'Transfers', accountName: JOINT, amountSign: 'credit', note: 'Money back from the tax pot = Transfers (the set-aside was already counted)' },
  // HMRC Self Assessment paid from a tracked (non-pot) account is real tax that
  // was not set aside first. CHILD BENEFIT never matches ("hmrc child benefit").
  { key: 'hmrc-self-assessment', pattern: 'hmrc self as', categoryName: TAX_SET_ASIDE, amountSign: 'debit', note: 'HMRC Self Assessment paid from a tracked account = Tax set-aside' },
  { key: 'hmrc-self-assessment-long', pattern: 'hmrc self assessment', categoryName: TAX_SET_ASIDE, amountSign: 'debit', note: 'HMRC Self Assessment paid from a tracked account = Tax set-aside' },

  // EV charging — always ask
  ...['gridserve', 'instavolt', 'applegreen electri', 'applegreen electric', 'totalenergies charging', 'pod point', 'ionity', 'bp pulse', 'recharge', 'robo charge', 'tesla supercharger'].map(
    (pattern): PolicyDefinition => ({
      key: `ev-${pattern.replace(/\s+/g, '-')}`,
      pattern,
      categoryName: 'Social Travel',
      action: 'ask',
      note: EV_ASK,
    })
  ),
];

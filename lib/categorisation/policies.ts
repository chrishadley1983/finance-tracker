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
  action?: 'categorise' | 'ask';
  note: string;
}

export const POLICY_CONFIDENCE = 0.95;

const JOINT = 'HSBC Joint Current Account';
const HB_PAYOUT = 'Hadley Bricks money landing in the joint account is Chris Income (decided 2026-09-19)';
const EV_ASK = 'EV charging can be Work or Social Travel — always ask Chris';

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

  // Train fares: the commute fares are Work Travel, anything else Social Travel
  { key: 'se-tonbridge-commute-1920', pattern: 'se tonbridge sst', categoryName: 'Work Travel', amountSign: 'debit', amountMin: 19.2, amountMax: 19.2, note: 'Commute fare £19.20 = Work Travel' },
  { key: 'se-tonbridge-commute-4070', pattern: 'se tonbridge sst', categoryName: 'Work Travel', amountSign: 'debit', amountMin: 40.7, amountMax: 40.7, note: 'Commute fare £40.70 = Work Travel' },
  { key: 'se-tonbridge-other', pattern: 'se tonbridge sst', categoryName: 'Social Travel', note: 'Other SE Tonbridge fares = Social Travel' },

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

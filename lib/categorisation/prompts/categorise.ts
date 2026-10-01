/**
 * Categorisation Prompt Templates
 *
 * Prompts for Claude to categorise financial transactions.
 */

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

/**
 * Prompt for categorising a single transaction.
 * Variables: {date}, {description}, {amount}, {categoriesList}
 */
export const SINGLE_CATEGORISE_PROMPT = `You are categorising a UK financial transaction.

Transaction:
- Date: {date}
- Description: {description}
- Amount: {amount}

Available categories:
{categoriesList}

Select the most appropriate category for this transaction. Consider:
- The merchant or payee name in the description
- Common UK transaction patterns (DIRECT DEBIT, CARD PAYMENT, FASTER PAYMENT, etc.)
- Amount sign: negative = expense, positive = income

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "categoryId": "uuid of best match",
  "categoryName": "name for verification",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation",
  "alternatives": [
    {"categoryId": "uuid", "categoryName": "name", "confidence": 0.X}
  ]
}`;

/**
 * Prompt for categorising multiple transactions in batch.
 * Variables: {transactionsList}, {categoriesList}
 */
export const BATCH_CATEGORISE_PROMPT = `You are categorising multiple UK financial transactions for Chris's household finance tracker.

Transactions:
{transactionsList}

Available categories:
{categoriesList}
{contextBlock}
For each transaction, select the most appropriate category. Consider, in this order:
- Chris's standing policies (if listed above) — always follow them
- How similar past transactions were settled (precedents) and Chris's recent corrections
- The merchant or payee name in the description
- Common UK transaction patterns (DIRECT DEBIT, CARD PAYMENT, FASTER PAYMENT, etc.)
- Amount sign: negative = expense, positive = income. A refund belongs in the category of the original spend, not income
- If a transaction has no precedent, give your best guess but keep confidence at or below 0.7

Respond ONLY with valid JSON array (no markdown, no explanation):
[
  {
    "index": 0,
    "categoryId": "uuid",
    "categoryName": "name",
    "confidence": 0.0 to 1.0,
    "reasoning": "brief explanation"
  }
]`;

// =============================================================================
// TYPES
// =============================================================================

export interface Category {
  id: string;
  name: string;
  groupName: string;
  isIncome: boolean;
}

export interface TransactionForCategorisation {
  date: string;
  description: string;
  amount: number;
}

export interface AICategorisationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string;
  alternatives?: {
    categoryId: string;
    categoryName: string;
    confidence: number;
  }[];
}

export interface BatchCategorisationResult {
  index: number;
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string;
}

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Format categories list for the prompt.
 * Groups by group_name for clarity.
 */
export function formatCategoriesList(categories: Category[]): string {
  // Group by group_name
  const groups = new Map<string, Category[]>();

  for (const cat of categories) {
    const group = groups.get(cat.groupName) || [];
    group.push(cat);
    groups.set(cat.groupName, group);
  }

  const lines: string[] = [];

  Array.from(groups.entries()).forEach(([groupName, cats]) => {
    lines.push(`\n${groupName}:`);
    for (const cat of cats) {
      const incomeTag = cat.isIncome ? ' [INCOME]' : '';
      lines.push(`  - ${cat.name} (id: ${cat.id})${incomeTag}`);
    }
  });

  return lines.join('\n');
}

/**
 * Format a single transaction for the prompt.
 */
export function formatTransaction(tx: TransactionForCategorisation): string {
  const amountStr = tx.amount >= 0 ? `+£${tx.amount.toFixed(2)}` : `-£${Math.abs(tx.amount).toFixed(2)}`;
  return `Date: ${tx.date}, Amount: ${amountStr}, Description: "${tx.description}"`;
}

/**
 * Format multiple transactions for batch prompt.
 */
export function formatTransactionsList(transactions: TransactionForCategorisation[]): string {
  return transactions
    .map((tx, i) => `${i}. ${formatTransaction(tx)}`)
    .join('\n');
}

/**
 * Build the single categorisation prompt.
 */
export function buildSingleCategorisePrompt(
  transaction: TransactionForCategorisation,
  categories: Category[]
): string {
  const amountStr = transaction.amount >= 0
    ? `+£${transaction.amount.toFixed(2)} (income)`
    : `-£${Math.abs(transaction.amount).toFixed(2)} (expense)`;

  return SINGLE_CATEGORISE_PROMPT
    .replace('{date}', transaction.date)
    .replace('{description}', transaction.description)
    .replace('{amount}', amountStr)
    .replace('{categoriesList}', formatCategoriesList(categories));
}

/**
 * Learning context for the batch prompt (see lib/categorisation/ai-context.ts).
 * Structural so this module stays free of DB imports.
 */
export interface PromptContext {
  precedents: { description: string; categoryName: string; similarity: number; date: string }[][];
  corrections: { description: string; fromCategory: string | null; toCategory: string }[];
  policies: string[];
}

/**
 * Format the policies / corrections / precedents block. Empty sections are
 * omitted; no context at all yields an empty string.
 */
export function formatContextBlock(context?: PromptContext): string {
  if (!context) return '';
  const sections: string[] = [];

  if (context.policies.length > 0) {
    sections.push(`Chris's standing policies (always follow):\n${context.policies.join('\n')}`);
  }

  if (context.corrections.length > 0) {
    const lines = context.corrections.map(
      (c) => `- "${c.description}": ${c.fromCategory ?? 'uncategorised'} → corrected to ${c.toCategory}`
    );
    sections.push(`Recent corrections Chris made to similar transactions (the earlier guess was wrong):\n${lines.join('\n')}`);
  }

  const precedentLines: string[] = [];
  context.precedents.forEach((list, i) => {
    if (list.length === 0) {
      precedentLines.push(`${i}. (no precedent — new merchant)`);
      return;
    }
    const examples = list
      .map((p) => `"${p.description}" → ${p.categoryName} (${p.date}, ${Math.round(p.similarity * 100)}% similar)`)
      .join('; ');
    precedentLines.push(`${i}. ${examples}`);
  });
  if (precedentLines.length > 0) {
    sections.push(`How similar past transactions were settled (by transaction index):\n${precedentLines.join('\n')}`);
  }

  return sections.length > 0 ? `\n${sections.join('\n\n')}\n` : '';
}

/**
 * Build the batch categorisation prompt.
 */
export function buildBatchCategorisePrompt(
  transactions: TransactionForCategorisation[],
  categories: Category[],
  context?: PromptContext
): string {
  // Function replacers: descriptions are bank data and may contain `$&`-style
  // sequences that a string replacement would interpret.
  return BATCH_CATEGORISE_PROMPT
    .replace('{transactionsList}', () => formatTransactionsList(transactions))
    .replace('{categoriesList}', () => formatCategoriesList(categories))
    .replace('{contextBlock}', () => formatContextBlock(context));
}

// =============================================================================
// RESPONSE VALIDATION
// =============================================================================

/**
 * Validate single categorisation response from AI.
 */
export function validateSingleResponse(response: unknown): response is AICategorisationResult {
  if (!response || typeof response !== 'object') return false;

  const resp = response as Record<string, unknown>;

  if (typeof resp.categoryId !== 'string') return false;
  if (typeof resp.categoryName !== 'string') return false;
  if (typeof resp.confidence !== 'number') return false;
  if (typeof resp.reasoning !== 'string') return false;

  if (resp.alternatives !== undefined) {
    if (!Array.isArray(resp.alternatives)) return false;
    for (const alt of resp.alternatives) {
      if (typeof alt !== 'object' || !alt) return false;
      if (typeof (alt as Record<string, unknown>).categoryId !== 'string') return false;
      if (typeof (alt as Record<string, unknown>).categoryName !== 'string') return false;
      if (typeof (alt as Record<string, unknown>).confidence !== 'number') return false;
    }
  }

  return true;
}

/**
 * Validate batch categorisation response from AI.
 */
export function validateBatchResponse(response: unknown): response is BatchCategorisationResult[] {
  if (!Array.isArray(response)) return false;

  for (const item of response) {
    if (!item || typeof item !== 'object') return false;
    const resp = item as Record<string, unknown>;

    if (typeof resp.index !== 'number') return false;
    if (typeof resp.categoryId !== 'string') return false;
    if (typeof resp.categoryName !== 'string') return false;
    if (typeof resp.confidence !== 'number') return false;
    if (typeof resp.reasoning !== 'string') return false;
  }

  return true;
}

/**
 * AI Categoriser
 *
 * Uses Claude API to categorise transactions when rules and similar
 * transactions don't provide confident matches.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAiUsage, usageFields } from '@/lib/ai-usage-audit';
import {
  buildSingleCategorisePrompt,
  buildBatchCategorisePrompt,
  validateSingleResponse,
  validateBatchResponse,
  type Category,
  type TransactionForCategorisation,
  type AICategorisationResult as AICategorisationResultType,
  type BatchCategorisationResult,
  type PromptContext,
} from './prompts/categorise';

/**
 * AI result as returned to the engine. `categoryId` is null when Claude named
 * a category that doesn't exist (by id or name) — the row must then stay
 * uncategorised rather than carry an id that breaks the FK on insert.
 */
export type AICategorisationResult = Omit<AICategorisationResultType, 'categoryId'> & {
  categoryId: string | null;
};

// =============================================================================
// CONFIGURATION
// =============================================================================

const AI_CONFIG = {
  model: 'claude-sonnet-5',
  maxTokens: 2048,
  timeout: 30000,
  maxBatchSize: 10,
  maxRetries: 1,
};

// =============================================================================
// TYPES
// =============================================================================

export class AICategorisationError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'PARSE_ERROR' | 'INVALID_RESPONSE' | 'RATE_LIMITED' | 'TIMEOUT'
  ) {
    super(message);
    this.name = 'AICategorisationError';
  }
}

// =============================================================================
// CACHE
// =============================================================================

// Categories cache (refreshed every 10 minutes)
let categoriesCache: Category[] | null = null;
let categoriesCacheTimestamp = 0;
const CATEGORIES_CACHE_TTL = 10 * 60 * 1000;

async function getCategories(): Promise<Category[]> {
  const now = Date.now();

  if (categoriesCache && now - categoriesCacheTimestamp < CATEGORIES_CACHE_TTL) {
    return categoriesCache;
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, group_name, is_income')
    .order('group_name')
    .order('display_order');

  if (error) {
    console.error('Failed to fetch categories:', error);
    return categoriesCache || [];
  }

  categoriesCache = data.map((c) => ({
    id: c.id,
    name: c.name,
    groupName: c.group_name,
    isIncome: c.is_income,
  }));
  categoriesCacheTimestamp = now;

  return categoriesCache;
}

/**
 * Clear categories cache (useful after category changes).
 */
export function clearCategoriesCache(): void {
  categoriesCache = null;
  categoriesCacheTimestamp = 0;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse Claude's JSON response, handling potential markdown wrapping.
 */
function parseAIResponse(text: string): unknown {
  let cleaned = text.trim();

  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

/**
 * Validate that a category ID exists.
 */
async function validateCategoryId(categoryId: string): Promise<boolean> {
  const categories = await getCategories();
  return categories.some((c) => c.id === categoryId);
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Categorise a single transaction using Claude AI.
 */
export async function categoriseWithAI(
  transaction: TransactionForCategorisation
): Promise<AICategorisationResult> {
  const categories = await getCategories();

  if (categories.length === 0) {
    throw new AICategorisationError('No categories available', 'API_ERROR');
  }

  const prompt = buildSingleCategorisePrompt(transaction, categories);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts <= AI_CONFIG.maxRetries) {
    attempts++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

      const requestStart = Date.now();
      const message = await client.messages.create({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      clearTimeout(timeoutId);

      // Fire-and-forget AI-usage audit (never awaited, never throws).
      void logAiUsage({
        feature: 'categoriser',
        model: message.model,
        status: 'success',
        request_ms: Date.now() - requestStart,
        anthropic_message_id: message.id,
        metadata: { mode: 'single', attempt: attempts },
        ...usageFields(message.usage),
      });

      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new AICategorisationError('No text response from AI', 'INVALID_RESPONSE');
      }

      let parsed: unknown;
      try {
        parsed = parseAIResponse(textContent.text);
      } catch {
        throw new AICategorisationError(
          `Failed to parse AI response: ${textContent.text.slice(0, 200)}`,
          'PARSE_ERROR'
        );
      }

      if (!validateSingleResponse(parsed)) {
        throw new AICategorisationError(
          'AI response does not match expected structure',
          'INVALID_RESPONSE'
        );
      }

      // Validate category ID exists
      const isValid = await validateCategoryId(parsed.categoryId);
      if (!isValid) {
        // Try to find by name
        const matchByName = categories.find(
          (c) => c.name.toLowerCase() === parsed.categoryName.toLowerCase()
        );
        if (matchByName) {
          parsed.categoryId = matchByName.id;
        } else {
          return { ...parsed, categoryId: null, confidence: 0 };
        }
      }

      return parsed;
    } catch (error) {
      lastError = error as Error;

      // AICategorisationError fires after a successful API call — already
      // logged as success, so don't double-count it here.
      if (error instanceof AICategorisationError) {
        if (error.code === 'PARSE_ERROR' && attempts <= AI_CONFIG.maxRetries) {
          continue;
        }
        throw error;
      }

      // The API call itself failed — log an error row (fire-and-forget).
      void logAiUsage({
        feature: 'categoriser',
        model: AI_CONFIG.model,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        metadata: { mode: 'single', attempt: attempts },
      });

      if (error instanceof Anthropic.RateLimitError) {
        throw new AICategorisationError(
          'AI rate limit exceeded. Please try again later.',
          'RATE_LIMITED'
        );
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AICategorisationError('AI request timed out', 'TIMEOUT');
      }

      break;
    }
  }

  throw new AICategorisationError(
    `AI categorisation failed: ${lastError?.message || 'Unknown error'}`,
    'API_ERROR'
  );
}

/**
 * Categorise multiple transactions in a single AI call (batch).
 * More efficient than calling categoriseWithAI for each transaction.
 */
export async function categoriseBatchWithAI(
  transactions: TransactionForCategorisation[],
  context?: PromptContext
): Promise<Map<number, AICategorisationResult>> {
  if (transactions.length === 0) {
    return new Map();
  }

  // Limit batch size
  if (transactions.length > AI_CONFIG.maxBatchSize) {
    // Split into chunks and process
    const results = new Map<number, AICategorisationResult>();
    for (let i = 0; i < transactions.length; i += AI_CONFIG.maxBatchSize) {
      const chunk = transactions.slice(i, i + AI_CONFIG.maxBatchSize);
      const chunkContext = context
        ? { ...context, precedents: context.precedents.slice(i, i + AI_CONFIG.maxBatchSize) }
        : undefined;
      const chunkResults = await categoriseBatchWithAI(chunk, chunkContext);

      // Re-index results
      Array.from(chunkResults.entries()).forEach(([index, result]) => {
        results.set(i + index, result);
      });
    }
    return results;
  }

  const categories = await getCategories();

  if (categories.length === 0) {
    throw new AICategorisationError('No categories available', 'API_ERROR');
  }

  const prompt = buildBatchCategorisePrompt(transactions, categories, context);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts <= AI_CONFIG.maxRetries) {
    attempts++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

      const requestStart = Date.now();
      const message = await client.messages.create({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      clearTimeout(timeoutId);

      // Fire-and-forget AI-usage audit (never awaited, never throws).
      void logAiUsage({
        feature: 'categoriser',
        model: message.model,
        status: 'success',
        request_ms: Date.now() - requestStart,
        anthropic_message_id: message.id,
        metadata: { mode: 'batch', attempt: attempts, batchSize: transactions.length },
        ...usageFields(message.usage),
      });

      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new AICategorisationError('No text response from AI', 'INVALID_RESPONSE');
      }

      let parsed: unknown;
      try {
        parsed = parseAIResponse(textContent.text);
      } catch {
        throw new AICategorisationError(
          `Failed to parse AI response: ${textContent.text.slice(0, 200)}`,
          'PARSE_ERROR'
        );
      }

      if (!validateBatchResponse(parsed)) {
        throw new AICategorisationError(
          'AI response does not match expected structure',
          'INVALID_RESPONSE'
        );
      }

      // Convert to map and validate categories
      const results = new Map<number, AICategorisationResult>();

      for (const item of parsed as BatchCategorisationResult[]) {
        if (item.index < 0 || item.index >= transactions.length) continue;
        const isValid = await validateCategoryId(item.categoryId);
        let categoryId: string | null = item.categoryId;
        let categoryName = item.categoryName;

        if (!isValid) {
          const matchByName = categories.find(
            (c) => c.name.toLowerCase() === item.categoryName.toLowerCase()
          );
          // Unknown id and no name match → no category (never an invalid FK).
          categoryId = matchByName ? matchByName.id : null;
          if (matchByName) categoryName = matchByName.name;
        }

        results.set(item.index, {
          categoryId,
          categoryName,
          confidence: categoryId ? (isValid ? item.confidence : Math.min(item.confidence, 0.3)) : 0,
          reasoning: item.reasoning,
        });
      }

      return results;
    } catch (error) {
      lastError = error as Error;

      // AICategorisationError fires after a successful API call — already
      // logged as success, so don't double-count it here.
      if (error instanceof AICategorisationError) {
        if (error.code === 'PARSE_ERROR' && attempts <= AI_CONFIG.maxRetries) {
          continue;
        }
        throw error;
      }

      // The API call itself failed — log an error row (fire-and-forget).
      void logAiUsage({
        feature: 'categoriser',
        model: AI_CONFIG.model,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        metadata: { mode: 'batch', attempt: attempts, batchSize: transactions.length },
      });

      if (error instanceof Anthropic.RateLimitError) {
        throw new AICategorisationError(
          'AI rate limit exceeded. Please try again later.',
          'RATE_LIMITED'
        );
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AICategorisationError('AI request timed out', 'TIMEOUT');
      }

      break;
    }
  }

  throw new AICategorisationError(
    `AI batch categorisation failed: ${lastError?.message || 'Unknown error'}`,
    'API_ERROR'
  );
}

/**
 * Track AI categorisation usage for rate limiting.
 */
export async function trackAIUsage(count: number = 1): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Atomic increment (INSERT … ON CONFLICT DO UPDATE count = count + n). The
  // old upsert had no matching unique index and silently failed for months.
  const { error } = await supabaseAdmin.rpc('increment_ai_usage', {
    p_date: today,
    p_usage_type: 'categorisation',
    p_count: count,
  });
  if (error) {
    console.warn('Failed to track AI usage:', error.message);
  }
}

/**
 * Check if AI categorisation is available (not rate limited).
 */
export async function checkAIAvailability(): Promise<{
  available: boolean;
  remaining: number;
  dailyLimit: number;
}> {
  const dailyLimit = parseInt(process.env.AI_CATEGORISATION_DAILY_LIMIT || '100', 10);
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabaseAdmin
    .from('ai_usage_tracking')
    .select('count')
    .eq('date', today)
    .eq('usage_type', 'categorisation')
    .single();

  const used = data?.count || 0;
  const remaining = Math.max(0, dailyLimit - used);

  return {
    available: remaining > 0,
    remaining,
    dailyLimit,
  };
}

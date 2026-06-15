/**
 * Shared AI-usage audit logging.
 *
 * Logs every raw Anthropic-API-key call to a shared Supabase table
 * (public.ai_api_usage in project modjoikyuhqzouxvieua) so cross-project
 * AI spend can be tracked in one place.
 *
 * This is a DIFFERENT Supabase project than finance-tracker's own DB, so we
 * POST directly to its REST API with the publishable key — do NOT use the
 * app's Supabase client (it's scoped to a different schema/credentials).
 *
 * Hard rule: this is fire-and-forget. It must NEVER block, throw, or break
 * the request it's logging. Every call site uses `void logAiUsage(...)` and
 * all failures are swallowed.
 */

const AI_USAGE_SUPABASE_URL =
  process.env.AI_USAGE_SUPABASE_URL || 'https://modjoikyuhqzouxvieua.supabase.co';

const AI_USAGE_SUPABASE_KEY =
  process.env.AI_USAGE_SUPABASE_KEY ||
  'sb_publishable_ZfSKKyHywBhDtS4RLLUi5w_3Q_5Fu6v';

/**
 * A single row to insert into public.ai_api_usage.
 *
 * `project` and `billing_source` are fixed for this repo and filled in by
 * logAiUsage, so callers don't pass them. Null/undefined fields are stripped
 * before POSTing so the DB applies its own column defaults.
 */
export interface AiUsageRow {
  feature: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  request_ms?: number | null;
  status: 'success' | 'error';
  error?: string | null;
  anthropic_message_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Minimal shape of the `usage` object on an Anthropic Messages response.
 * Declared locally so this helper has no hard dependency on the SDK's types.
 */
interface AnthropicUsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Map an Anthropic response's `usage` object onto the token fields of an
 * AiUsageRow. Defaults each field to 0 (the table's token columns are NOT
 * NULL), and tolerates a missing/undefined usage object.
 *
 * Usage:
 *   const message = await client.messages.create(...);
 *   void logAiUsage({ feature: 'x', model: message.model, status: 'success',
 *                     ...usageFields(message.usage) });
 */
export function usageFields(
  usage: AnthropicUsageLike | null | undefined,
): Pick<
  AiUsageRow,
  | 'input_tokens'
  | 'output_tokens'
  | 'cache_creation_input_tokens'
  | 'cache_read_input_tokens'
> {
  return {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
  };
}

/**
 * Fire-and-forget insert of one usage row.
 *
 * Returns a Promise so callers *may* await it in tests, but in the hot path
 * it should be called as `void logAiUsage(...)` and never awaited — it
 * resolves to void and never rejects. All errors (network, auth, RLS, bad
 * payload) are caught and swallowed.
 */
export function logAiUsage(row: AiUsageRow): Promise<void> {
  // Build the full row with the repo-fixed fields, then strip null/undefined
  // so the DB applies its defaults rather than rejecting NOT NULL columns.
  const fullRow: Record<string, unknown> = {
    project: 'finance-tracker',
    billing_source: 'api_key',
    ...row,
  };
  for (const key of Object.keys(fullRow)) {
    if (fullRow[key] === null || fullRow[key] === undefined) {
      delete fullRow[key];
    }
  }

  return (async () => {
    try {
      await fetch(`${AI_USAGE_SUPABASE_URL}/rest/v1/ai_api_usage`, {
        method: 'POST',
        headers: {
          apikey: AI_USAGE_SUPABASE_KEY,
          Authorization: `Bearer ${AI_USAGE_SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(fullRow),
      });
    } catch {
      // Swallow — auditing must never break the request being audited.
    }
  })().catch(() => {
    // Defensive: even if the async wrapper throws synchronously somehow.
  });
}

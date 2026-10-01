/**
 * Rule audit trail (finance.category_rule_events).
 *
 * Every automated or answer-driven change to category_mappings is logged so
 * the learning summary can say what the engine learned, and so a bad change
 * can be traced and undone.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

export type RuleEventType = 'created' | 'repointed' | 'deleted' | 'updated';

export interface RuleEvent {
  ruleId: string | null;
  pattern: string;
  event: RuleEventType;
  oldCategoryId?: string | null;
  newCategoryId?: string | null;
  /** Who/what made the change: 'mining', 'answers', 'policies:sync', 'hygiene:2026-10-01'… */
  source: string;
  detail?: Record<string, unknown>;
}

/** Best-effort: a failed audit write never fails the change itself. */
export async function logRuleEvents(events: RuleEvent[]): Promise<void> {
  if (events.length === 0) return;
  const { error } = await supabaseAdmin.from('category_rule_events').insert(
    events.map((e) => ({
      rule_id: e.ruleId,
      pattern: e.pattern,
      event: e.event,
      old_category_id: e.oldCategoryId ?? null,
      new_category_id: e.newCategoryId ?? null,
      source: e.source,
      detail: (e.detail ?? {}) as Json,
    }))
  );
  if (error) console.warn('Failed to log rule events:', error.message);
}

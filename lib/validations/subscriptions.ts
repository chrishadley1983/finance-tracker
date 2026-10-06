import { z } from 'zod';
import { FREQUENCIES, SCOPES, STATUSES } from '@/lib/subscriptions/analysis';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** Every field, no defaults. */
const subscriptionFields = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  provider: optionalText(120),
  scope: z.enum(SCOPES),
  category: optionalText(60),
  amount: z.coerce.number().positive('Amount must be more than 0').max(100_000),
  currency: z.string().trim().length(3),
  frequency: z.enum(FREQUENCIES),
  billing_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  next_renewal_date: isoDate.nullable().optional(),
  start_date: isoDate.nullable().optional(),
  end_date: isoDate.nullable().optional(),
  auto_renew: z.boolean().optional(),
  cancellation_notice_days: z.coerce.number().int().min(0).max(365).nullable().optional(),
  payment_method: optionalText(60),
  bank_description_pattern: optionalText(120),
  status: z.enum(STATUSES),
  plan_tier: optionalText(60),
  notes: optionalText(1000),
  url: z.string().trim().url().max(500).nullable().optional().or(z.literal('').transform(() => null)),
});

/** A new subscription: unset scope, currency, frequency and status get their usual values. */
export const subscriptionSchema = subscriptionFields.extend({
  scope: subscriptionFields.shape.scope.default('personal'),
  currency: subscriptionFields.shape.currency.default('GBP'),
  frequency: subscriptionFields.shape.frequency.default('monthly'),
  status: subscriptionFields.shape.status.default('active'),
});

/**
 * A change to an existing subscription: only the fields sent. Built from the no-defaults shape on
 * purpose, because in Zod 4 `.partial()` keeps `.default()`s, which would silently reset scope,
 * frequency or status on every update.
 */
export const subscriptionUpdateSchema = subscriptionFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const dismissUntrackedSchema = z.object({
  description_pattern: z.string().trim().min(2).max(120),
  reason: optionalText(200),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;

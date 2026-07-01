import { z } from 'zod';

export const startAuthSchema = z.object({
  aspspName: z.string().min(1).default('HSBC'),
  aspspCountry: z.string().length(2).default('GB'),
});
export type StartAuthInput = z.infer<typeof startAuthSchema>;

export const linkAccountSchema = z.object({
  sessionRowId: z.string().uuid(),
  financeAccountId: z.string().uuid(),
  ebAccountUid: z.string().min(1),
});
export type LinkAccountInput = z.infer<typeof linkAccountSchema>;

export const unlinkAccountSchema = z.object({
  financeAccountId: z.string().uuid(),
});

export const syncRequestSchema = z.object({
  accountId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type SyncRequestInput = z.infer<typeof syncRequestSchema>;

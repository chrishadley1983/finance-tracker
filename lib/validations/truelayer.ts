import { z } from 'zod';

export const tlStartAuthSchema = z.object({
  // Provider filter for the TrueLayer auth screen. Default: all UK banks.
  providers: z.string().min(1).optional(),
});

export const tlLinkAccountSchema = z.object({
  connectionRowId: z.string().uuid(),
  financeAccountId: z.string().uuid(),
  truelayerAccountId: z.string().min(1),
});

export const tlUnlinkAccountSchema = z.object({
  financeAccountId: z.string().uuid(),
});

export const tlSyncRequestSchema = z.object({
  accountId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

import { z } from 'zod';

export const createNavPinSchema = z.object({
  // In-app paths only, e.g. "/budgets" or "/reports?month=2026-09".
  href: z
    .string()
    .min(1)
    .max(300)
    .regex(/^\/(?!\/)[^\s]*$/, 'Must be an in-app path'),
  label: z.string().trim().min(1).max(60),
});

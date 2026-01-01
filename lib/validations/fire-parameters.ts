import { z } from 'zod';

export const fireParametersSchema = z.object({
  id: z.string().uuid(),
  scenario_name: z.string().min(1).max(50),
  annual_spend: z.number().min(0),
  withdrawal_rate: z.number().min(0).max(100),
  expected_return: z.number().min(-100).max(100),
  retirement_age: z.number().int().min(18).max(100),
  state_pension_age: z.number().int().min(50).max(100),
  state_pension_amount: z.number().min(0),
  created_at: z.string().datetime(),
});

export const createFireParametersSchema = z.object({
  scenario_name: z.string().min(1).max(50),
  annual_spend: z.number().min(0),
  withdrawal_rate: z.number().min(0).max(100),
  expected_return: z.number().min(-100).max(100),
  retirement_age: z.number().int().min(18).max(100),
  state_pension_age: z.number().int().min(50).max(100),
  state_pension_amount: z.number().min(0),
});

export const updateFireParametersSchema = z.object({
  scenario_name: z.string().min(1).max(50).optional(),
  annual_spend: z.number().min(0).optional(),
  withdrawal_rate: z.number().min(0).max(100).optional(),
  expected_return: z.number().min(-100).max(100).optional(),
  retirement_age: z.number().int().min(18).max(100).optional(),
  state_pension_age: z.number().int().min(50).max(100).optional(),
  state_pension_amount: z.number().min(0).optional(),
});

export type FireParameters = z.infer<typeof fireParametersSchema>;
export type CreateFireParameters = z.infer<typeof createFireParametersSchema>;
export type UpdateFireParameters = z.infer<typeof updateFireParametersSchema>;

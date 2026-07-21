import { z } from 'zod';

export const performanceMeetingsHeldRequestSchema = z.object({
  startDate: z.string().min(1, 'startDate é obrigatório'),
  endDate: z.string().min(1, 'endDate é obrigatório'),
  sdrId: z.string().uuid().optional(),
  closerId: z.string().uuid().optional(),
  countMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PerformanceMeetingsHeldRequest = z.infer<typeof performanceMeetingsHeldRequestSchema>;

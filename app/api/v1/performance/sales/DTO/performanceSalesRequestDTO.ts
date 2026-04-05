import { z } from 'zod';

export const performanceSalesRequestSchema = z
  .object({
    preset: z.enum(['1d', '7d', '15d', '1m', '3m']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sdrId: z.string().uuid().optional(),
    closerId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) => {
      if (data.startDate && !data.endDate) return false;
      if (!data.startDate && data.endDate) return false;
      return true;
    },
    { message: 'startDate e endDate devem ser informados juntos' }
  );

export type PerformanceSalesRequest = z.infer<typeof performanceSalesRequestSchema>;

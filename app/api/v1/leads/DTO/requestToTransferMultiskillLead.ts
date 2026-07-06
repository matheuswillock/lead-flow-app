import { z } from "zod";

export const TransferMultiskillLeadRequestSchema = z.object({
  targetMasterId: z.string().uuid("ID do master destino deve ser um UUID válido"),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido"),
  sdrId: z.string().uuid("ID do SDR deve ser um UUID válido").optional().nullable().default(null),
});

export type TransferMultiskillLeadRequest = z.infer<typeof TransferMultiskillLeadRequestSchema>;

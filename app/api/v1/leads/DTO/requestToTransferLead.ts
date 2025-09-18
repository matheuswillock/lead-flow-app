import { z } from "zod";

export const TransferLeadRequestSchema = z.object({
  newManagerId: z.string({
    message: "ID do novo gestor deve ser uma string"
  }).min(1, "ID do novo gestor não pode estar vazio"),
  
  reason: z.string().optional().nullable().default(null)
});

export type TransferLeadRequest = z.infer<typeof TransferLeadRequestSchema>;

export function validateTransferLeadRequest(data: unknown): TransferLeadRequest {
  return TransferLeadRequestSchema.parse(data);
}
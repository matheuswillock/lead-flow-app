import { z } from "zod";

export const MergeLeadRequestSchema = z.object({
  sourceLeadId: z.string().uuid("ID do lead de origem deve ser um UUID válido"),
});

export type MergeLeadRequest = z.infer<typeof MergeLeadRequestSchema>;

import { z } from "zod"

export const BackofficeLeadQuickEntryRequestSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().trim().email("E-mail inválido").optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  subscribeToLiveCampaign: z.boolean().default(false),
})

export type BackofficeLeadQuickEntryRequest = z.infer<typeof BackofficeLeadQuickEntryRequestSchema>

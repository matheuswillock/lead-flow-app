import { z } from "zod"
import { radarSegmentRulesSchema } from "@/lib/radar/segment-dsl"

export const createTeamRadarSegmentSchema = z.object({
  name: z.string().trim().min(1, "name é obrigatório").max(120, "name deve ter no máximo 120 caracteres"),
  description: z.string().trim().max(500).optional().nullable(),
  rules: radarSegmentRulesSchema,
})

export const updateTeamRadarSegmentSchema = z.object({
  name: z.string().trim().min(1, "name é obrigatório").max(120, "name deve ter no máximo 120 caracteres").optional(),
  description: z.string().trim().max(500).optional().nullable(),
  rules: radarSegmentRulesSchema.optional(),
  isActive: z.boolean().optional(),
})

export const previewCustomSegmentRulesSchema = z
  .object({
    rules: radarSegmentRulesSchema.optional(),
    parentSegmentId: z.string().uuid("parentSegmentId deve ser um UUID válido").optional(),
    campaignId: z.string().uuid("campaignId deve ser um UUID válido").optional(),
  })
  .refine((data) => data.rules || data.parentSegmentId || data.campaignId, {
    message: "Informe rules, parentSegmentId ou campaignId",
  })

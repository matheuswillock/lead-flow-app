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

export const previewCustomSegmentRulesSchema = z.object({
  rules: radarSegmentRulesSchema,
})

import { z } from "zod"
import type { CustomFieldFilterOperator } from "@/lib/leadCustomFields/customFieldQuery"

export const RADAR_SEGMENT_MAX_CONDITIONS = 10

const leadCustomFieldOperatorSchema = z.enum(["eq", "neq", "contains", "is_empty", "not_empty"])
const OPERATORS_REQUIRING_VALUE = new Set<CustomFieldFilterOperator>(["eq", "neq", "contains"])

const profileTextFieldSchema = z.enum(["primaryEmail", "primaryDocument"])
const profileTextOperatorSchema = z.enum(["eq", "neq", "contains", "is_empty", "not_empty"])
const profileDateOperatorSchema = z.enum(["before", "after", "within_days"])

const radarChannelSchema = z.enum(["email", "whatsapp"])
const radarConsentStatusSchema = z.enum(["allowed", "blocked", "unknown"])
const leadStatusSchema = z.enum([
  "new_opportunity",
  "scheduled",
  "no_show",
  "pricingRequest",
  "future_sale",
  "offerNegotiation",
  "pending_documents",
  "offerSubmission",
  "dps_agreement",
  "invoicePayment",
  "disqualified",
  "opportunityLost",
  "contract_finalized",
])

const profileFieldConditionSchema = z
  .object({
    kind: z.literal("profile_field"),
    field: profileTextFieldSchema.or(z.literal("lastSeenAt")),
    operator: profileTextOperatorSchema.or(profileDateOperatorSchema),
    value: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.field === "lastSeenAt") {
      if (!profileDateOperatorSchema.safeParse(data.operator).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Operador inválido para "lastSeenAt": use before, after ou within_days`,
          path: ["operator"],
        })
        return
      }
      if (data.value === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value é obrigatório", path: ["value"] })
        return
      }
      if (data.operator === "within_days") {
        const days = Number(data.value)
        if (!Number.isFinite(days) || days <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "value deve ser um número de dias positivo",
            path: ["value"],
          })
        }
        return
      }
      if (Number.isNaN(Date.parse(String(data.value)))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "value deve ser uma data válida (ISO 8601)",
          path: ["value"],
        })
      }
      return
    }

    if (!profileTextOperatorSchema.safeParse(data.operator).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Operador inválido para "${data.field}": use eq, neq, contains, is_empty ou not_empty`,
        path: ["operator"],
      })
      return
    }
    if (OPERATORS_REQUIRING_VALUE.has(data.operator as CustomFieldFilterOperator) && data.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `O operador "${data.operator}" exige um valor`, path: ["value"] })
    }
  })

const consentConditionSchema = z.object({
  kind: z.literal("consent"),
  channel: radarChannelSchema,
  status: radarConsentStatusSchema,
})

const eventConditionSchema = z.object({
  kind: z.literal("event"),
  eventType: z.string().min(1, "eventType é obrigatório"),
  occurrence: z.enum(["occurred", "not_occurred"]),
  windowDays: z.number().int().positive().optional(),
})

const leadCustomFieldConditionSchema = z
  .object({
    kind: z.literal("lead_custom_field"),
    definitionId: z.string().uuid("definitionId deve ser um UUID válido"),
    operator: leadCustomFieldOperatorSchema,
    value: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (OPERATORS_REQUIRING_VALUE.has(data.operator) && data.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `O operador "${data.operator}" exige um valor`, path: ["value"] })
    }
  })

const leadStatusConditionSchema = z.object({
  kind: z.literal("lead_status"),
  statuses: z.array(leadStatusSchema).min(1, "informe ao menos um status"),
})

export const radarSegmentConditionSchema = z.discriminatedUnion("kind", [
  profileFieldConditionSchema,
  consentConditionSchema,
  eventConditionSchema,
  leadCustomFieldConditionSchema,
  leadStatusConditionSchema,
])

export const radarSegmentRulesSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z
    .array(radarSegmentConditionSchema)
    .min(1, "informe ao menos uma condição")
    .max(RADAR_SEGMENT_MAX_CONDITIONS, `máximo de ${RADAR_SEGMENT_MAX_CONDITIONS} condições por segmento`),
})

export type RadarSegmentCondition = z.infer<typeof radarSegmentConditionSchema>
export type RadarSegmentRules = z.infer<typeof radarSegmentRulesSchema>

export function parseRadarSegmentRules(input: unknown): RadarSegmentRules {
  return radarSegmentRulesSchema.parse(input)
}

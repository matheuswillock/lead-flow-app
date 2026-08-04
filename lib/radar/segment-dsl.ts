import { z } from "zod"
import type { CustomFieldFilterOperator } from "@/lib/leadCustomFields/customFieldQuery"

export const RADAR_SEGMENT_MAX_CONDITIONS = 10

const leadCustomFieldOperatorSchema = z.enum(["eq", "neq", "contains", "is_empty", "not_empty"])
const OPERATORS_REQUIRING_VALUE = new Set<CustomFieldFilterOperator>(["eq", "neq", "contains"])

const profileTextFieldSchema = z.enum(["primaryEmail", "primaryDocument"])
const profileTextOperatorSchema = z.enum(["eq", "neq", "contains", "is_empty", "not_empty"])
const profileDateOperatorSchema = z.enum(["before", "after", "within_days"])

/** Aceita number ou string puramente numérica — rejeita boolean, array, objeto. */
function isValidWithinDaysValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0
  if (typeof value === "string") {
    if (!/^\d+(\.\d+)?$/.test(value.trim())) return false
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0
  }
  return false
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= daysInMonth[month - 1]
}

const ISO_DATE_VALUE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/

/**
 * Valida formato ISO 8601 (data ou data+hora) e o calendário informado —
 * `Date.parse` sozinho aceita entradas soltas como "1" e rola datas
 * inexistentes (ex.: 2026-02-30 vira 2026-03-02) sem erro.
 */
function isValidIsoDateValue(value: unknown): boolean {
  if (typeof value !== "string") return false
  const match = value.trim().match(ISO_DATE_VALUE_RE)
  if (!match) return false

  const [raw, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match
  if (!isValidCalendarDate(Number(yearStr), Number(monthStr), Number(dayStr))) return false

  if (hourStr !== undefined) {
    if (Number(hourStr) > 23 || Number(minuteStr) > 59 || (secondStr !== undefined && Number(secondStr) > 59)) {
      return false
    }
  }

  return !Number.isNaN(Date.parse(raw))
}

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

/** Fonte única para o frontend popular o multi-select de lead_status. */
export const RADAR_SEGMENT_LEAD_STATUSES = leadStatusSchema.options

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
        if (!isValidWithinDaysValue(data.value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "value deve ser um número de dias positivo",
            path: ["value"],
          })
        }
        return
      }
      if (!isValidIsoDateValue(data.value)) {
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

export const LEAD_FIELD_CATALOG = {
  status: { operators: ["eq", "neq"] as const, valueKind: "lead_status_multi" as const },
  currentHealthPlan: { operators: ["eq", "neq", "contains", "is_empty", "not_empty"] as const, valueKind: "text" as const },
  currentValue: { operators: ["eq", "neq", "gt", "gte", "lt", "lte"] as const, valueKind: "number" as const },
  ticket: { operators: ["eq", "neq", "gt", "gte", "lt", "lte"] as const, valueKind: "number" as const },
  meetingDate: { operators: ["before", "after", "within_days", "is_empty", "not_empty"] as const, valueKind: "date" as const },
  followUpAt: { operators: ["before", "after", "within_days", "is_empty", "not_empty"] as const, valueKind: "date" as const },
  contractDueDate: { operators: ["before", "after", "within_days", "is_empty", "not_empty"] as const, valueKind: "date" as const },
  soldPlan: { operators: ["eq", "neq", "contains", "is_empty", "not_empty"] as const, valueKind: "text" as const },
  isReferral: { operators: ["eq"] as const, valueKind: "boolean" as const },
  assignedTo: { operators: ["eq", "neq", "is_empty", "not_empty"] as const, valueKind: "text" as const },
  closerId: { operators: ["eq", "neq", "is_empty", "not_empty"] as const, valueKind: "text" as const },
} as const

type LeadFieldKey = keyof typeof LEAD_FIELD_CATALOG
const LEAD_FIELD_KEYS = Object.keys(LEAD_FIELD_CATALOG) as [LeadFieldKey, ...LeadFieldKey[]]
const LEAD_FIELD_NO_VALUE_OPERATORS = new Set(["is_empty", "not_empty"])

const leadFieldConditionSchema = z
  .object({
    kind: z.literal("lead_field"),
    fieldKey: z.enum(LEAD_FIELD_KEYS),
    operator: z.string().min(1, "operator é obrigatório"),
    value: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    const entry = LEAD_FIELD_CATALOG[data.fieldKey]
    if (!entry.operators.includes(data.operator as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Operador inválido para "${data.fieldKey}": use ${entry.operators.join(", ")}`,
        path: ["operator"],
      })
      return
    }
    if (LEAD_FIELD_NO_VALUE_OPERATORS.has(data.operator)) return
    if (data.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `O operador "${data.operator}" exige um valor`, path: ["value"] })
      return
    }
    if (entry.valueKind === "lead_status_multi") {
      if (!Array.isArray(data.value) || (data.value as unknown[]).length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "informe ao menos um status", path: ["value"] })
        return
      }
      const validStatuses = new Set(leadStatusSchema.options as readonly string[])
      for (const s of data.value as unknown[]) {
        if (!validStatuses.has(s as string)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Status inválido: "${s}"`,
            path: ["value"],
          })
        }
      }
      return
    }
    if (entry.valueKind === "number") {
      const num = typeof data.value === "string" ? (data.value.trim() === "" ? NaN : Number(data.value)) : Number(data.value)
      if (
        data.value === null ||
        data.value === undefined ||
        typeof data.value === "boolean" ||
        Array.isArray(data.value) ||
        !Number.isFinite(num)
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser um número válido", path: ["value"] })
      }
      return
    }
    if (entry.valueKind === "date") {
      if (data.operator === "within_days") {
        if (!isValidWithinDaysValue(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser um número de dias positivo", path: ["value"] })
        }
        return
      }
      if (!isValidIsoDateValue(data.value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser uma data válida (ISO 8601)", path: ["value"] })
      }
      return
    }
    if (entry.valueKind === "boolean") {
      if (data.value !== true && data.value !== false) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser true ou false", path: ["value"] })
      }
      return
    }
    if (typeof data.value !== "string") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser uma string", path: ["value"] })
      return
    }
    const UUID_FIELDS = new Set(["assignedTo", "closerId"] as const)
    if (UUID_FIELDS.has(data.fieldKey as never)) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_REGEX.test(data.value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${data.fieldKey}" requer um UUID válido`, path: ["value"] })
      }
    }
  })



const portfolioStatusSchema = z.enum(["active", "pending", "canceled"])
const renewalStatusSchema = z.enum(["to_renew", "contacted", "proposal", "renewed", "lost"])
const portfolioSourceSchema = z.enum(["crm", "manual", "brokerage_transfer"])
const contractTypeSchema = z.enum(["individual", "corporate", "adhesion"])

/** Fonte única para o frontend popular selects de portfolio_field. */
export const RADAR_SEGMENT_PORTFOLIO_STATUSES = portfolioStatusSchema.options
export const RADAR_SEGMENT_RENEWAL_STATUSES = renewalStatusSchema.options
export const RADAR_SEGMENT_PORTFOLIO_SOURCES = portfolioSourceSchema.options
export const RADAR_SEGMENT_CONTRACT_TYPES = contractTypeSchema.options

/**
 * D13: catálogo fechado de colunas de `LeadPortfolio` (contrato atual) e
 * `LeadFinalized` (histórico). `entity` decide qual repositório consultar.
 */
export const PORTFOLIO_FIELD_CATALOG = {
  portfolioStatus: {
    entity: "portfolio" as const,
    operators: ["eq", "neq"] as const,
    valueKind: "enum" as const,
    enumValues: RADAR_SEGMENT_PORTFOLIO_STATUSES,
  },
  renewalStatus: {
    entity: "portfolio" as const,
    operators: ["eq", "neq"] as const,
    valueKind: "enum" as const,
    enumValues: RADAR_SEGMENT_RENEWAL_STATUSES,
  },
  renewalAmount: {
    entity: "portfolio" as const,
    operators: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "not_empty"] as const,
    valueKind: "number" as const,
  },
  source: {
    entity: "portfolio" as const,
    operators: ["eq", "neq"] as const,
    valueKind: "enum" as const,
    enumValues: RADAR_SEGMENT_PORTFOLIO_SOURCES,
  },
  lastContactAt: {
    entity: "portfolio" as const,
    operators: ["before", "after", "within_days", "is_empty", "not_empty"] as const,
    valueKind: "date" as const,
  },
  finalizedDateAt: {
    entity: "finalized" as const,
    operators: ["before", "after", "within_days"] as const,
    valueKind: "date" as const,
  },
  amount: {
    entity: "finalized" as const,
    operators: ["eq", "neq", "gt", "gte", "lt", "lte"] as const,
    valueKind: "number" as const,
  },
  contractType: {
    entity: "finalized" as const,
    operators: ["eq", "neq"] as const,
    valueKind: "enum" as const,
    enumValues: RADAR_SEGMENT_CONTRACT_TYPES,
  },
  operadora: {
    entity: "finalized" as const,
    operators: ["eq", "neq", "contains", "is_empty", "not_empty"] as const,
    valueKind: "text" as const,
  },
  productName: {
    entity: "finalized" as const,
    operators: ["eq", "neq", "contains", "is_empty", "not_empty"] as const,
    valueKind: "text" as const,
  },
} as const

type PortfolioFieldKey = keyof typeof PORTFOLIO_FIELD_CATALOG
const PORTFOLIO_FIELD_KEYS = Object.keys(PORTFOLIO_FIELD_CATALOG) as [PortfolioFieldKey, ...PortfolioFieldKey[]]
const PORTFOLIO_FIELD_NO_VALUE_OPERATORS = new Set(["is_empty", "not_empty"])

const portfolioFieldConditionSchema = z
  .object({
    kind: z.literal("portfolio_field"),
    fieldKey: z.enum(PORTFOLIO_FIELD_KEYS),
    operator: z.string().min(1, "operator é obrigatório"),
    value: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    const entry = PORTFOLIO_FIELD_CATALOG[data.fieldKey]
    if (!entry.operators.includes(data.operator as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Operador inválido para "${data.fieldKey}": use ${entry.operators.join(", ")}`,
        path: ["operator"],
      })
      return
    }
    if (PORTFOLIO_FIELD_NO_VALUE_OPERATORS.has(data.operator)) return
    if (data.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `O operador "${data.operator}" exige um valor`, path: ["value"] })
      return
    }
    if (entry.valueKind === "enum") {
      if (typeof data.value !== "string" || !(entry.enumValues as readonly string[]).includes(data.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `value inválido para "${data.fieldKey}": use ${entry.enumValues.join(", ")}`,
          path: ["value"],
        })
      }
      return
    }
    if (entry.valueKind === "number") {
      const num = typeof data.value === "string" ? (data.value.trim() === "" ? NaN : Number(data.value)) : Number(data.value)
      if (
        data.value === null ||
        data.value === undefined ||
        typeof data.value === "boolean" ||
        Array.isArray(data.value) ||
        !Number.isFinite(num)
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser um número válido", path: ["value"] })
      }
      return
    }
    if (entry.valueKind === "date") {
      if (data.operator === "within_days") {
        if (!isValidWithinDaysValue(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser um número de dias positivo", path: ["value"] })
        }
        return
      }
      if (!isValidIsoDateValue(data.value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser uma data válida (ISO 8601)", path: ["value"] })
      }
      return
    }
    if (typeof data.value !== "string") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value deve ser uma string", path: ["value"] })
    }
  })

const emailContactListConditionSchema = z.object({
  kind: z.literal("email_contact_list"),
  listIds: z.array(z.string().uuid("listIds deve conter UUIDs válidos")).min(1, "informe ao menos uma lista"),
})

const emailContactFieldConditionSchema = z
  .object({
    kind: z.literal("email_contact_field"),
    fieldKey: z.string().min(1, "fieldKey é obrigatório"),
    operator: leadCustomFieldOperatorSchema,
    value: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (OPERATORS_REQUIRING_VALUE.has(data.operator) && data.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `O operador "${data.operator}" exige um valor`, path: ["value"] })
    }
  })

export const radarSegmentConditionSchema = z.discriminatedUnion("kind", [
  profileFieldConditionSchema,
  consentConditionSchema,
  eventConditionSchema,
  leadCustomFieldConditionSchema,
  leadStatusConditionSchema,
  leadFieldConditionSchema,
  portfolioFieldConditionSchema,
  emailContactListConditionSchema,
  emailContactFieldConditionSchema,
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

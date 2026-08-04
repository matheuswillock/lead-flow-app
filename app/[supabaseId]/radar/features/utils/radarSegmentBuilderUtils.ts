import {
  Mail,
  MessageCircle,
  RefreshCw,
  User,
  CircleDot,
  Flag,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import type { LeadCustomFieldType } from "@prisma/client"
import type { CustomFieldFilterOperator } from "@/lib/leadCustomFields/customFieldQuery"
import type { RadarSegmentCondition, RadarSegmentRules } from "../context/RadarTypes"

export const OPERATORS_BY_PROFILE_FIELD: Record<
  "primaryEmail" | "primaryDocument",
  CustomFieldFilterOperator[]
> = {
  primaryEmail: ["eq", "neq", "contains", "is_empty", "not_empty"],
  primaryDocument: ["eq", "neq", "contains", "is_empty", "not_empty"],
}

export const OPERATORS_BY_LAST_SEEN: Array<"before" | "after" | "within_days"> = [
  "before",
  "after",
  "within_days",
]

/** Espelha app/[supabaseId]/components/leads-filters/LeadsCustomFieldFilter.tsx's OPERATORS_BY_TYPE. */
export const OPERATORS_BY_CUSTOM_FIELD_TYPE: Record<LeadCustomFieldType, CustomFieldFilterOperator[]> = {
  text: ["eq", "neq", "contains", "is_empty", "not_empty"],
  date: ["eq", "neq", "contains", "is_empty", "not_empty"],
  select: ["eq", "neq", "contains", "is_empty", "not_empty"],
  multi_select: ["eq", "neq", "contains", "is_empty", "not_empty"],
  number: ["eq", "neq", "is_empty", "not_empty"],
  boolean: ["eq", "neq", "is_empty", "not_empty"],
}

const OPERATORS_REQUIRING_VALUE = new Set(["eq", "neq", "contains", "before", "after", "within_days", "gt", "gte", "lt", "lte"])

/** false para is_empty/not_empty (e para consent/lead_status, que não têm value livre). */
export function conditionNeedsValueInput(condition: RadarSegmentCondition): boolean {
  if (
    condition.kind === "profile_field" ||
    condition.kind === "lead_custom_field" ||
    condition.kind === "lead_field" ||
    condition.kind === "portfolio_field"
  ) {
    return OPERATORS_REQUIRING_VALUE.has(condition.operator)
  }
  return false
}

/** Espelha lib/radar/segment-dsl.ts's isValidWithinDaysValue — number ou string puramente numérica, sempre positivo. */
function isValidPositiveDaysValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0
  if (typeof value === "string") {
    if (!/^\d+(\.\d+)?$/.test(value.trim())) return false
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0
  }
  return false
}

function isConditionCompleteForSave(condition: RadarSegmentCondition): boolean {
  switch (condition.kind) {
    case "profile_field":
      if (!conditionNeedsValueInput(condition)) return true
      if (condition.field === "lastSeenAt" && condition.operator === "within_days") {
        return isValidPositiveDaysValue(condition.value)
      }
      return condition.value !== undefined
    case "consent":
      return Boolean(condition.channel && condition.status)
    case "event":
      if (condition.eventType.trim().length === 0) return false
      // windowDays é opcional — servidor exige inteiro positivo quando informado (z.number().int().positive()).
      if (condition.windowDays !== undefined) {
        return Number.isInteger(condition.windowDays) && condition.windowDays > 0
      }
      return true
    case "lead_custom_field":
      return Boolean(condition.definitionId) && (!conditionNeedsValueInput(condition) || condition.value !== undefined)
    case "lead_status":
      return condition.statuses.length > 0
    case "lead_field": {
      if (!condition.fieldKey) return false
      if (!conditionNeedsValueInput(condition)) return true
      if (condition.value === undefined) return false
      if (condition.operator === "within_days") return isValidPositiveDaysValue(condition.value)
      if (condition.fieldKey === "status") return Array.isArray(condition.value) && (condition.value as unknown[]).length > 0
      if (condition.fieldKey === "isReferral") return condition.value === true || condition.value === false
      if (condition.fieldKey === "currentValue" || condition.fieldKey === "ticket") {
        return !Number.isNaN(Number(condition.value))
      }
      return typeof condition.value === "string" && condition.value.length > 0
    }
    case "portfolio_field": {
      if (!condition.fieldKey) return false
      if (!conditionNeedsValueInput(condition)) return true
      if (condition.value === undefined) return false
      if (condition.operator === "within_days") return isValidPositiveDaysValue(condition.value)
      if (condition.fieldKey === "renewalAmount" || condition.fieldKey === "amount") {
        return !Number.isNaN(Number(condition.value))
      }
      return typeof condition.value === "string" && condition.value.length > 0
    }
  }
}

/** Checagem estrutural pura — espelha os limites de lib/radar/segment-dsl.ts sem depender do Zod server-side. */
export function isRulesValidForSave(rules: RadarSegmentRules): boolean {
  if (rules.conditions.length < 1 || rules.conditions.length > 10) return false
  return rules.conditions.every(isConditionCompleteForSave)
}

const MILESTONE_EVENT_TYPES = ["portfolio.renewed", "portfolio.brokerage_transfer"]

/** Marcos de timeline (D5): status de LeadStatus, carteira e "primeiro contato". */
export function isMilestoneEventType(eventType: string): boolean {
  return (
    eventType.startsWith("lead.milestone.") ||
    eventType === "profile.first_contact" ||
    MILESTONE_EVENT_TYPES.includes(eventType)
  )
}

/** Ícone da timeline por prefixo de eventType (ex.: "email.opened", "whatsapp.message_received"). */
export function getEventTypeIcon(eventType: string): LucideIcon {
  if (eventType === "profile.first_contact") return Sparkles
  if (eventType.startsWith("lead.milestone.") || MILESTONE_EVENT_TYPES.includes(eventType)) return Flag
  if (eventType.startsWith("email.")) return Mail
  if (eventType.startsWith("whatsapp.")) return MessageCircle
  if (eventType.startsWith("portfolio.")) return RefreshCw
  if (eventType.startsWith("lead.") || eventType.startsWith("crm_lead")) return User
  return CircleDot
}

const CHANNEL_LABEL_MAP: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  form: "Formulário",
  pixel: "Pixel",
  lead: "CRM",
  portfolio: "CRM",
  profile: "CRM",
}

/** D9: mapeia um prefixo de `eventType` para o rótulo de canal exibido na aba Contatos. */
export function eventTypePrefixToChannel(eventType: string): string {
  const prefix = eventType.split(".")[0] ?? eventType
  return CHANNEL_LABEL_MAP[prefix] ?? "Outros"
}

function toQueryString(params: URLSearchParams): string {
  const value = params.toString()
  return value ? `?${value}` : ""
}

/** Omite o param quando o valor é o default ("perfis"), mantendo a URL limpa. */
export function buildTabHref(
  pathname: string,
  currentParams: URLSearchParams,
  tab: "perfis" | "segmentos"
): string {
  const next = new URLSearchParams(currentParams.toString())
  if (tab === "perfis") {
    next.delete("tab")
  } else {
    next.set("tab", tab)
  }
  return `${pathname}${toQueryString(next)}`
}

/** `profileId: null` remove o param (fechar o Sheet limpa a URL). */
export function buildProfileHref(
  pathname: string,
  currentParams: URLSearchParams,
  profileId: string | null
): string {
  const next = new URLSearchParams(currentParams.toString())
  if (profileId) {
    next.set("perfil", profileId)
  } else {
    next.delete("perfil")
  }
  return `${pathname}${toQueryString(next)}`
}

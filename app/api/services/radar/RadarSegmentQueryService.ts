import { subDays } from "date-fns"
import type { Prisma } from "@prisma/client"
import { radarRepository, type RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { LEAD_FIELD_CATALOG, type RadarSegmentCondition, type RadarSegmentRules } from "@/lib/radar/segment-dsl"
import { buildCustomFieldWhereFilter } from "@/lib/leadCustomFields/customFieldQuery"
import { normalizeRadarDocument, normalizeRadarEmail } from "@/lib/radar/normalization"

const PROFILE_TEXT_FIELD_TO_COLUMN = {
  primaryEmail: "normalizedPrimaryEmail",
  primaryDocument: "normalizedPrimaryDocument",
} as const

function normalizeProfileTextValue(field: "primaryEmail" | "primaryDocument", value: unknown): string {
  const raw = String(value ?? "")
  return field === "primaryEmail" ? normalizeRadarEmail(raw) : normalizeRadarDocument(raw)
}

function translateProfileTextField(
  field: "primaryEmail" | "primaryDocument",
  operator: string,
  value: unknown
): Prisma.RadarProfileWhereInput {
  const column = PROFILE_TEXT_FIELD_TO_COLUMN[field]

  if (operator === "is_empty") {
    return { OR: [{ [column]: null }, { [column]: "" }] }
  }
  if (operator === "not_empty") {
    return { AND: [{ [column]: { not: null } }, { [column]: { not: "" } }] }
  }

  const normalizedValue = normalizeProfileTextValue(field, value)

  if (operator === "contains") {
    return { [column]: { contains: normalizedValue, mode: "insensitive" } }
  }
  if (operator === "neq") {
    return { NOT: { [column]: normalizedValue } }
  }
  // eq
  return { [column]: normalizedValue }
}

function translateProfileLastSeenAt(operator: string, value: unknown): Prisma.RadarProfileWhereInput {
  if (operator === "within_days") {
    const days = Number(value)
    return { lastSeenAt: { gte: subDays(new Date(), days) } }
  }
  const date = new Date(String(value))
  if (operator === "before") return { lastSeenAt: { lt: date } }
  // after
  return { lastSeenAt: { gt: date } }
}

function translateProfileField(
  condition: Extract<RadarSegmentCondition, { kind: "profile_field" }>
): Prisma.RadarProfileWhereInput {
  if (condition.field === "lastSeenAt") {
    return translateProfileLastSeenAt(condition.operator, condition.value)
  }
  return translateProfileTextField(condition.field, condition.operator, condition.value)
}

function translateConsent(
  condition: Extract<RadarSegmentCondition, { kind: "consent" }>
): Prisma.RadarProfileWhereInput {
  return { consents: { some: { channel: condition.channel, status: condition.status } } }
}

function translateEvent(
  condition: Extract<RadarSegmentCondition, { kind: "event" }>
): Prisma.RadarProfileWhereInput {
  const occurredAtFilter = condition.windowDays
    ? { occurredAt: { gte: subDays(new Date(), condition.windowDays) } }
    : {}

  if (condition.occurrence === "occurred") {
    return { events: { some: { eventType: condition.eventType, ...occurredAtFilter } } }
  }
  return { events: { none: { eventType: condition.eventType, ...occurredAtFilter } } }
}

async function translateLeadCustomField(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "lead_custom_field" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const leadIds = await radarRepository.findLeadIdsByWhere({
    teamId,
    ...buildCustomFieldWhereFilter({
      definitionId: condition.definitionId,
      operator: condition.operator,
      value: condition.value,
    }),
  })
  return { identities: { some: { type: "lead_id", normalizedValue: { in: leadIds } } } }
}

async function translateLeadStatus(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "lead_status" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const leadIds = await radarRepository.findLeadIdsByWhere({ teamId, status: { in: condition.statuses } })
  return { identities: { some: { type: "lead_id", normalizedValue: { in: leadIds } } } }
}

function buildLeadFieldWhere(
  condition: Extract<RadarSegmentCondition, { kind: "lead_field" }>
): Prisma.LeadWhereInput {
  const { fieldKey, operator, value } = condition
  const entry = LEAD_FIELD_CATALOG[fieldKey]

  if (operator === "is_empty") return { [fieldKey]: null } as Prisma.LeadWhereInput
  if (operator === "not_empty") return { [fieldKey]: { not: null } } as Prisma.LeadWhereInput

  if (entry.valueKind === "lead_status_multi") {
    const statuses = (Array.isArray(value) ? value : [value]) as string[]
    if (operator === "neq") return { status: { notIn: statuses as never[] } }
    return { status: { in: statuses as never[] } }
  }

  if (entry.valueKind === "number") {
    const num = Number(value)
    if (operator === "gt") return { [fieldKey]: { gt: num } } as Prisma.LeadWhereInput
    if (operator === "gte") return { [fieldKey]: { gte: num } } as Prisma.LeadWhereInput
    if (operator === "lt") return { [fieldKey]: { lt: num } } as Prisma.LeadWhereInput
    if (operator === "lte") return { [fieldKey]: { lte: num } } as Prisma.LeadWhereInput
    if (operator === "neq") return { [fieldKey]: { not: num } } as Prisma.LeadWhereInput
    return { [fieldKey]: { equals: num } } as Prisma.LeadWhereInput
  }

  if (entry.valueKind === "date") {
    if (operator === "within_days") {
      const now = new Date()
      return { [fieldKey]: { gte: subDays(now, Number(value)), lte: now } } as Prisma.LeadWhereInput
    }
    const date = new Date(String(value))
    if (operator === "before") return { [fieldKey]: { lt: date } } as Prisma.LeadWhereInput
    return { [fieldKey]: { gt: date } } as Prisma.LeadWhereInput
  }

  if (entry.valueKind === "boolean") {
    return { [fieldKey]: value === true || value === "true" } as Prisma.LeadWhereInput
  }

  // text: eq, neq, contains
  const str = String(value ?? "")
  if (operator === "contains") return { [fieldKey]: { contains: str, mode: "insensitive" } } as Prisma.LeadWhereInput
  if (operator === "neq") return { [fieldKey]: { not: str } } as Prisma.LeadWhereInput
  return { [fieldKey]: str } as Prisma.LeadWhereInput
}

async function translateLeadField(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "lead_field" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const leadIds = await radarRepository.findLeadIdsByWhere({ teamId, ...buildLeadFieldWhere(condition) })
  return { identities: { some: { type: "lead_id", normalizedValue: { in: leadIds } } } }
}

async function translateEmailContactList(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "email_contact_list" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const contactIds = await radarRepository.findEmailContactIdsByListIds(teamId, condition.listIds)
  return { identities: { some: { type: "email_contact_id", normalizedValue: { in: contactIds } } } }
}

async function translateEmailContactField(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "email_contact_field" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const contactIds = await radarRepository.findEmailContactIdsByCustomField(
    teamId,
    condition.fieldKey,
    condition.operator,
    condition.value
  )
  return { identities: { some: { type: "email_contact_id", normalizedValue: { in: contactIds } } } }
}

async function translateCondition(
  teamId: string,
  condition: RadarSegmentCondition
): Promise<Prisma.RadarProfileWhereInput> {
  switch (condition.kind) {
    case "profile_field":
      return translateProfileField(condition)
    case "consent":
      return translateConsent(condition)
    case "event":
      return translateEvent(condition)
    case "lead_custom_field":
      return translateLeadCustomField(teamId, condition)
    case "lead_status":
      return translateLeadStatus(teamId, condition)
    case "lead_field":
      return translateLeadField(teamId, condition)
    case "email_contact_list":
      return translateEmailContactList(teamId, condition)
    case "email_contact_field":
      return translateEmailContactField(teamId, condition)
  }
}

async function buildProfileWhere(teamId: string, rules: RadarSegmentRules): Promise<Prisma.RadarProfileWhereInput> {
  const fragments = await Promise.all(rules.conditions.map((condition) => translateCondition(teamId, condition)))
  return {
    teamId,
    ...(rules.match === "all" ? { AND: fragments } : { OR: fragments }),
  }
}

export interface IRadarSegmentQueryService {
  countProfiles(scope: RadarTeamScope, rules: RadarSegmentRules): Promise<number>
  listProfileIds(
    scope: RadarTeamScope,
    rules: RadarSegmentRules,
    pagination?: { skip: number; take: number }
  ): Promise<string[]>
}

/**
 * C6 EXPLAIN (50k RadarProfile rows / 16 teams, realistic multi-tenant scale): the
 * outer `teamId` filter on RadarProfile correctly uses a Bitmap Index Scan (not a
 * seq scan) via one of the existing `@@index([teamId, ...])` composites — no seq
 * scan on the team-scoped profile set at this table size. The `consent`/`event`
 * `some()` relation filters correlate by `profileId` (not re-scoped by `teamId`
 * inside the child table), so they seq-scan the consents/events tables directly;
 * since those tables are naturally bounded by profile count per team, this stays
 * cheap in practice and no additional index is proven necessary today.
 */
class RadarSegmentQueryService implements IRadarSegmentQueryService {
  async countProfiles(scope: RadarTeamScope, rules: RadarSegmentRules): Promise<number> {
    const where = await buildProfileWhere(scope.teamId, rules)
    return radarRepository.countProfilesByWhere(where)
  }

  async listProfileIds(
    scope: RadarTeamScope,
    rules: RadarSegmentRules,
    pagination?: { skip: number; take: number }
  ): Promise<string[]> {
    const where = await buildProfileWhere(scope.teamId, rules)
    return radarRepository.listProfileIdsByWhere(where, pagination)
  }
}

export const radarSegmentQueryService = new RadarSegmentQueryService()

import { subDays } from "date-fns"
import type { Prisma } from "@prisma/client"
import { radarRepository, type RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  LEAD_FIELD_CATALOG,
  PORTFOLIO_FIELD_CATALOG,
  type RadarSegmentCondition,
  type RadarSegmentRules,
} from "@/lib/radar/segment-dsl"
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

function translateProfileGenderField(operator: string, value: unknown): Prisma.RadarProfileWhereInput {
  if (operator === "is_empty") {
    return { gender: null }
  }
  if (operator === "not_empty") {
    return { gender: { not: null } }
  }

  const genderValue = String(value ?? "")
  if (operator === "neq") {
    return { NOT: { gender: genderValue } }
  }
  return { gender: genderValue }
}

/** Exposto para testes unitários (F3 — coluna física `gender`). */
export function translateProfileField(
  condition: Extract<RadarSegmentCondition, { kind: "profile_field" }>
): Prisma.RadarProfileWhereInput {
  if (condition.field === "gender") {
    return translateProfileGenderField(condition.operator, condition.value)
  }
  if (condition.field === "lastSeenAt") {
    return translateProfileLastSeenAt(condition.operator, condition.value)
  }
  return translateProfileTextField(condition.field, condition.operator, condition.value)
}

function translateProfileFieldInternal(
  condition: Extract<RadarSegmentCondition, { kind: "profile_field" }>
): Prisma.RadarProfileWhereInput {
  return translateProfileField(condition)
}

function translateConsent(
  condition: Extract<RadarSegmentCondition, { kind: "consent" }>
): Prisma.RadarProfileWhereInput {
  return { consents: { some: { channel: condition.channel, status: condition.status } } }
}

/** Exposto para testes unitários do filtro opcional `metadata.campaignId`. */
export function translateEvent(
  condition: Extract<RadarSegmentCondition, { kind: "event" }>
): Prisma.RadarProfileWhereInput {
  const occurredAtFilter = condition.windowDays
    ? { occurredAt: { gte: subDays(new Date(), condition.windowDays) } }
    : {}

  const campaignFilter = condition.campaignId
    ? {
        OR: [
          { metadata: { path: ["campaignId"], equals: condition.campaignId } },
          { metadata: { path: ["origin", "campaignId"], equals: condition.campaignId } },
        ],
      }
    : {}

  const eventFilter = {
    eventType: condition.eventType,
    ...occurredAtFilter,
    ...campaignFilter,
  }

  if (condition.occurrence === "occurred") {
    return { events: { some: eventFilter } }
  }
  return { events: { none: eventFilter } }
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


function buildPortfolioFieldWhere(
  condition: Extract<RadarSegmentCondition, { kind: "portfolio_field" }>
): Prisma.LeadPortfolioWhereInput | Prisma.LeadFinalizedWhereInput {
  const { fieldKey, operator, value } = condition
  const entry = PORTFOLIO_FIELD_CATALOG[fieldKey]

  if (operator === "is_empty") return { [fieldKey]: null }
  if (operator === "not_empty") return { [fieldKey]: { not: null } }

  if (entry.valueKind === "enum") {
    const enumValue = String(value)
    if (operator === "neq") return { [fieldKey]: { not: enumValue } }
    return { [fieldKey]: enumValue }
  }

  if (entry.valueKind === "number") {
    const num = Number(value)
    if (operator === "gt") return { [fieldKey]: { gt: num } }
    if (operator === "gte") return { [fieldKey]: { gte: num } }
    if (operator === "lt") return { [fieldKey]: { lt: num } }
    if (operator === "lte") return { [fieldKey]: { lte: num } }
    if (operator === "neq") return { [fieldKey]: { not: num } }
    return { [fieldKey]: { equals: num } }
  }

  if (entry.valueKind === "date") {
    if (operator === "within_days") {
      const now = new Date()
      return { [fieldKey]: { gte: subDays(now, Number(value)), lte: now } }
    }
    const date = new Date(String(value))
    if (operator === "before") return { [fieldKey]: { lt: date } }
    return { [fieldKey]: { gt: date } }
  }

  const str = String(value ?? "")
  if (operator === "contains") return { [fieldKey]: { contains: str, mode: "insensitive" } }
  if (operator === "neq") return { [fieldKey]: { not: str } }
  return { [fieldKey]: str }
}

/**
 * D13: resolve donos do contrato (portfolio ou finalized) e projeta nos
 * perfis via `lead_id` — e, para carteira, também via `portfolio_id`
 * (clientes criados só na carteira antes do sync de lead_id).
 */
async function translatePortfolioField(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "portfolio_field" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const entry = PORTFOLIO_FIELD_CATALOG[condition.fieldKey]
  const fieldWhere = buildPortfolioFieldWhere(condition)

  if (entry.entity === "portfolio") {
    const { leadIds, portfolioIds } = await radarRepository.findPortfolioProfileIdsByWhere({
      teamId,
      ...(fieldWhere as Prisma.LeadPortfolioWhereInput),
    })
    const identityOr: Prisma.RadarIdentityWhereInput[] = []
    if (leadIds.length > 0) {
      identityOr.push({ type: "lead_id", normalizedValue: { in: leadIds } })
    }
    if (portfolioIds.length > 0) {
      identityOr.push({ type: "portfolio_id", normalizedValue: { in: portfolioIds } })
    }
    if (identityOr.length === 0) {
      return { id: { in: [] } }
    }
    return { identities: { some: { OR: identityOr } } }
  }

  const leadIds = await radarRepository.findFinalizedProfileIdsByWhere({
    lead: { teamId },
    ...(fieldWhere as Prisma.LeadFinalizedWhereInput),
  })
  return { identities: { some: { type: "lead_id", normalizedValue: { in: leadIds } } } }
}

async function translateEmailContactList(
  teamId: string,
  condition: Extract<RadarSegmentCondition, { kind: "email_contact_list" }>
): Promise<Prisma.RadarProfileWhereInput> {
  const profileIds = await radarRepository.findProfileIdsByEmailContactListIds(
    teamId,
    condition.listIds
  )
  return profileIdInFilter(profileIds)
}

/**
 * Evita P2035 (limite ~32767 binds) ao filtrar por muitos profileIds.
 * Contagens só com `email_contact_list` usam SQL dedicado (sem este filtro).
 */
const PROFILE_ID_IN_CHUNK = 5_000

function profileIdInFilter(profileIds: string[]): Prisma.RadarProfileWhereInput {
  if (profileIds.length === 0) {
    // Prisma `in: []` não casa nada — equivalente a false.
    return { id: { in: [] } }
  }
  if (profileIds.length <= PROFILE_ID_IN_CHUNK) {
    return { id: { in: profileIds } }
  }
  const chunks: string[][] = []
  for (let i = 0; i < profileIds.length; i += PROFILE_ID_IN_CHUNK) {
    chunks.push(profileIds.slice(i, i + PROFILE_ID_IN_CHUNK))
  }
  // Se a soma dos chunks passar ~32k binds, preferir regras sole `email_contact_list`
  // (caminho SQL em countProfiles/listProfileIds) ou reduzir o conjunto a montante.
  return { OR: chunks.map((ids) => ({ id: { in: ids } })) }
}

/** Segmento só com `email_contact_list` (união) — usa SQL sem materializar IDs no Prisma. */
function trySoleEmailContactListIds(rules: RadarSegmentRules): string[] | null {
  if (rules.conditions.length === 0) return null
  if (!rules.conditions.every((condition) => condition.kind === "email_contact_list")) {
    return null
  }
  // `match: all` com várias listas exige interseção — cai no caminho Prisma composto.
  if (rules.match === "all" && rules.conditions.length > 1) return null
  return [
    ...new Set(
      rules.conditions.flatMap((condition) =>
        condition.kind === "email_contact_list" ? condition.listIds : []
      )
    ),
  ]
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
  return emailContactIdIdentityFilter(contactIds)
}

function emailContactIdIdentityFilter(contactIds: string[]): Prisma.RadarProfileWhereInput {
  if (contactIds.length === 0) return { id: { in: [] } }
  if (contactIds.length <= PROFILE_ID_IN_CHUNK) {
    return {
      identities: {
        some: { type: "email_contact_id", normalizedValue: { in: contactIds } },
      },
    }
  }
  const chunks: string[][] = []
  for (let i = 0; i < contactIds.length; i += PROFILE_ID_IN_CHUNK) {
    chunks.push(contactIds.slice(i, i + PROFILE_ID_IN_CHUNK))
  }
  return {
    OR: chunks.map((ids) => ({
      identities: {
        some: { type: "email_contact_id", normalizedValue: { in: ids } },
      },
    })),
  }
}

/** Exposto para testes — `in` exclui naturalmente `engagementBand` null. */
export function translateEngagementBand(
  condition: Extract<RadarSegmentCondition, { kind: "engagement_band" }>
): Prisma.RadarProfileWhereInput {
  return { engagementBand: { in: condition.bands } }
}

async function translateCondition(
  teamId: string,
  condition: RadarSegmentCondition
): Promise<Prisma.RadarProfileWhereInput> {
  switch (condition.kind) {
    case "profile_field":
      return translateProfileFieldInternal(condition)
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
    case "portfolio_field":
      return translatePortfolioField(teamId, condition)
    case "email_contact_list":
      return translateEmailContactList(teamId, condition)
    case "email_contact_field":
      return translateEmailContactField(teamId, condition)
    case "engagement_band":
      return translateEngagementBand(condition)
    default: {
      const _exhaustive: never = condition
      throw new Error(`Unhandled radar segment condition: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

async function buildProfileWhere(teamId: string, rules: RadarSegmentRules): Promise<Prisma.RadarProfileWhereInput> {
  const fragments = await Promise.all(rules.conditions.map((condition) => translateCondition(teamId, condition)))
  return {
    teamId,
    ...(rules.match === "all" ? { AND: fragments } : { OR: fragments }),
  }
}

/** Exposto para testes — garante escopo multi-tenant via `teamId` no where Prisma. */
export async function buildRadarSegmentProfileWhere(
  teamId: string,
  rules: RadarSegmentRules
): Promise<Prisma.RadarProfileWhereInput> {
  return buildProfileWhere(teamId, rules)
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
    const soleListIds = trySoleEmailContactListIds(rules)
    if (soleListIds) {
      return radarRepository.countProfilesByEmailContactListIds(scope.teamId, soleListIds)
    }
    const where = await buildProfileWhere(scope.teamId, rules)
    return radarRepository.countProfilesByWhere(where)
  }

  async listProfileIds(
    scope: RadarTeamScope,
    rules: RadarSegmentRules,
    pagination?: { skip: number; take: number }
  ): Promise<string[]> {
    const soleListIds = trySoleEmailContactListIds(rules)
    if (soleListIds) {
      return radarRepository.listProfileIdsByEmailContactListIds(
        scope.teamId,
        soleListIds,
        pagination
      )
    }
    const where = await buildProfileWhere(scope.teamId, rules)
    return radarRepository.listProfileIdsByWhere(where, pagination)
  }
}

export const radarSegmentQueryService = new RadarSegmentQueryService()

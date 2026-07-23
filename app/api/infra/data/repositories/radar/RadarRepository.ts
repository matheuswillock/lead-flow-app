import type {
  RadarChannel,
  RadarConsentReason,
  RadarConsentStatus,
  RadarIdentityType,
  RadarSourceType,
  LeadStatus,
  Prisma,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"

export type RadarTeamScope = {
  teamId: string
  ctx: TeamContext
}

export type UpsertProfileInput = {
  teamId: string
  displayName: string
  normalizedName: string
  displayPhone: string
  normalizedPhone: string
  primaryEmail?: string | null
  normalizedPrimaryEmail?: string | null
  primaryDocument?: string | null
  normalizedPrimaryDocument?: string | null
  lastSeenAt?: Date
}

export type UpsertIdentityInput = {
  profileId: string
  teamId: string
  type: RadarIdentityType
  value?: string | null
  normalizedValue: string
  source: string
  isPrimary?: boolean
}

export type UpsertSourceLinkInput = {
  profileId: string
  teamId: string
  sourceType: RadarSourceType
  sourceId: string
  sourceMetadata?: Prisma.InputJsonValue
}

export type AppendEventInput = {
  profileId: string
  teamId: string
  eventType: string
  sourceType: string
  sourceId?: string | null
  occurredAt: Date
  metadata?: Prisma.InputJsonValue
}

export type UpsertConsentInput = {
  profileId: string
  teamId: string
  channel: RadarChannel
  status: RadarConsentStatus
  reason?: RadarConsentReason | null
  sourceType?: string | null
  sourceId?: string | null
}

const profileListSelect = {
  id: true,
  teamId: true,
  displayName: true,
  displayPhone: true,
  primaryEmail: true,
  normalizedPrimaryEmail: true,
  primaryDocument: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export class RadarRepository {
  async upsertProfile(input: UpsertProfileInput) {
    const existing = await prisma.radarProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: {
          teamId: input.teamId,
          normalizedPhone: input.normalizedPhone,
          normalizedName: input.normalizedName,
        },
      },
      select: {
        id: true,
        primaryEmail: true,
        normalizedPrimaryEmail: true,
        primaryDocument: true,
        normalizedPrimaryDocument: true,
      },
    })

    return prisma.radarProfile.upsert({
      where: {
        teamId_normalizedPhone_normalizedName: {
          teamId: input.teamId,
          normalizedPhone: input.normalizedPhone,
          normalizedName: input.normalizedName,
        },
      },
      create: {
        teamId: input.teamId,
        displayName: input.displayName,
        normalizedName: input.normalizedName,
        displayPhone: input.displayPhone,
        normalizedPhone: input.normalizedPhone,
        primaryEmail: input.primaryEmail ?? null,
        normalizedPrimaryEmail: input.normalizedPrimaryEmail ?? null,
        primaryDocument: input.primaryDocument ?? null,
        normalizedPrimaryDocument: input.normalizedPrimaryDocument ?? null,
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
      update: {
        displayName: input.displayName || undefined,
        displayPhone: input.displayPhone || undefined,
        primaryEmail: input.primaryEmail ?? existing?.primaryEmail ?? undefined,
        normalizedPrimaryEmail:
          input.normalizedPrimaryEmail ?? existing?.normalizedPrimaryEmail ?? undefined,
        primaryDocument: input.primaryDocument ?? existing?.primaryDocument ?? undefined,
        normalizedPrimaryDocument:
          input.normalizedPrimaryDocument ?? existing?.normalizedPrimaryDocument ?? undefined,
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
    })
  }

  /**
   * Lookup por identidade — usado para resolver o dono de uma identidade
   * (ex.: email) através da chave única `[teamId, type, normalizedValue]`
   * em vez de campos não-únicos do perfil (ver `findProfileByEmail`, que
   * pode ser ambíguo quando dois perfis compartilham o mesmo e-mail).
   */
  async findProfileByIdentity(teamId: string, type: RadarIdentityType, normalizedValue: string) {
    return prisma.radarIdentity.findUnique({
      where: {
        teamId_type_normalizedValue: { teamId, type, normalizedValue },
      },
      select: { profileId: true },
    })
  }

  /**
   * Resolve (ou cria) o perfil dono de um telefone de forma atômica — lock
   * advisory por (teamId, phone) fecha a corrida em que duas syncs
   * concorrentes (ex.: CRM + WhatsApp) para o mesmo telefone com nomes
   * diferentes veem "sem identidade" ao mesmo tempo, cada uma cria um
   * perfil via a chave natural `[teamId, normalizedPhone, normalizedName]`
   * (que diverge por nome), e a identidade phone acaba migrando
   * silenciosamente entre eles no upsert seguinte. A identidade phone é
   * reivindicada dentro da MESMA transação que resolve/cria o perfil (D8).
   * Quando o perfil já existe (dono da identidade), displayName/
   * normalizedName NÃO são sobrescritos — o perfil mantém seu nome
   * original mesmo que a fonte atual traga um nome diferente.
   */
  async resolveProfileForPhone(input: {
    teamId: string
    normalizedPhone: string
    normalizedName: string
    displayName: string
    displayPhone: string
    phoneValue: string | null
    phoneSource: string
    primaryEmail?: string | null
    normalizedPrimaryEmail?: string | null
    primaryDocument?: string | null
    normalizedPrimaryDocument?: string | null
    lastSeenAt?: Date
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.teamId} || ':' || ${input.normalizedPhone}))`

      const existingByIdentity = await tx.radarIdentity.findUnique({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: "phone",
            normalizedValue: input.normalizedPhone,
          },
        },
        select: { profileId: true },
      })

      if (existingByIdentity) {
        const existingProfile = await tx.radarProfile.findUnique({
          where: { id: existingByIdentity.profileId },
          select: {
            primaryEmail: true,
            normalizedPrimaryEmail: true,
            primaryDocument: true,
            normalizedPrimaryDocument: true,
          },
        })

        const profile = await tx.radarProfile.update({
          where: { id: existingByIdentity.profileId },
          data: {
            displayPhone: input.displayPhone || undefined,
            primaryEmail: input.primaryEmail ?? existingProfile?.primaryEmail ?? undefined,
            normalizedPrimaryEmail:
              input.normalizedPrimaryEmail ?? existingProfile?.normalizedPrimaryEmail ?? undefined,
            primaryDocument: input.primaryDocument ?? existingProfile?.primaryDocument ?? undefined,
            normalizedPrimaryDocument:
              input.normalizedPrimaryDocument ?? existingProfile?.normalizedPrimaryDocument ?? undefined,
            lastSeenAt: input.lastSeenAt ?? new Date(),
          },
        })

        return { profile, wasExisting: true }
      }

      const existingByKey = await tx.radarProfile.findUnique({
        where: {
          teamId_normalizedPhone_normalizedName: {
            teamId: input.teamId,
            normalizedPhone: input.normalizedPhone,
            normalizedName: input.normalizedName,
          },
        },
        select: { id: true },
      })

      const profile = await tx.radarProfile.upsert({
        where: {
          teamId_normalizedPhone_normalizedName: {
            teamId: input.teamId,
            normalizedPhone: input.normalizedPhone,
            normalizedName: input.normalizedName,
          },
        },
        create: {
          teamId: input.teamId,
          displayName: input.displayName,
          normalizedName: input.normalizedName,
          displayPhone: input.displayPhone,
          normalizedPhone: input.normalizedPhone,
          primaryEmail: input.primaryEmail ?? null,
          normalizedPrimaryEmail: input.normalizedPrimaryEmail ?? null,
          primaryDocument: input.primaryDocument ?? null,
          normalizedPrimaryDocument: input.normalizedPrimaryDocument ?? null,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
        update: {
          displayName: input.displayName || undefined,
          displayPhone: input.displayPhone || undefined,
          primaryEmail: input.primaryEmail ?? undefined,
          normalizedPrimaryEmail: input.normalizedPrimaryEmail ?? undefined,
          primaryDocument: input.primaryDocument ?? undefined,
          normalizedPrimaryDocument: input.normalizedPrimaryDocument ?? undefined,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
      })

      await tx.radarIdentity.upsert({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: "phone",
            normalizedValue: input.normalizedPhone,
          },
        },
        create: {
          profileId: profile.id,
          teamId: input.teamId,
          type: "phone",
          value: input.phoneValue,
          normalizedValue: input.normalizedPhone,
          source: input.phoneSource,
          isPrimary: true,
        },
        update: {
          profileId: profile.id,
          value: input.phoneValue ?? undefined,
          source: input.phoneSource,
          isPrimary: true,
        },
      })

      return { profile, wasExisting: Boolean(existingByKey) }
    })
  }

  async upsertIdentity(input: UpsertIdentityInput) {
    return prisma.radarIdentity.upsert({
      where: {
        teamId_type_normalizedValue: {
          teamId: input.teamId,
          type: input.type,
          normalizedValue: input.normalizedValue,
        },
      },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        type: input.type,
        value: input.value ?? null,
        normalizedValue: input.normalizedValue,
        source: input.source,
        isPrimary: input.isPrimary ?? false,
      },
      update: {
        profileId: input.profileId,
        value: input.value ?? undefined,
        source: input.source,
        isPrimary: input.isPrimary ?? undefined,
      },
    })
  }

  async upsertSourceLink(input: UpsertSourceLinkInput) {
    return prisma.radarSourceLink.upsert({
      where: {
        teamId_sourceType_sourceId: {
          teamId: input.teamId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceMetadata: input.sourceMetadata,
        firstLinkedAt: new Date(),
        lastSyncedAt: new Date(),
      },
      update: {
        profileId: input.profileId,
        sourceMetadata: input.sourceMetadata,
        lastSyncedAt: new Date(),
      },
    })
  }

  async hasDuplicateEvent(
    teamId: string,
    sourceType: string,
    sourceId: string | null | undefined,
    eventType: string,
    occurredAt: Date
  ) {
    if (!sourceId) return false
    const duplicate = await prisma.radarEvent.findFirst({
      where: { teamId, sourceType, sourceId, eventType, occurredAt },
      select: { id: true },
    })
    return Boolean(duplicate)
  }

  async appendEventIfNew(input: AppendEventInput) {
    if (
      input.sourceId &&
      (await this.hasDuplicateEvent(
        input.teamId,
        input.sourceType,
        input.sourceId,
        input.eventType,
        input.occurredAt
      ))
    ) {
      return null
    }

    try {
      return await prisma.radarEvent.create({
        data: {
          profileId: input.profileId,
          teamId: input.teamId,
          eventType: input.eventType,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          occurredAt: input.occurredAt,
          metadata: input.metadata,
        },
      })
    } catch {
      return null
    }
  }

  async upsertConsent(input: UpsertConsentInput) {
    return prisma.radarChannelConsent.upsert({
      where: {
        profileId_channel: {
          profileId: input.profileId,
          channel: input.channel,
        },
      },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        channel: input.channel,
        status: input.status,
        reason: input.reason ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      },
      update: {
        status: input.status,
        reason: input.reason ?? undefined,
        sourceType: input.sourceType ?? undefined,
        sourceId: input.sourceId ?? undefined,
      },
    })
  }

  async listProfilesWithCtx(
    scope: RadarTeamScope,
    params: {
      search?: string
      consent?: RadarConsentStatus
      sourceType?: RadarSourceType
      channel?: RadarChannel
      lastSeenFrom?: Date
      lastSeenTo?: Date
      skip: number
      take: number
    }
  ) {
    const where: Prisma.RadarProfileWhereInput = {
      teamId: scope.teamId,
      ...(params.search && {
        OR: [
          { displayName: { contains: params.search, mode: "insensitive" } },
          { displayPhone: { contains: params.search } },
          { primaryEmail: { contains: params.search, mode: "insensitive" } },
        ],
      }),
      ...(params.sourceType && {
        sourceLinks: { some: { sourceType: params.sourceType } },
      }),
      ...(params.consent || params.channel
        ? {
            consents: {
              some: {
                ...(params.channel ? { channel: params.channel } : { channel: "email" }),
                ...(params.consent ? { status: params.consent } : {}),
              },
            },
          }
        : {}),
      ...(params.lastSeenFrom || params.lastSeenTo
        ? {
            lastSeenAt: {
              ...(params.lastSeenFrom ? { gte: params.lastSeenFrom } : {}),
              ...(params.lastSeenTo ? { lte: params.lastSeenTo } : {}),
            },
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.radarProfile.findMany({
        where,
        select: {
          ...profileListSelect,
          consents: {
            where: { channel: "email" },
            select: { status: true, reason: true, channel: true },
          },
          sourceLinks: {
            select: { sourceType: true },
            take: 5,
          },
        },
        orderBy: { lastSeenAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      prisma.radarProfile.count({ where }),
    ])

    return { items, total }
  }

  async getProfileDetailWithCtx(scope: RadarTeamScope, profileId: string) {
    return prisma.radarProfile.findFirst({
      where: { id: profileId, teamId: scope.teamId },
      select: {
        ...profileListSelect,
        normalizedName: true,
        normalizedPhone: true,
        normalizedPrimaryDocument: true,
        identities: {
          orderBy: { type: "asc" },
        },
        sourceLinks: {
          orderBy: { lastSyncedAt: "desc" },
        },
        consents: true,
        events: {
          orderBy: { occurredAt: "desc" },
          take: 10,
        },
      },
    })
  }

  async listProfileEventsWithCtx(
    scope: RadarTeamScope,
    profileId: string,
    skip: number,
    take: number
  ) {
    const where = { profileId, teamId: scope.teamId }
    const [items, total] = await Promise.all([
      prisma.radarEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take,
      }),
      prisma.radarEvent.count({ where }),
    ])
    return { items, total }
  }

  async countProfiles(scope: RadarTeamScope) {
    return prisma.radarProfile.count({ where: { teamId: scope.teamId } })
  }

  async findLeadsForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return prisma.lead.findMany({
      where: {
        teamId,
        ...(filters.leadId ? { id: filters.leadId } : {}),
        ...(filters.updatedSince ? { updatedAt: { gte: filters.updatedSince } } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        cnpj: true,
        status: true,
        createdAt: true,
        statusEnteredAt: true,
        updatedAt: true,
      },
    })
  }

  async findPortfoliosForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return prisma.leadPortfolio.findMany({
      where: {
        teamId,
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.updatedSince ? { updatedAt: { gte: filters.updatedSince } } : {}),
      },
      select: {
        id: true,
        leadId: true,
        renewalStatus: true,
        portfolioStatus: true,
        renewalAmount: true,
        updatedAt: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            cnpj: true,
            contractDueDate: true,
            status: true,
          },
        },
      },
    })
  }

  async findEmailContactLists(teamId: string) {
    return prisma.emailContactList.findMany({
      where: { teamId },
      select: { id: true },
    })
  }

  async findEmailContacts(listId: string) {
    return prisma.emailContact.findMany({
      where: { listId },
      select: {
        id: true,
        email: true,
        name: true,
        isUnsubscribed: true,
        isBounced: true,
        isComplained: true,
        updatedAt: true,
      },
    })
  }

  async findEmailLogsForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return prisma.emailLog.findMany({
      where: {
        teamId,
        ...(filters.emailLogSince ? { sentAt: { gte: filters.emailLogSince } } : {}),
      },
      select: {
        id: true,
        recipientEmail: true,
        campaignId: true,
        sentAt: true,
        events: {
          select: { id: true, type: true, occurredAt: true, metadata: true },
        },
      },
      take: 5000,
      orderBy: { sentAt: "desc" },
    })
  }

  async findProfileByPrimaryKey(teamId: string, normalizedPhone: string, normalizedName: string) {
    return prisma.radarProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: { teamId, normalizedPhone, normalizedName },
      },
      select: { id: true },
    })
  }

  async findProfileByEmail(teamId: string, normalizedEmail: string) {
    if (!normalizedEmail) return null
    return prisma.radarProfile.findFirst({
      where: { teamId, normalizedPrimaryEmail: normalizedEmail },
    })
  }

  async findLeadPhoneByEmail(teamId: string, normalizedEmail: string) {
    const lead = await prisma.lead.findFirst({
      where: { teamId, email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { phone: true },
    })
    return lead?.phone ? { phone: lead.phone } : null
  }

  async findLeadStatuses(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map<string, LeadStatus | null>()

    const leads = await prisma.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: { id: true, status: true },
    })

    return new Map(leads.map((lead) => [lead.id, lead.status]))
  }

  async countProfilesByWhere(where: Prisma.RadarProfileWhereInput): Promise<number> {
    return prisma.radarProfile.count({ where })
  }

  async listProfileIdsByWhere(
    where: Prisma.RadarProfileWhereInput,
    pagination?: { skip: number; take: number }
  ): Promise<string[]> {
    const profiles = await prisma.radarProfile.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "asc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })
    return profiles.map((profile) => profile.id)
  }

  async findLeadIdsByWhere(where: Prisma.LeadWhereInput): Promise<string[]> {
    const leads = await prisma.lead.findMany({ where, select: { id: true } })
    return leads.map((lead) => lead.id)
  }

  async listProfilesForSegmentationByIds(teamId: string, profileIds: string[]) {
    const uniqueIds = [...new Set(profileIds.filter(Boolean))]
    if (uniqueIds.length === 0) return []

    return prisma.radarProfile.findMany({
      where: { teamId, id: { in: uniqueIds } },
      select: {
        id: true,
        displayName: true,
        normalizedPrimaryEmail: true,
        consents: { where: { channel: "email" }, select: { status: true, reason: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        events: {
          select: { eventType: true, occurredAt: true, metadata: true, sourceType: true, sourceId: true },
        },
        identities: {
          where: { type: "lead_id" },
          select: { type: true, normalizedValue: true },
        },
      },
    })
  }

  async listProfilesForSegmentation(teamId: string) {
    return prisma.radarProfile.findMany({
      where: { teamId },
      select: {
        id: true,
        displayName: true,
        normalizedPrimaryEmail: true,
        consents: { where: { channel: "email" }, select: { status: true, reason: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        events: {
          select: { eventType: true, occurredAt: true, metadata: true, sourceType: true, sourceId: true },
        },
        identities: {
          where: { type: "lead_id" },
          select: { type: true, normalizedValue: true },
        },
      },
    })
  }

  async listRadarEmailVariables(teamId: string) {
    return prisma.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "RADAR" },
      select: { key: true, radarFieldKey: true, defaultValue: true },
    })
  }

  async findLeadsForRadarFieldResolution(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map()

    const leads = await prisma.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: {
        id: true,
        status: true,
        currentHealthPlan: true,
        soldPlan: true,
        contractDueDate: true,
        referenceHospital: true,
      },
    })

    return new Map(leads.map((lead) => [lead.id, lead]))
  }

  async listProfilesForProfileDataSync(teamId: string) {
    return prisma.radarProfile.findMany({
      where: { teamId },
      select: {
        id: true,
        displayName: true,
        displayPhone: true,
        primaryEmail: true,
        primaryDocument: true,
        lastSeenAt: true,
        consents: { select: { channel: true, status: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        identities: { select: { type: true, normalizedValue: true } },
      },
    })
  }

  async updateProfileData(profileId: string, teamId: string, profileData: Prisma.InputJsonValue) {
    return prisma.radarProfile.updateMany({
      where: { id: profileId, teamId },
      data: { profileData },
    })
  }

  async findProfilesForInterpolationByEmails(teamId: string, normalizedEmails: string[]) {
    const unique = [...new Set(normalizedEmails.filter(Boolean))]
    if (unique.length === 0) return []

    return prisma.radarProfile.findMany({
      where: { teamId, normalizedPrimaryEmail: { in: unique } },
      select: {
        normalizedPrimaryEmail: true,
        displayName: true,
        displayPhone: true,
        primaryEmail: true,
        primaryDocument: true,
        lastSeenAt: true,
        consents: { select: { channel: true, status: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        identities: { select: { type: true, normalizedValue: true } },
      },
    })
  }

  async findProfileDataByEmails(teamId: string, normalizedEmails: string[]) {
    const unique = [...new Set(normalizedEmails.filter(Boolean))]
    if (unique.length === 0) return new Map<string, Record<string, string>>()

    const profiles = await prisma.radarProfile.findMany({
      where: { teamId, normalizedPrimaryEmail: { in: unique } },
      select: { normalizedPrimaryEmail: true, profileData: true },
    })

    const map = new Map<string, Record<string, string>>()
    for (const profile of profiles) {
      if (!profile.normalizedPrimaryEmail) continue
      const data = profile.profileData
      if (data && typeof data === "object" && !Array.isArray(data)) {
        map.set(
          profile.normalizedPrimaryEmail,
          Object.fromEntries(
            Object.entries(data as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")])
          )
        )
      }
    }
    return map
  }

  async findRadarVariableFallbacks(teamId: string) {
    return prisma.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "RADAR", defaultValue: { not: null } },
      select: { key: true, defaultValue: true },
    })
  }
}

export const radarRepository = new RadarRepository()

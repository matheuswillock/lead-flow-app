import type {
  CustomerChannel,
  CustomerConsentReason,
  CustomerConsentStatus,
  CustomerIdentityType,
  CustomerSourceType,
  Prisma,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"

export type CdpTeamScope = {
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
  type: CustomerIdentityType
  value?: string | null
  normalizedValue: string
  source: string
  isPrimary?: boolean
}

export type UpsertSourceLinkInput = {
  profileId: string
  teamId: string
  sourceType: CustomerSourceType
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
  channel: CustomerChannel
  status: CustomerConsentStatus
  reason?: CustomerConsentReason | null
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

export class CdpRepository {
  async upsertProfile(input: UpsertProfileInput) {
    const existing = await prisma.customerProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: {
          teamId: input.teamId,
          normalizedPhone: input.normalizedPhone,
          normalizedName: input.normalizedName,
        },
      },
      select: { id: true, primaryEmail: true, normalizedPrimaryEmail: true, primaryDocument: true, normalizedPrimaryDocument: true },
    })

    if (!existing) {
      return prisma.customerProfile.create({
        data: {
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
      })
    }

    return prisma.customerProfile.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName || undefined,
        displayPhone: input.displayPhone || undefined,
        primaryEmail: input.primaryEmail ?? existing.primaryEmail ?? undefined,
        normalizedPrimaryEmail:
          input.normalizedPrimaryEmail ?? existing.normalizedPrimaryEmail ?? undefined,
        primaryDocument: input.primaryDocument ?? existing.primaryDocument ?? undefined,
        normalizedPrimaryDocument:
          input.normalizedPrimaryDocument ?? existing.normalizedPrimaryDocument ?? undefined,
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
    })
  }

  async upsertIdentity(input: UpsertIdentityInput) {
    return prisma.customerIdentity.upsert({
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
    return prisma.customerSourceLink.upsert({
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
    const duplicate = await prisma.customerEvent.findFirst({
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
      return await prisma.customerEvent.create({
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
    return prisma.customerChannelConsent.upsert({
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
    scope: CdpTeamScope,
    params: {
      search?: string
      consent?: CustomerConsentStatus
      sourceType?: CustomerSourceType
      skip: number
      take: number
    }
  ) {
    const where: Prisma.CustomerProfileWhereInput = {
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
      ...(params.consent && {
        consents: { some: { channel: "email", status: params.consent } },
      }),
    }

    const [items, total] = await Promise.all([
      prisma.customerProfile.findMany({
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
      prisma.customerProfile.count({ where }),
    ])

    return { items, total }
  }

  async getProfileDetailWithCtx(scope: CdpTeamScope, profileId: string) {
    return prisma.customerProfile.findFirst({
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
    scope: CdpTeamScope,
    profileId: string,
    skip: number,
    take: number
  ) {
    const where = { profileId, teamId: scope.teamId }
    const [items, total] = await Promise.all([
      prisma.customerEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take,
      }),
      prisma.customerEvent.count({ where }),
    ])
    return { items, total }
  }

  async countProfiles(scope: CdpTeamScope) {
    return prisma.customerProfile.count({ where: { teamId: scope.teamId } })
  }

  async findLeadsForCdpSync(teamId: string) {
    return prisma.lead.findMany({
      where: { teamId },
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

  async findPortfoliosForCdpSync(teamId: string) {
    return prisma.leadPortfolio.findMany({
      where: { teamId },
      select: {
        id: true,
        leadId: true,
        renewalStatus: true,
        portfolioStatus: true,
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

  async findEmailLogsForCdpSync(teamId: string) {
    return prisma.emailLog.findMany({
      where: { teamId },
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
    return prisma.customerProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: { teamId, normalizedPhone, normalizedName },
      },
      select: { id: true },
    })
  }

  async findProfileByEmail(teamId: string, normalizedEmail: string) {
    if (!normalizedEmail) return null
    return prisma.customerProfile.findFirst({
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
    if (unique.length === 0) return new Map<string, string>()

    const leads = await prisma.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: { id: true, status: true },
    })

    return new Map(leads.map((lead) => [lead.id, lead.status]))
  }

  async listProfilesForSegmentation(teamId: string) {
    return prisma.customerProfile.findMany({
      where: { teamId },
      select: {
        id: true,
        normalizedPrimaryEmail: true,
        consents: { where: { channel: "email" }, select: { status: true, reason: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        events: {
          select: { eventType: true, occurredAt: true, metadata: true, sourceType: true, sourceId: true },
        },
        identities: {
          where: { type: "lead_id" },
          select: { normalizedValue: true },
        },
      },
    })
  }
}

export const cdpRepository = new CdpRepository()

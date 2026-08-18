import type { EmailCampaignStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { CAMPAIGN_AUDIENCE_PRUNABLE_STATUSES } from "@/lib/email/campaign-audience-pruning-constants"

export type CampaignAudienceRow = {
  id: string
  teamId: string
  parentCampaignId: string | null
  totalRecipients: number
  audienceContactIds: string[]
  contactListId: string | null
  sourceContactListIds: string[]
  radarSegmentSlug: string | null
}

export type SuppressedContactRow = {
  id: string
  email: string
  listId: string
  isSystemDefaultList: boolean
}

export type IEmailCampaignAudienceRepository = {
  findSuppressedContacts(input: {
    teamId: string
    contactIds?: string[]
    emails?: string[]
  }): Promise<SuppressedContactRow[]>
  findPrunableCampaigns(
    teamId: string,
    filter: {
      suppressedIds: string[]
      suppressedListIds: string[]
      hasGeralContact: boolean
    }
  ): Promise<CampaignAudienceRow[]>
  findLeafCampaignIds(teamId: string): Promise<Array<{ id: string }>>
  findCampaignById(id: string): Promise<CampaignAudienceRow>
  countSuppressedInSnapshot(audienceContactIds: string[]): Promise<number>
  updateCampaign(id: string, data: Prisma.EmailCampaignUpdateInput): Promise<void>
  findChildTotals(parentCampaignId: string): Promise<Array<{ totalRecipients: number; status: EmailCampaignStatus }>>
  findTeamIdsForSuppressedEmail(email: string): Promise<string[]>
  findTeamIdsWithEmailLogs(email: string): Promise<string[]>
  findSuppressedIdsInSnapshot(audienceContactIds: string[]): Promise<string[]>
}

export class EmailCampaignAudienceRepository implements IEmailCampaignAudienceRepository {
  async findSuppressedContacts(input: {
    teamId: string
    contactIds?: string[]
    emails?: string[]
  }): Promise<SuppressedContactRow[]> {
    const normalizedEmails =
      input.emails?.map((email) => email.trim().toLowerCase()).filter(Boolean) ?? []

    if ((input.contactIds?.length ?? 0) === 0 && normalizedEmails.length === 0) {
      return []
    }

    const identityFilter: Prisma.EmailContactWhereInput[] = []
    if (input.contactIds?.length) identityFilter.push({ id: { in: input.contactIds } })
    if (normalizedEmails.length) identityFilter.push({ email: { in: normalizedEmails } })
    if (identityFilter.length === 0) return []

    const contacts = await prisma.emailContact.findMany({
      where: {
        list: { teamId: input.teamId, isArchived: false },
        OR: [{ isBounced: true }, { isUnsubscribed: true }, { isComplained: true }],
        AND: [{ OR: identityFilter }],
      },
      select: {
        id: true,
        email: true,
        listId: true,
        list: { select: { isSystemDefault: true } },
      },
    })

    return contacts.map((contact) => ({
      id: contact.id,
      email: contact.email,
      listId: contact.listId,
      isSystemDefaultList: contact.list.isSystemDefault,
    }))
  }

  async findPrunableCampaigns(
    teamId: string,
    filter: {
      suppressedIds: string[]
      suppressedListIds: string[]
      hasGeralContact: boolean
    }
  ): Promise<CampaignAudienceRow[]> {
    const orFilters: Prisma.EmailCampaignWhereInput[] = [
      ...(filter.suppressedIds.length > 0
        ? [{ audienceContactIds: { hasSome: [...filter.suppressedIds] } }]
        : []),
      ...(filter.suppressedListIds.length > 0
        ? [
            { contactListId: { in: filter.suppressedListIds } },
            { sourceContactListIds: { hasSome: filter.suppressedListIds } },
          ]
        : []),
      ...(filter.hasGeralContact ? [{ contactList: { isSystemDefault: true } }] : []),
    ]
    if (orFilters.length === 0) return []

    return prisma.emailCampaign.findMany({
      where: {
        teamId,
        status: { in: [...CAMPAIGN_AUDIENCE_PRUNABLE_STATUSES] },
        subCampaigns: { none: {} },
        OR: orFilters,
      },
      select: {
        id: true,
        teamId: true,
        parentCampaignId: true,
        totalRecipients: true,
        audienceContactIds: true,
        contactListId: true,
        sourceContactListIds: true,
        radarSegmentSlug: true,
      },
    })
  }

  async findLeafCampaignIds(teamId: string): Promise<Array<{ id: string }>> {
    return prisma.emailCampaign.findMany({
      where: {
        teamId,
        status: { in: [...CAMPAIGN_AUDIENCE_PRUNABLE_STATUSES] },
        subCampaigns: { none: {} },
      },
      select: { id: true },
    })
  }

  async findCampaignById(id: string): Promise<CampaignAudienceRow> {
    return prisma.emailCampaign.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        teamId: true,
        parentCampaignId: true,
        totalRecipients: true,
        audienceContactIds: true,
        contactListId: true,
        sourceContactListIds: true,
        radarSegmentSlug: true,
      },
    })
  }

  async countSuppressedInSnapshot(audienceContactIds: string[]): Promise<number> {
    const ids = await this.findSuppressedIdsInSnapshot(audienceContactIds)
    return ids.length
  }

  async findSuppressedIdsInSnapshot(audienceContactIds: string[]): Promise<string[]> {
    if (audienceContactIds.length === 0) return []
    const rows = await prisma.emailContact.findMany({
      where: {
        id: { in: audienceContactIds },
        OR: [{ isBounced: true }, { isUnsubscribed: true }, { isComplained: true }],
      },
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }

  async updateCampaign(id: string, data: Prisma.EmailCampaignUpdateInput): Promise<void> {
    await prisma.emailCampaign.update({ where: { id }, data })
  }

  async findChildTotals(
    parentCampaignId: string
  ): Promise<Array<{ totalRecipients: number; status: EmailCampaignStatus }>> {
    return prisma.emailCampaign.findMany({
      where: { parentCampaignId },
      select: { totalRecipients: true, status: true },
    })
  }

  async findTeamIdsForSuppressedEmail(email: string): Promise<string[]> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return []

    const rows = await prisma.emailContact.findMany({
      where: {
        email: normalized,
        OR: [{ isBounced: true }, { isUnsubscribed: true }, { isComplained: true }],
        list: { isArchived: false },
      },
      select: { list: { select: { teamId: true } } },
    })

    return [...new Set(rows.map((row) => row.list.teamId))]
  }

  async findTeamIdsWithEmailLogs(email: string): Promise<string[]> {
    const rows = await prisma.emailLog.findMany({
      where: { recipientEmail: email },
      select: { teamId: true },
      distinct: ["teamId"],
    })
    return rows.map((row) => row.teamId)
  }
}

export const emailCampaignAudienceRepository = new EmailCampaignAudienceRepository()

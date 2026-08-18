import { listRadarSegmentEmailRecipients } from "@/lib/radar/list-segment-recipients"
import {
  CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE,
} from "@/lib/email/campaign-audience-pruning-constants"
import {
  emailCampaignAudienceRepository,
  type CampaignAudienceRow,
  type IEmailCampaignAudienceRepository,
} from "@/app/api/infra/data/repositories/emailCampaignAudience/EmailCampaignAudienceRepository"
import { emailCampaignRecipientRepository } from "@/app/api/infra/data/repositories/emailCampaignRecipient/EmailCampaignRecipientRepository"

type PruneInput = {
  teamId: string
  contactIds?: string[]
  emails?: string[]
  listIds?: string[]
}

export type CampaignAudiencePruneResult = {
  prunedCampaignIds: string[]
  canceledCampaignIds: string[]
}

export class EmailCampaignAudiencePruningService {
  constructor(
    private readonly repository: IEmailCampaignAudienceRepository = emailCampaignAudienceRepository
  ) {}

  async pruneSuppressedContacts(input: PruneInput): Promise<CampaignAudiencePruneResult> {
    const suppressedContacts = await this.repository.findSuppressedContacts(input)
    const suppressedIds = new Set([
      ...(input.contactIds ?? []),
      ...suppressedContacts.map((contact) => contact.id),
    ])
    const suppressedListIds = [
      ...new Set([
        ...(input.listIds ?? []),
        ...suppressedContacts.map((contact) => contact.listId),
      ]),
    ]
    const hasGeralContact = suppressedContacts.some((contact) => contact.isSystemDefaultList)

    if (suppressedIds.size === 0 && suppressedListIds.length === 0 && !hasGeralContact) {
      return { prunedCampaignIds: [], canceledCampaignIds: [] }
    }

    const campaigns = await this.repository.findPrunableCampaigns(input.teamId, {
      suppressedIds: [...suppressedIds],
      suppressedListIds,
      hasGeralContact,
    })

    const prunedCampaignIds: string[] = []
    const canceledCampaignIds: string[] = []
    const parentIds = new Set<string>()

    for (const campaign of campaigns) {
      const result = await this.pruneSingleCampaign(campaign, suppressedIds)
      if (!result.changed) continue
      prunedCampaignIds.push(campaign.id)
      if (result.canceled) canceledCampaignIds.push(campaign.id)
      if (campaign.parentCampaignId) parentIds.add(campaign.parentCampaignId)
    }

    for (const parentId of parentIds) {
      await this.refreshParentTotals(parentId)
    }

    return { prunedCampaignIds, canceledCampaignIds }
  }

  async reconcileTeamCampaigns(teamId: string): Promise<CampaignAudiencePruneResult> {
    const campaigns = await this.repository.findLeafCampaignIds(teamId)

    const prunedCampaignIds: string[] = []
    const canceledCampaignIds: string[] = []
    const parentIds = new Set<string>()

    for (const { id } of campaigns) {
      const full = await this.repository.findCampaignById(id)

      const suppressedIds = full.audienceContactIds.length
        ? await this.repository.findSuppressedIdsInSnapshot(full.audienceContactIds)
        : []

      const needsDynamicRecount = full.audienceContactIds.length === 0
      if (suppressedIds.length === 0 && !needsDynamicRecount) continue

      const result = await this.pruneSingleCampaign(full, new Set(suppressedIds))
      if (!result.changed) continue
      prunedCampaignIds.push(full.id)
      if (result.canceled) canceledCampaignIds.push(full.id)
      if (full.parentCampaignId) parentIds.add(full.parentCampaignId)
    }

    for (const parentId of parentIds) {
      await this.refreshParentTotals(parentId)
    }

    return { prunedCampaignIds, canceledCampaignIds }
  }

  private async pruneSingleCampaign(
    campaign: CampaignAudienceRow,
    suppressedIds: Set<string>
  ): Promise<{ changed: boolean; canceled: boolean }> {
    let nextAudienceIds = campaign.audienceContactIds
    let nextTotalRecipients: number

    if (campaign.audienceContactIds.length > 0) {
      nextAudienceIds = campaign.audienceContactIds.filter((id) => !suppressedIds.has(id))
      const active = await emailCampaignRecipientRepository.findActiveRecipientsByIds(nextAudienceIds)
      const activeIds = new Set(active.map((recipient) => recipient.contactId))
      nextAudienceIds = nextAudienceIds.filter((id) => activeIds.has(id))
      nextTotalRecipients = nextAudienceIds.length
    } else {
      nextTotalRecipients = await this.countActiveRecipientsForCampaign(campaign)
    }

    const canceled = nextTotalRecipients === 0
    const audienceChanged =
      campaign.audienceContactIds.length > 0 &&
      nextAudienceIds.length !== campaign.audienceContactIds.length
    const totalChanged = nextTotalRecipients !== campaign.totalRecipients

    if (!canceled && !audienceChanged && !totalChanged) {
      return { changed: false, canceled: false }
    }

    await this.repository.updateCampaign(
      campaign.id,
      canceled
        ? {
            status: "canceled",
            errorMessage: CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE,
            totalRecipients: 0,
            ...(campaign.audienceContactIds.length > 0 ? { audienceContactIds: [] } : {}),
          }
        : {
            totalRecipients: nextTotalRecipients,
            errorMessage: null,
            ...(audienceChanged ? { audienceContactIds: nextAudienceIds } : {}),
          }
    )

    return { changed: true, canceled }
  }

  private async countActiveRecipientsForCampaign(campaign: CampaignAudienceRow): Promise<number> {
    if (campaign.radarSegmentSlug) {
      const recipients = await listRadarSegmentEmailRecipients(
        campaign.teamId,
        campaign.radarSegmentSlug
      )
      return recipients.length
    }

    const listIds = [
      ...(campaign.contactListId ? [campaign.contactListId] : []),
      ...campaign.sourceContactListIds,
    ]
    if (listIds.length === 0) return 0

    const uniqueListIds = [...new Set(listIds)]
    let total = 0
    for (const listId of uniqueListIds) {
      total += await emailCampaignRecipientRepository.countActiveRecipientsForList(listId)
    }
    return total
  }

  private async refreshParentTotals(parentCampaignId: string): Promise<void> {
    const children = await this.repository.findChildTotals(parentCampaignId)
    if (children.length === 0) return

    const totalRecipients = children.reduce((sum, child) => sum + child.totalRecipients, 0)
    const activeStatuses = children
      .filter((child) => child.status !== "archived")
      .map((child) => child.status)
    const allCanceled =
      activeStatuses.length > 0 && activeStatuses.every((status) => status === "canceled")

    await this.repository.updateCampaign(parentCampaignId, {
      totalRecipients,
      ...(allCanceled
        ? {
            status: "canceled",
            errorMessage: CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE,
          }
        : {}),
    })
  }
}

export const emailCampaignAudiencePruningService = new EmailCampaignAudiencePruningService()

export {
  CAMPAIGN_AUDIENCE_PRUNABLE_STATUSES,
  CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE,
} from "@/lib/email/campaign-audience-pruning-constants"

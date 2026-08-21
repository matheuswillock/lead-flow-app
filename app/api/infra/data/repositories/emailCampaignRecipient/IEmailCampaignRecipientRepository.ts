export type CampaignRecipientRecord = {
  contactId: string
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

export type RecipientListPage = {
  skip: number
  take: number
}

export type SuppressedAudienceCounts = {
  bounced: number
  unsubscribed: number
  complained: number
  total: number
}

export const EMPTY_SUPPRESSED_AUDIENCE_COUNTS: SuppressedAudienceCounts = {
  bounced: 0,
  unsubscribed: 0,
  complained: 0,
  total: 0,
}

export interface IEmailCampaignRecipientRepository {
  findContactListMeta(
    teamId: string,
    contactListId: string
  ): Promise<{ id: string; isSystemDefault: boolean } | null>
  findActiveRecipientsForTeam(
    teamId: string,
    page?: RecipientListPage
  ): Promise<CampaignRecipientRecord[]>
  findActiveRecipientsForList(
    contactListId: string,
    page?: RecipientListPage
  ): Promise<CampaignRecipientRecord[]>
  countActiveRecipientsForTeam(teamId: string): Promise<number>
  countActiveRecipientsForList(contactListId: string): Promise<number>
  countSuppressedRecipientsForTeam(teamId: string): Promise<SuppressedAudienceCounts>
  countSuppressedRecipientsForLists(
    teamId: string,
    contactListIds: string[]
  ): Promise<SuppressedAudienceCounts>
  countSuppressedRecipientsForEmails(
    teamId: string,
    emails: string[]
  ): Promise<SuppressedAudienceCounts>
  findActiveRecipientsByIds(contactIds: string[]): Promise<CampaignRecipientRecord[]>
  findGlobalVariableDefaults(teamId: string): Promise<Record<string, string>>
}

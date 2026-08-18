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
  countSuppressedRecipientsForTeam(teamId: string): Promise<number>
  countSuppressedRecipientsForLists(teamId: string, contactListIds: string[]): Promise<number>
  countSuppressedRecipientsForEmails(teamId: string, emails: string[]): Promise<number>
  findActiveRecipientsByIds(contactIds: string[]): Promise<CampaignRecipientRecord[]>
  findGlobalVariableDefaults(teamId: string): Promise<Record<string, string>>
}

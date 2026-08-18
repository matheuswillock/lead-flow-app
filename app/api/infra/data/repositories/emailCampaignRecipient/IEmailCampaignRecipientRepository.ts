export type CampaignRecipientRecord = {
  contactId: string
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

export interface IEmailCampaignRecipientRepository {
  findContactListMeta(
    teamId: string,
    contactListId: string
  ): Promise<{ id: string; isSystemDefault: boolean } | null>
  findActiveRecipientsForTeam(teamId: string): Promise<CampaignRecipientRecord[]>
  findActiveRecipientsForList(contactListId: string): Promise<CampaignRecipientRecord[]>
  countActiveRecipientsForTeam(teamId: string): Promise<number>
  countActiveRecipientsForList(contactListId: string): Promise<number>
  countSuppressedRecipientsForTeam(teamId: string): Promise<number>
  countSuppressedRecipientsForLists(teamId: string, contactListIds: string[]): Promise<number>
  countSuppressedRecipientsForEmails(teamId: string, emails: string[]): Promise<number>
  findActiveRecipientsByIds(contactIds: string[]): Promise<CampaignRecipientRecord[]>
  findGlobalVariableDefaults(teamId: string): Promise<Record<string, string>>
}

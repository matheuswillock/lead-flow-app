export type CampaignRecipientRecord = {
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
  findGlobalVariableDefaults(teamId: string): Promise<Record<string, string>>
}

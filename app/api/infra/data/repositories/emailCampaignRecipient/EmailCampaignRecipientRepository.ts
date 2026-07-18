import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CampaignRecipientRecord,
  IEmailCampaignRecipientRepository,
} from "./IEmailCampaignRecipientRepository"

const recipientSelect = {
  id: true,
  email: true,
  name: true,
  customFields: true,
} as const

export class EmailCampaignRecipientRepository implements IEmailCampaignRecipientRepository {
  async findContactListMeta(teamId: string, contactListId: string) {
    return prisma.emailContactList.findFirst({
      where: { id: contactListId, teamId, isArchived: false, isBlocklist: false },
      select: { id: true, isSystemDefault: true },
    })
  }

  async findActiveRecipientsForTeam(teamId: string): Promise<CampaignRecipientRecord[]> {
    const blocklisted = await prisma.emailContact.findMany({
      where: {
        list: { teamId, isArchived: false, isBlocklist: true },
      },
      select: { email: true },
    })
    const blocklistedEmails = blocklisted.map((item) => item.email)

    const recipients = await prisma.emailContact.findMany({
      where: {
        isUnsubscribed: false,
        isBounced: false,
        isComplained: false,
        ...(blocklistedEmails.length > 0 ? { email: { notIn: blocklistedEmails } } : {}),
        list: {
          teamId,
          isArchived: false,
          isBlocklist: false,
        },
      },
      orderBy: { updatedAt: "desc" },
      select: recipientSelect,
    })

    return recipients.map((recipient) => ({
      contactId: recipient.id,
      email: recipient.email,
      name: recipient.name,
      customFields: recipient.customFields as Record<string, unknown> | null,
    }))
  }

  async findActiveRecipientsForList(contactListId: string): Promise<CampaignRecipientRecord[]> {
    const list = await prisma.emailContactList.findFirst({
      where: { id: contactListId, isArchived: false },
      select: { id: true, teamId: true, isBlocklist: true },
    })
    if (!list || list.isBlocklist) {
      return []
    }

    const blocklisted = await prisma.emailContact.findMany({
      where: {
        list: { teamId: list.teamId, isArchived: false, isBlocklist: true },
      },
      select: { email: true },
    })
    const blocklistedEmails = blocklisted.map((item) => item.email)

    const recipients = await prisma.emailContact.findMany({
      where: {
        listId: contactListId,
        isUnsubscribed: false,
        isBounced: false,
        isComplained: false,
        ...(blocklistedEmails.length > 0 ? { email: { notIn: blocklistedEmails } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: recipientSelect,
    })

    return recipients.map((recipient) => ({
      contactId: recipient.id,
      email: recipient.email,
      name: recipient.name,
      customFields: recipient.customFields as Record<string, unknown> | null,
    }))
  }

  async findGlobalVariableDefaults(teamId: string): Promise<Record<string, string>> {
    const variables = await prisma.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "STATIC", defaultValue: { not: null } },
      select: { key: true, defaultValue: true },
    })

    return variables.reduce<Record<string, string>>((acc, variable) => {
      if (variable.defaultValue != null) acc[variable.key] = variable.defaultValue
      return acc
    }, {})
  }
}

export const emailCampaignRecipientRepository = new EmailCampaignRecipientRepository()

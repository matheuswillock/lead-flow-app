import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  EMPTY_SUPPRESSED_AUDIENCE_COUNTS,
  type CampaignRecipientRecord,
  type IEmailCampaignRecipientRepository,
  type RecipientListPage,
  type SuppressedAudienceCounts,
} from "./IEmailCampaignRecipientRepository"

type SuppressedCountRow = {
  bounced: bigint
  unsubscribed: bigint
  complained: bigint
}

function mapSuppressedCountRow(row?: SuppressedCountRow): SuppressedAudienceCounts {
  const bounced = Number(row?.bounced ?? 0)
  const unsubscribed = Number(row?.unsubscribed ?? 0)
  const complained = Number(row?.complained ?? 0)
  return {
    bounced,
    unsubscribed,
    complained,
    total: bounced + unsubscribed + complained,
  }
}

function suppressedBreakdownSql(whereClause: Prisma.Sql) {
  return Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE flags.is_bounced) AS bounced,
      COUNT(*) FILTER (WHERE flags.is_unsubscribed AND NOT flags.is_bounced) AS unsubscribed,
      COUNT(*) FILTER (WHERE flags.is_complained AND NOT flags.is_bounced AND NOT flags.is_unsubscribed) AS complained
    FROM (
      SELECT
        BOOL_OR(c."isBounced") AS is_bounced,
        BOOL_OR(c."isUnsubscribed") AS is_unsubscribed,
        BOOL_OR(c."isComplained") AS is_complained
      FROM "corretor_studio_email_contacts" c
      INNER JOIN "corretor_studio_email_contact_lists" l ON l.id = c."listId"
      WHERE ${whereClause}
        AND l."isArchived" = false
        AND l."isBlocklist" = false
        AND (c."isUnsubscribed" = true OR c."isBounced" = true OR c."isComplained" = true)
      GROUP BY LOWER(TRIM(c.email))
    ) flags
  `
}

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

  private async findBlocklistedEmails(teamId: string): Promise<string[]> {
    const blocklisted = await prisma.emailContact.findMany({
      where: {
        list: { teamId, isArchived: false, isBlocklist: true },
      },
      select: { email: true },
    })
    return blocklisted.map((item) => item.email)
  }

  private activeRecipientWhere(blocklistedEmails: string[]) {
    return {
      isUnsubscribed: false,
      isBounced: false,
      isComplained: false,
      ...(blocklistedEmails.length > 0 ? { email: { notIn: blocklistedEmails } } : {}),
    }
  }

  async findActiveRecipientsForTeam(
    teamId: string,
    page?: RecipientListPage
  ): Promise<CampaignRecipientRecord[]> {
    const pagination = page
      ? Prisma.sql`OFFSET ${page.skip} LIMIT ${page.take}`
      : Prisma.empty

    const recipients = await prisma.$queryRaw<
      Array<{
        id: string
        email: string
        name: string | null
        customFields: unknown
      }>
    >`
      SELECT d.id, d.email, d.name, d."customFields"
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(c.email)))
          c.id,
          c.email,
          c.name,
          c."customFields",
          c."updatedAt"
        FROM "corretor_studio_email_contacts" c
        INNER JOIN "corretor_studio_email_contact_lists" l ON l.id = c."listId"
        WHERE l."teamId" = ${teamId}::uuid
          AND l."isArchived" = false
          AND l."isBlocklist" = false
          AND c."isUnsubscribed" = false
          AND c."isBounced" = false
          AND c."isComplained" = false
          AND NOT EXISTS (
            SELECT 1
            FROM "corretor_studio_email_contacts" b
            INNER JOIN "corretor_studio_email_contact_lists" bl ON bl.id = b."listId"
            WHERE bl."teamId" = ${teamId}::uuid
              AND bl."isArchived" = false
              AND bl."isBlocklist" = true
              AND b.email = c.email
          )
        ORDER BY LOWER(TRIM(c.email)), c."updatedAt" DESC, c.id ASC
      ) d
      ORDER BY d."updatedAt" DESC, d.id ASC
      ${pagination}
    `

    return recipients.map((recipient) => ({
      contactId: recipient.id,
      email: recipient.email,
      name: recipient.name,
      customFields: recipient.customFields as Record<string, unknown> | null,
    }))
  }

  async countActiveRecipientsForTeam(teamId: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT LOWER(TRIM(c.email))) AS count
      FROM "corretor_studio_email_contacts" c
      INNER JOIN "corretor_studio_email_contact_lists" l ON l.id = c."listId"
      WHERE l."teamId" = ${teamId}::uuid
        AND l."isArchived" = false
        AND l."isBlocklist" = false
        AND c."isUnsubscribed" = false
        AND c."isBounced" = false
        AND c."isComplained" = false
        AND NOT EXISTS (
          SELECT 1
          FROM "corretor_studio_email_contacts" b
          INNER JOIN "corretor_studio_email_contact_lists" bl ON bl.id = b."listId"
          WHERE bl."teamId" = ${teamId}::uuid
            AND bl."isArchived" = false
            AND bl."isBlocklist" = true
            AND b.email = c.email
        )
    `

    return Number(rows[0]?.count ?? 0)
  }

  async findActiveRecipientsForList(
    contactListId: string,
    page?: RecipientListPage
  ): Promise<CampaignRecipientRecord[]> {
    const list = await prisma.emailContactList.findFirst({
      where: { id: contactListId, isArchived: false },
      select: { id: true, teamId: true, isBlocklist: true },
    })
    if (!list || list.isBlocklist) {
      return []
    }

    const blocklistedEmails = await this.findBlocklistedEmails(list.teamId)

    const recipients = await prisma.emailContact.findMany({
      where: {
        listId: contactListId,
        ...this.activeRecipientWhere(blocklistedEmails),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...(page ? { skip: page.skip, take: page.take } : {}),
      select: recipientSelect,
    })

    return recipients.map((recipient) => ({
      contactId: recipient.id,
      email: recipient.email,
      name: recipient.name,
      customFields: recipient.customFields as Record<string, unknown> | null,
    }))
  }

  async countActiveRecipientsForList(contactListId: string): Promise<number> {
    const list = await prisma.emailContactList.findFirst({
      where: { id: contactListId, isArchived: false },
      select: { id: true, teamId: true, isBlocklist: true },
    })
    if (!list || list.isBlocklist) {
      return 0
    }

    const blocklistedEmails = await this.findBlocklistedEmails(list.teamId)

    return prisma.emailContact.count({
      where: {
        listId: contactListId,
        ...this.activeRecipientWhere(blocklistedEmails),
      },
    })
  }

  async countSuppressedRecipientsForTeam(teamId: string): Promise<SuppressedAudienceCounts> {
    const rows = await prisma.$queryRaw<SuppressedCountRow[]>(
      suppressedBreakdownSql(Prisma.sql`l."teamId" = ${teamId}::uuid`)
    )
    return mapSuppressedCountRow(rows[0])
  }

  async countSuppressedRecipientsForLists(
    teamId: string,
    contactListIds: string[]
  ): Promise<SuppressedAudienceCounts> {
    if (contactListIds.length === 0) return EMPTY_SUPPRESSED_AUDIENCE_COUNTS

    const rows = await prisma.$queryRaw<SuppressedCountRow[]>(
      suppressedBreakdownSql(
        Prisma.sql`l."teamId" = ${teamId}::uuid AND c."listId" = ANY(${contactListIds}::uuid[])`
      )
    )
    return mapSuppressedCountRow(rows[0])
  }

  async countSuppressedRecipientsForEmails(
    teamId: string,
    emails: string[]
  ): Promise<SuppressedAudienceCounts> {
    const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
    if (normalized.length === 0) return EMPTY_SUPPRESSED_AUDIENCE_COUNTS

    const rows = await prisma.$queryRaw<SuppressedCountRow[]>(
      suppressedBreakdownSql(
        Prisma.sql`l."teamId" = ${teamId}::uuid AND LOWER(TRIM(c.email)) = ANY(${normalized}::text[])`
      )
    )
    return mapSuppressedCountRow(rows[0])
  }

  async findActiveRecipientsByIds(contactIds: string[]): Promise<CampaignRecipientRecord[]> {
    if (contactIds.length === 0) return []

    const recipients = await prisma.emailContact.findMany({
      where: {
        id: { in: contactIds },
        isUnsubscribed: false,
        isBounced: false,
        isComplained: false,
      },
      select: recipientSelect,
    })

    const byId = new Map(recipients.map((recipient) => [recipient.id, recipient]))
    const ordered: CampaignRecipientRecord[] = []
    for (const contactId of contactIds) {
      const recipient = byId.get(contactId)
      if (!recipient) continue
      ordered.push({
        contactId: recipient.id,
        email: recipient.email,
        name: recipient.name,
        customFields: recipient.customFields as Record<string, unknown> | null,
      })
    }
    return ordered
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

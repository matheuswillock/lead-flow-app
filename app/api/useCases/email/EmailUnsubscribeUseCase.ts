import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EMAIL_BLOCKLIST_NAME } from "@/lib/email/email-contact-blocklist"
import { parseEmailUnsubscribeToken, maskEmailForUnsubscribe } from "@/lib/email/unsubscribe-token"

export type EmailUnsubscribeScope = "campaign" | "all"

export class EmailUnsubscribeUseCase {
  async getInfo(token: string): Promise<Output> {
    const parsed = parseEmailUnsubscribeToken(token)
    if (!parsed) {
      return new Output(false, [], ["Link inválido ou expirado"], null)
    }

    const contact = await prisma.emailContact.findFirst({
      where: { id: parsed.contactId, list: { teamId: parsed.teamId } },
      select: {
        email: true,
        list: { select: { team: { select: { name: true } } } },
      },
    })

    if (!contact) {
      return new Output(true, [], [], {
        teamName: "Time",
        maskedEmail: "•••@•••",
        alreadyUnsubscribed: true,
        alreadyBlocked: true,
        campaignName: null,
      })
    }

    const blocked = await prisma.emailContact.findFirst({
      where: {
        email: contact.email,
        list: { teamId: parsed.teamId, isArchived: false, isBlocklist: true },
      },
      select: { id: true },
    })

    let campaignName: string | null = null
    if (parsed.campaignId) {
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id: parsed.campaignId, teamId: parsed.teamId },
        select: { name: true },
      })
      campaignName = campaign?.name ?? null
    }

    return new Output(true, [], [], {
      teamName: contact.list.team.name,
      maskedEmail: maskEmailForUnsubscribe(contact.email),
      alreadyUnsubscribed: Boolean(blocked),
      alreadyBlocked: Boolean(blocked),
      campaignName,
    })
  }

  async unsubscribe(token: string, scope: EmailUnsubscribeScope): Promise<Output> {
    const parsed = parseEmailUnsubscribeToken(token)
    if (!parsed) {
      return new Output(false, [], ["Não foi possível processar o descadastro"], null)
    }

    if (scope !== "campaign" && scope !== "all") {
      return new Output(false, [], ["Selecione ao menos uma preferência"], null)
    }

    const contact = await prisma.emailContact.findFirst({
      where: { id: parsed.contactId, list: { teamId: parsed.teamId } },
      select: {
        id: true,
        email: true,
        name: true,
        list: { select: { createdBy: true } },
      },
    })

    if (!contact) {
      return new Output(true, ["Descadastro confirmado"], [], { unsubscribed: true, scope })
    }

    const normalizedEmail = contact.email.trim().toLowerCase()

    const campaign = parsed.campaignId
      ? await prisma.emailCampaign.findFirst({
          where: { id: parsed.campaignId, teamId: parsed.teamId },
          select: {
            id: true,
            contactListId: true,
            createdBy: true,
            contactList: {
              select: { id: true, isSystemDefault: true, isBlocklist: true },
            },
          },
        })
      : null

    await prisma.$transaction(async (tx) => {
      if (scope === "campaign") {
        const listId = campaign?.contactListId
        const listMeta = campaign?.contactList
        if (listId && listMeta && !listMeta.isSystemDefault && !listMeta.isBlocklist) {
          await tx.emailContact.deleteMany({
            where: { listId, email: normalizedEmail },
          })
          const totalCount = await tx.emailContact.count({ where: { listId } })
          await tx.emailContactList.update({
            where: { id: listId },
            data: { totalContacts: totalCount },
          })
        }
      }

      if (scope === "all") {
        const affectedContacts = await tx.emailContact.findMany({
          where: {
            email: normalizedEmail,
            list: { teamId: parsed.teamId, isArchived: false },
          },
          select: { listId: true },
        })
        const affectedListIds = Array.from(new Set(affectedContacts.map((item) => item.listId)))

        await tx.emailContact.deleteMany({
          where: {
            email: normalizedEmail,
            list: { teamId: parsed.teamId, isArchived: false },
          },
        })

        for (const listId of affectedListIds) {
          const totalCount = await tx.emailContact.count({ where: { listId } })
          await tx.emailContactList.update({
            where: { id: listId },
            data: { totalContacts: totalCount },
          })
        }

        const createdBy = campaign?.createdBy ?? contact.list.createdBy
        let blocklist = await tx.emailContactList.findFirst({
          where: {
            teamId: parsed.teamId,
            isArchived: false,
            isBlocklist: true,
          },
          select: { id: true },
        })

        if (!blocklist) {
          blocklist = await tx.emailContactList.create({
            data: {
              id: randomUUID(),
              teamId: parsed.teamId,
              createdBy,
              name: EMAIL_BLOCKLIST_NAME,
              isBlocklist: true,
              isSystemDefault: false,
            },
            select: { id: true },
          })
        }

        await tx.emailContact.upsert({
          where: { listId_email: { listId: blocklist.id, email: normalizedEmail } },
          update: { isUnsubscribed: true, name: contact.name },
          create: {
            id: randomUUID(),
            listId: blocklist.id,
            email: normalizedEmail,
            name: contact.name,
            isUnsubscribed: true,
          },
        })

        const blocklistTotal = await tx.emailContact.count({ where: { listId: blocklist.id } })
        await tx.emailContactList.update({
          where: { id: blocklist.id },
          data: { totalContacts: blocklistTotal },
        })
      }

      if (parsed.campaignId) {
        const log = await tx.emailLog.findFirst({
          where: {
            teamId: parsed.teamId,
            campaignId: parsed.campaignId,
            recipientEmail: normalizedEmail,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            events: { where: { type: "unsubscribed" }, select: { id: true }, take: 1 },
          },
        })

        if (log && log.events.length === 0) {
          await tx.emailEvent.create({
            data: {
              id: randomUUID(),
              logId: log.id,
              type: "unsubscribed",
              occurredAt: new Date(),
              metadata: { source: "in_app", scope },
            },
          })
        }
      }
    })

    const message =
      scope === "all"
        ? "Você não receberá mais e-mails deste time"
        : "Você foi removido desta campanha"

    return new Output(true, [message], [], { unsubscribed: true, scope })
  }
}

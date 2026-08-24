import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  BLOCK_REASON_UNSUBSCRIBE,
  blockTeamEmail,
} from "@/lib/email/email-contact-blocklist"
import { parseEmailUnsubscribeToken, maskEmailForUnsubscribe } from "@/lib/email/unsubscribe-token"
import { emailCampaignAudiencePruneUseCase } from "@/app/api/useCases/email/EmailCampaignAudiencePruneUseCase"

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

    const pruneTargets = await prisma.emailContact.findMany({
      where:
        scope === "all"
          ? {
              email: normalizedEmail,
              list: { teamId: parsed.teamId, isArchived: false, isBlocklist: false },
            }
          : { id: contact.id },
      select: {
        id: true,
        listId: true,
        list: { select: { isSystemDefault: true } },
      },
    })

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
        await blockTeamEmail(tx, {
          teamId: parsed.teamId,
          email: normalizedEmail,
          name: contact.name,
          createdBy: campaign?.createdBy ?? contact.list.createdBy,
          reason: BLOCK_REASON_UNSUBSCRIBE,
          markUnsubscribed: true,
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

    emailCampaignAudiencePruneUseCase.queueCampaignAudiencePrune({
      teamId: parsed.teamId,
      emails: [normalizedEmail],
      contactIds: pruneTargets.map((item) => item.id),
      listIds: [...new Set(pruneTargets.map((item) => item.listId))],
    })

    const message =
      scope === "all"
        ? "Você não receberá mais e-mails deste time"
        : "Você foi removido desta campanha"

    return new Output(true, [message], [], { unsubscribed: true, scope })
  }
}

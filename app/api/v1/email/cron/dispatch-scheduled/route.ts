import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailCampaignDispatchService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService"
import { EmailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import { formatIntimezone, resolveTimezone } from "@/lib/dates"

const DEFAULT_FROM = `Corretor Studio <no-reply@corretorstudio.com>`
const MAX_CAMPAIGNS_PER_RUN = 5

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const now = new Date()
    const dispatchService = new EmailCampaignDispatchService()
    const creditService = new EmailCreditService()

    // Buscar campanhas agendadas que estão prontas para disparo
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: now },
      },
      include: {
        template: true,
        team: { select: { master: { select: { id: true, timezone: true } } } },
      },
      take: MAX_CAMPAIGNS_PER_RUN,
    })

    let dispatched = 0

    for (const campaign of campaigns) {
      try {
        if (!campaign.template.html) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "failed", errorMessage: "Template sem HTML" },
          })
          continue
        }

        const masterId = campaign.team.master.id
        const ownerTz = resolveTimezone(campaign.team.master.timezone)
        const hasCredits = await creditService.hasEnoughCredits(masterId)
        if (!hasCredits) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "failed", errorMessage: "Sem assinatura de créditos ativa" },
          })
          continue
        }

        const lockResult = await prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: "scheduled" },
          data: { status: "sending" },
        })

        if (lockResult.count === 0) {
          continue
        }

        const contacts = await prisma.emailContact.findMany({
          where: {
            listId: campaign.contactListId,
            isUnsubscribed: false,
            isBounced: false,
          },
          select: { email: true, name: true },
        })

        if (contacts.length === 0) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "failed", errorMessage: "Nenhum contato ativo na lista" },
          })
          continue
        }

        const recipientsList = contacts.map((c) => ({ email: c.email, name: c.name ?? undefined }))

        const result = await dispatchService.dispatchBatch({
          from: DEFAULT_FROM,
          recipients: recipientsList,
          subject: campaign.template.subject,
          html: campaign.template.html,
          campaignId: campaign.id,
          teamId: campaign.teamId,
        })

        if (result.dispatched.length > 0) {
          const sentAt = new Date()
          const emailToContact = new Map(recipientsList.map((c) => [c.email, c]))
          await prisma.emailLog.createMany({
            data: result.dispatched.map(({ email, resendId }) => ({
              id: randomUUID(),
              teamId: campaign.teamId,
              campaignId: campaign.id,
              resendEmailId: resendId,
              recipientEmail: email,
              recipientName: emailToContact.get(email)?.name ?? null,
              subject: campaign.template.subject,
              status: "sent" as const,
              sentAt,
            })),
            skipDuplicates: true,
          })

          await creditService.deductCredits(masterId, result.sent)
        }

        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            totalSent: result.sent,
          },
        })

        dispatched++
        const scheduledLabel = campaign.scheduledAt
          ? formatIntimezone(campaign.scheduledAt, "dd/MM/yyyy HH:mm", ownerTz)
          : "sem data"
        console.info(
          `[EmailCronDispatch] Campanha ${campaign.id} disparada: ${result.sent} emails enviados (agendada para ${scheduledLabel} ${ownerTz})`
        )
      } catch (campaignError) {
        console.error(`[EmailCronDispatch] Erro na campanha ${campaign.id}:`, campaignError)
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: "failed", errorMessage: "Erro interno durante o disparo" },
        }).catch(() => null)
      }
    }

    console.info(`[EmailCronDispatch] ${dispatched} campanhas disparadas nesta execução`)
    return NextResponse.json(
      new Output(true, [`${dispatched} campanhas disparadas`], [], { dispatched }),
      { status: 200 }
    )
  } catch (error) {
    console.error("[EmailCronDispatchRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de disparo"], null), { status: 500 })
  }
}

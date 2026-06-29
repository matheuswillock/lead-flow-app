import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailCampaignDispatchService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService"
import { EmailCampaignRecipientService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignRecipientService"
import { EmailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import { formatIntimezone, resolveTimezone } from "@/lib/dates"
import { interpolateEmailTemplate } from "@/lib/email/interpolate"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const FALLBACK_FROM_NAME = "Corretor Studio"
const FALLBACK_FROM_EMAIL = "no-reply@corretorstudio.com"
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
    const recipientService = new EmailCampaignRecipientService()
    const creditService = new EmailCreditService()

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

        const templateHtml = campaign.template.html

        const teamSettings = await prisma.emailTeamSettings.findUnique({
          where: { teamId: campaign.teamId },
          select: {
            dispatchBlockedDates: true,
            dispatchTimeFrom: true,
            dispatchTimeTo: true,
            fromName: true,
            fromEmail: true,
            replyTo: true,
          },
        }).catch(() => null)

        if (teamSettings) {
          const todayStr = now.toISOString().slice(0, 10)
          type BlockedEntry = { date?: string; from?: string; to?: string }
          const blockedDates = ((teamSettings.dispatchBlockedDates as BlockedEntry[]) ?? [])
          let blocked = false
          let blockReason = ""
          for (const entry of blockedDates) {
            if (entry.date && entry.date === todayStr) {
              blocked = true
              blockReason = `Data ${todayStr} bloqueada por restrição configurada`
              break
            }
            if (entry.from && entry.to && todayStr >= entry.from && todayStr <= entry.to) {
              blocked = true
              blockReason = `Período bloqueado ${entry.from} – ${entry.to}`
              break
            }
          }
          if (!blocked && teamSettings.dispatchTimeFrom && teamSettings.dispatchTimeTo) {
            const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
            const [fH, fM] = teamSettings.dispatchTimeFrom.split(":").map(Number)
            const [tH, tM] = teamSettings.dispatchTimeTo.split(":").map(Number)
            if (currentMinutes < fH * 60 + fM || currentMinutes > tH * 60 + tM) {
              blocked = true
              blockReason = `Fora da janela de disparo ${teamSettings.dispatchTimeFrom}–${teamSettings.dispatchTimeTo} (UTC)`
            }
          }
          if (blocked) {
            await prisma.emailCampaign.update({
              where: { id: campaign.id },
              data: { status: "failed", errorMessage: `Disparo bloqueado: ${blockReason}` },
            })
            continue
          }
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

        const dispatchInput = await recipientService.buildCampaignDispatchInput({
          teamId: campaign.teamId,
          contactListId: campaign.contactListId,
          template: {
            subject: campaign.template.subject,
            html: templateHtml,
            variables: campaign.template.variables,
          },
          teamSettings,
          masterTimezone: campaign.team.master.timezone,
          fallbackFromName: FALLBACK_FROM_NAME,
          fallbackFromEmail: FALLBACK_FROM_EMAIL,
        })

        if (dispatchInput.recipients.length === 0) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "failed", errorMessage: "Nenhum contato ativo na lista" },
          })
          continue
        }

        const unresolvedTokens = recipientService.findUnresolvedTokensForRecipients({
          subject: dispatchInput.subject,
          html: dispatchInput.html,
          recipients: dispatchInput.recipients,
          globalDefaults: dispatchInput.globalDefaults,
          templateVariables: dispatchInput.templateVariables,
        })

        if (unresolvedTokens.length > 0) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: {
              status: "failed",
              errorMessage: `Variáveis sem valor suficiente: ${unresolvedTokens.map((token) => `{{${token}}}`).join(", ")}`,
            },
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

        const result = await dispatchService.dispatchBatch({
          from: dispatchInput.from,
          replyTo: dispatchInput.replyTo,
          recipients: dispatchInput.recipients,
          subject: dispatchInput.subject,
          html: dispatchInput.html,
          campaignId: campaign.id,
          teamId: campaign.teamId,
          globalDefaults: dispatchInput.globalDefaults,
          templateVariables: dispatchInput.templateVariables,
        })

        if (result.dispatched.length > 0) {
          const sentAt = new Date()
          const emailToContact = new Map(dispatchInput.recipients.map((contact) => [contact.email, contact]))
          await prisma.emailLog.createMany({
            data: result.dispatched.map(({ email, resendId }) => {
              const contact = emailToContact.get(email)
              const renderedSubject = contact
                ? interpolateEmailTemplate(
                    dispatchInput.subject,
                    contact,
                    dispatchInput.globalDefaults,
                    dispatchInput.templateVariables
                  )
                : dispatchInput.subject

              return {
                id: randomUUID(),
                teamId: campaign.teamId,
                campaignId: campaign.id,
                resendEmailId: resendId,
                recipientEmail: email,
                recipientName: contact?.name ?? null,
                subject: renderedSubject,
                category: "campaign" as const,
                status: "sent" as const,
                sentAt,
              }
            }),
            skipDuplicates: true,
          })

          await creditService.deductCredits(masterId, result.sent)
        }

        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            totalRecipients: dispatchInput.recipients.length,
            totalSent: result.sent,
            dispatchCount: { increment: 1 },
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
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailCronDispatchRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de disparo"], null), { status: 500 })
  }
}

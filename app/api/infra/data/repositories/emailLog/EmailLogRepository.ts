import { prisma } from "@/app/api/infra/data/prisma"
import { Prisma } from "@prisma/client"
import type {
  ApplyEmailLogWebhookInput,
  CreateTeamEmailLogInput,
  IEmailLogRepository,
  MarkSentEntry,
} from "./IEmailLogRepository"
import type { EmailEventType } from "@prisma/client"
import { withDeadlockRetry } from "@/lib/email/with-deadlock-retry"
import { shouldStampIsBouncedFromEventMetadata } from "@/lib/email/bounce-suppression"

export class EmailLogRepository implements IEmailLogRepository {
  async findByResendEmailId(resendEmailId: string) {
    return prisma.emailLog.findUnique({
      where: { resendEmailId },
      select: {
        id: true,
        teamId: true,
        status: true,
        recipientEmail: true,
        recipientName: true,
        campaignId: true,
        dispatchId: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        complainedAt: true,
      },
    })
  }

  async findCampaignLogForAttribution(teamId: string, emailLogId: string) {
    const log = await prisma.emailLog.findFirst({
      where: {
        id: emailLogId,
        teamId,
        category: "campaign",
      },
      select: {
        id: true,
        campaignId: true,
        dispatchId: true,
        recipientEmail: true,
        recipientName: true,
        campaign: { select: { name: true } },
      },
    })
    if (!log) return null
    return {
      id: log.id,
      campaignId: log.campaignId,
      dispatchId: log.dispatchId,
      recipientEmail: log.recipientEmail,
      recipientName: log.recipientName,
      campaignName: log.campaign?.name ?? null,
    }
  }

  async hasDuplicateEvent(logId: string, eventType: EmailEventType, occurredAt: Date) {
    const duplicate = await prisma.emailEvent.findFirst({
      where: { logId, type: eventType, occurredAt },
      select: { id: true },
    })
    return Boolean(duplicate)
  }

  async applyWebhookEvent(input: ApplyEmailLogWebhookInput): Promise<void> {
    const { log, eventType, occurredAt, metadata, eventId } = input

    const timestampField: Partial<Record<EmailEventType, string>> = {
      delivered: "deliveredAt",
      opened: "openedAt",
      clicked: "clickedAt",
      bounced: "bouncedAt",
      complained: "complainedAt",
    }

    const timestampUpdate = timestampField[eventType]
      ? { [timestampField[eventType]!]: occurredAt }
      : {}

    const statusPriority: string[] = [
      "complained", "bounced", "suppressed", "failed", "clicked", "opened", "delivered", "sent", "queued",
    ]
    const currentStatusIdx = statusPriority.indexOf(log.status as EmailEventType)
    const newStatusIdx = statusPriority.indexOf(eventType)
    const shouldUpdateStatus = newStatusIdx !== -1 && (currentStatusIdx === -1 || newStatusIdx < currentStatusIdx)

    try {
      await withDeadlockRetry(async () => {
        await prisma.$transaction(async (tx) => {
          // Upsert on logId_type_occurredAt: duplicate Resend deliveries become a no-op
          // (update: {}) instead of P2002 → HTTP 500 → retry loop.
          const upserted = await tx.emailEvent.upsert({
            where: {
              logId_type_occurredAt: {
                logId: log.id,
                type: eventType,
                occurredAt,
              },
            },
            create: {
              id: eventId,
              logId: log.id,
              type: eventType,
              occurredAt,
              metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined,
            },
            update: {},
          })

          // Update path reused the existing row (different id) — side effects already applied.
          if (upserted.id !== eventId) {
            return
          }

          await tx.emailLog.update({
            where: { id: log.id },
            data: {
              ...(shouldUpdateStatus && { status: eventType as never }),
              ...timestampUpdate,
            },
          })

          // Bounce é GLOBAL de propósito, ao contrário de `complained` logo
          // abaixo. Não é falta de escopo: um bounce permanente significa que a
          // caixa não existe, o que vale para qualquer remetente. Tratar como
          // sinal compartilhado evita que cada time redescubra o mesmo endereço
          // morto pagando com a própria reputação de domínio.
          //
          // Medido em 22/08/2026: 11.535 contatos (16,7% dos 69.094 marcados)
          // estão suprimidos por evidência de outro time, em 8 times. Escopar
          // por time devolveria esses endereços para envio e geraria uma onda
          // de re-bounce concentrada — decisão de produto foi manter global.
          //
          // O `shouldStampIsBouncedFromEventMetadata` já restringe a bounce
          // `Permanent` (ver lib/email/bounce-suppression.ts); soft bounce e
          // caixa cheia não carimbam.
          if (eventType === "bounced") {
            if (shouldStampIsBouncedFromEventMetadata(metadata)) {
              await tx.emailContact.updateMany({
                // Case-insensitive, não `toLowerCase()`: os leitores comparam
                // em lowercase, mas `EmailContact.email` é gravado como veio
                // (`createContacts` não normaliza). Forçar lowercase no filtro
                // deixaria de casar as linhas salvas com maiúsculas; comparar
                // insensitive pega os dois formatos.
                where: {
                  email: { equals: log.recipientEmail.trim(), mode: "insensitive" },
                },
                data: { isBounced: true },
              })
            }
          }
          if (eventType === "complained") {
            // Reclamação é por time: só listas de times que já enviaram para este destinatário.
            const teamIdsWithLogs = await tx.emailLog.findMany({
              where: { recipientEmail: log.recipientEmail },
              select: { teamId: true },
              distinct: ["teamId"],
            })

            for (const { teamId } of teamIdsWithLogs) {
              await tx.emailContact.updateMany({
                where: {
                  email: log.recipientEmail,
                  list: { teamId },
                },
                data: { isComplained: true, isUnsubscribed: true },
              })
            }
          }

          if (log.campaignId) {
            const campaignIncrements: Record<string, number> = {}
            if (eventType === "delivered" && !log.deliveredAt) campaignIncrements.totalDelivered = 1
            if (eventType === "opened" && !log.openedAt) campaignIncrements.totalOpened = 1
            if (eventType === "clicked" && !log.clickedAt) campaignIncrements.totalClicked = 1
            if (eventType === "bounced" && !log.bouncedAt) campaignIncrements.totalBounced = 1
            if (eventType === "complained" && !log.complainedAt) campaignIncrements.totalComplained = 1

            if (Object.keys(campaignIncrements).length > 0) {
              // lock order: campaign then dispatch (must match EmailCampaignUseCase completion)
              await tx.emailCampaign.update({
                where: { id: log.campaignId },
                data: Object.fromEntries(
                  Object.entries(campaignIncrements).map(([k, v]) => [k, { increment: v }])
                ),
              })

              if (log.dispatchId) {
                await tx.emailCampaignDispatch.update({
                  where: { id: log.dispatchId },
                  data: Object.fromEntries(
                    Object.entries(campaignIncrements).map(([k, v]) => [k, { increment: v }])
                  ),
                })
              }
            }
          }
        })
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          `[EmailLogRepository] Evento duplicado ignorado para log ${log.id}: ${eventType}`
        )
        return
      }
      throw error
    }
  }

  async createQueuedLog(input: CreateTeamEmailLogInput): Promise<string> {
    await prisma.emailLog.create({
      data: {
        id: input.id,
        teamId: input.teamId,
        campaignId: input.campaignId ?? null,
        dispatchId: input.dispatchId ?? null,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        subject: input.subject,
        category: input.category,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        status: "queued",
      },
    })
    return input.id
  }

  async createManyQueuedLogs(inputs: CreateTeamEmailLogInput[]): Promise<void> {
    if (inputs.length === 0) return
    await prisma.emailLog.createMany({
      data: inputs.map((input) => ({
        id: input.id,
        teamId: input.teamId,
        campaignId: input.campaignId ?? null,
        dispatchId: input.dispatchId ?? null,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        subject: input.subject,
        category: input.category,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        status: "queued" as const,
      })),
      skipDuplicates: true,
    })
  }

  async markManySent(entries: MarkSentEntry[], sentAt: Date): Promise<void> {
    if (entries.length === 0) return
    // Batch de updates em uma única round-trip (transação em lote do Prisma).
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.emailLog.update({
          where: { id: entry.logId },
          data: {
            resendEmailId: entry.resendEmailId,
            status: "sent",
            sentAt,
          },
        })
      )
    )
  }

  async markSent(logId: string, resendEmailId: string, sentAt: Date): Promise<void> {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        resendEmailId,
        status: "sent",
        sentAt,
      },
    })
  }

  async markFailed(
    logId: string,
    eventId: string,
    errorMessage: string,
    occurredAt: Date
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.emailLog.update({
        where: { id: logId },
        data: { status: "failed" },
      })

      await tx.emailEvent.create({
        data: {
          id: eventId,
          logId,
          type: "failed",
          occurredAt,
          metadata: { errorMessage },
        },
      })
    })
  }

  /**
   * Irmão de `markFailed` para recusa da **nossa** pré-validação, não do
   * provedor.
   *
   * A diferença importa para o usuário: `failed` é retentável (o Resend pode
   * ter recusado por rate limit, cota, erro transitório), enquanto `suppressed`
   * é terminal — typo de domínio, provedor morto, endereço genérico e bounce
   * anterior reprovam de novo na mesma regra determinística. Reenviar só queima
   * reputação de domínio e cota.
   *
   * `CAMPAIGN_RETRY_EXCLUDE_LOG_STATUSES` já trata `suppressed` como não
   * retentável; este método é o que finalmente escreve esse status.
   */
  async markSuppressed(
    logId: string,
    eventId: string,
    reason: string,
    occurredAt: Date
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.emailLog.update({
        where: { id: logId },
        data: { status: "suppressed" },
      })

      await tx.emailEvent.create({
        data: {
          id: eventId,
          logId,
          type: "suppressed",
          occurredAt,
          metadata: { reason },
        },
      })
    })
  }
}

export const emailLogRepository = new EmailLogRepository()

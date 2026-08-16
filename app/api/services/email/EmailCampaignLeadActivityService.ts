import { withPrismaRetry } from "@/app/api/infra/data/prisma"
import { createSemaphore } from "@/lib/async/create-semaphore"
import { createIdempotentLeadActivity } from "@/lib/lead-activities/createIdempotentLeadActivity"
import { resolveLeadIdFromRecipientEmail } from "@/lib/lead-activities/resolveLeadIdFromRecipientEmail"

export type RecordCampaignDispatchLeadActivityInput = {
  teamId: string
  campaignId: string
  dispatchId: string
  recipientEmail: string
  subject: string
  campaignName?: string | null
}

/**
 * `EmailCampaignUseCase.recordDispatchLeadActivities` dispara este
 * enriquecimento (leitura RadarProfile + escrita LeadActivity) sem aguardar
 * (fire-and-forget em relação ao lote de disparo, para não atrasar o envio
 * via Resend). Sem um limite compartilhado entre chamadas, lotes/disparos
 * concorrentes empilhavam consultas Prisma sem controle e esgotavam o pool
 * (`connection_limit=1`, P2024/P2028 — visto em produção nos disparos da
 * Willocks House). Este semáforo de módulo é o cap real de concorrência
 * (mesmo padrão de "backpressure por isolate" do webhook Resend); o limite
 * local `EMAIL_LOG_WRITE_CONCURRENCY_LIMIT` no use case continua existindo,
 * mas só limita uma chamada isolada — não protege contra o empilhamento
 * entre chamadas fire-and-forget diferentes.
 */
const MAX_CONCURRENT = Math.max(1, Number(process.env.EMAIL_CAMPAIGN_LEAD_ACTIVITY_MAX_CONCURRENT ?? 2))
const semaphore = createSemaphore(MAX_CONCURRENT)

export class EmailCampaignLeadActivityService {
  async recordDispatchForRecipient(input: RecordCampaignDispatchLeadActivityInput): Promise<void> {
    await semaphore.run(() =>
      withPrismaRetry(() => this.doRecordDispatchForRecipient(input), {
        label: "EmailCampaignLeadActivityService.recordDispatchForRecipient",
        retries: 1,
        delayMs: 150,
      })
    )
  }

  private async doRecordDispatchForRecipient(
    input: RecordCampaignDispatchLeadActivityInput
  ): Promise<void> {
    const leadId = await resolveLeadIdFromRecipientEmail(input.teamId, input.recipientEmail)
    if (!leadId) return

    const trimmedSubject = input.subject.trim() || "Sem assunto"
    const campaignName = input.campaignName?.trim() || undefined

    await createIdempotentLeadActivity({
      leadId,
      type: "email",
      body: `E-mail enviado: ${trimmedSubject}`,
      sourceKey: `email:dispatch:${input.dispatchId}`,
      createdBy: null,
      payload: {
        campaignId: input.campaignId,
        subject: trimmedSubject,
        dispatchId: input.dispatchId,
        ...(campaignName ? { campaignName } : {}),
      },
    })
  }
}

export const emailCampaignLeadActivityService = new EmailCampaignLeadActivityService()

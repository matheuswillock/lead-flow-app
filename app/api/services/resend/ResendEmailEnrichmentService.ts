import { assertResend } from "@/lib/email"
import { parseResendTrackingTags } from "@/lib/email/build-resend-tracking-tags"
import { teamEmailDispatchLogger } from "@/lib/email/team-email-dispatch-logger"
import type { EmailLogCategory } from "@prisma/client"

export type ResendEmailMetadata = {
  id: string
  to: string | string[]
  from?: string | null
  subject?: string | null
  tags?: Array<{ name: string; value: string }> | null
}

export interface IResendEmailEnrichmentService {
  fetchEmailMetadata(resendEmailId: string): Promise<ResendEmailMetadata | null>
  createOrphanTeamEmailLogFromResendEmail(
    resendEmailId: string,
    occurredAt: Date
  ): Promise<string | null>
}

export class ResendEmailEnrichmentService implements IResendEmailEnrichmentService {
  async fetchEmailMetadata(resendEmailId: string): Promise<ResendEmailMetadata | null> {
    try {
      const resend = assertResend()
      const { data, error } = await resend.emails.get(resendEmailId)

      if (error || !data) {
        console.error("[ResendEmailEnrichmentService] Falha ao buscar e-mail:", error)
        return null
      }

      return {
        id: data.id,
        to: data.to,
        from: data.from ?? null,
        subject: data.subject ?? null,
        tags: data.tags ?? null,
      }
    } catch (error) {
      console.error("[ResendEmailEnrichmentService] Erro inesperado:", error)
      return null
    }
  }

  async createOrphanTeamEmailLogFromResendEmail(
    resendEmailId: string,
    occurredAt: Date
  ): Promise<string | null> {
    const metadata = await this.fetchEmailMetadata(resendEmailId)
    if (!metadata) return null

    const parsedTags = parseResendTrackingTags(metadata.tags)
    if (!parsedTags.teamId) {
      console.info(
        "[ResendEmailEnrichmentService] E-mail órfão sem team_id nas tags:",
        resendEmailId
      )
      return null
    }

    const recipientEmail = Array.isArray(metadata.to) ? metadata.to[0] : metadata.to
    if (!recipientEmail) return null

    const logId = await teamEmailDispatchLogger.createQueuedTeamEmailLog({
      teamId: parsedTags.teamId,
      recipientEmail,
      subject: metadata.subject?.trim() || "Assunto não informado",
      category: (parsedTags.category ?? "other") as EmailLogCategory,
      sourceType: parsedTags.sourceType,
      sourceId: parsedTags.sourceId,
    })

    await teamEmailDispatchLogger.markTeamEmailLogSent(logId, resendEmailId)

    console.info(
      `[ResendEmailEnrichmentService] EmailLog órfão criado ${logId} para resendEmailId ${resendEmailId} em ${occurredAt.toISOString()}`
    )

    return logId
  }
}

export const resendEmailEnrichmentService = new ResendEmailEnrichmentService()

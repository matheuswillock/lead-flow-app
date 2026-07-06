import { assertResend } from "@/lib/email"
import { mergeResendTrackingTags, parseResendTrackingTags, type ResendTrackingTagsInput } from "@/lib/email/build-resend-tracking-tags"
import { teamEmailDispatchLogger } from "@/lib/email/team-email-dispatch-logger"
import type { EmailLogCategory } from "@prisma/client"

export type ResendEmailMetadata = {
  id: string
  to: string | string[]
  from?: string | null
  subject?: string | null
  tags?: ResendTrackingTagsInput
}

export interface IResendEmailEnrichmentService {
  fetchEmailMetadata(resendEmailId: string): Promise<ResendEmailMetadata | null>
  createOrphanTeamEmailLogFromResendEmail(
    resendEmailId: string,
    occurredAt: Date,
    tagsHint?: ResendTrackingTagsInput
  ): Promise<string | null>
}

export type ResendEmailMetadataResult =
  | { ok: true; metadata: ResendEmailMetadata }
  | { ok: false; rateLimited: boolean }

export class ResendEmailEnrichmentService implements IResendEmailEnrichmentService {
  async fetchEmailMetadata(resendEmailId: string): Promise<ResendEmailMetadata | null> {
    const result = await this.fetchEmailMetadataDetailed(resendEmailId)
    return result.ok ? result.metadata : null
  }

  async fetchEmailMetadataDetailed(resendEmailId: string): Promise<ResendEmailMetadataResult> {
    try {
      const resend = assertResend()
      const { data, error } = await resend.emails.get(resendEmailId)

      if (error || !data) {
        const message = error?.message ?? "unknown"
        const rateLimited =
          message.toLowerCase().includes("rate_limit") || message.includes("429")
        console.error("[ResendEmailEnrichmentService] Falha ao buscar e-mail:", error)
        return { ok: false, rateLimited }
      }

      return {
        ok: true,
        metadata: {
          id: data.id,
          to: data.to,
          from: data.from ?? null,
          subject: data.subject ?? null,
          tags: data.tags ?? null,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const rateLimited =
        message.toLowerCase().includes("rate_limit") || message.includes("429")
      console.error("[ResendEmailEnrichmentService] Erro inesperado:", error)
      return { ok: false, rateLimited }
    }
  }

  async createOrphanTeamEmailLogFromResendEmail(
    resendEmailId: string,
    occurredAt: Date,
    tagsHint?: ResendTrackingTagsInput
  ): Promise<string | null> {
    const fetchResult = await this.fetchEmailMetadataDetailed(resendEmailId)
    if (!fetchResult.ok) {
      if (fetchResult.rateLimited) {
        throw new Error("rate_limit_exceeded")
      }
      return null
    }

    const metadata = fetchResult.metadata

    const parsedTags = parseResendTrackingTags(mergeResendTrackingTags(tagsHint, metadata.tags))
    if (!parsedTags.teamId) {
      console.info(
        "[ResendEmailEnrichmentService] E-mail órfão sem team_id nas tags:",
        resendEmailId
      )
      return null
    }

    const recipientEmail = Array.isArray(metadata.to) ? metadata.to[0] : metadata.to
    if (!recipientEmail) return null

    const isCampaign = parsedTags.sourceType === "campaign" && !!parsedTags.sourceId

    const logId = await teamEmailDispatchLogger.createQueuedTeamEmailLog({
      teamId: parsedTags.teamId,
      recipientEmail,
      subject: metadata.subject?.trim() || "Assunto não informado",
      category: (parsedTags.category ?? "other") as EmailLogCategory,
      sourceType: parsedTags.sourceType,
      sourceId: parsedTags.sourceId,
      campaignId: isCampaign ? parsedTags.sourceId : null,
    })

    await teamEmailDispatchLogger.markTeamEmailLogSent(logId, resendEmailId)

    console.info(
      `[ResendEmailEnrichmentService] EmailLog órfão criado ${logId} para resendEmailId ${resendEmailId} em ${occurredAt.toISOString()}`
    )

    return logId
  }
}

export const resendEmailEnrichmentService = new ResendEmailEnrichmentService()

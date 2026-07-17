import { assertResend, buildResendBatchIdempotencyKey } from "@/lib/email"
import { buildBackofficeCampaignResendTags } from "@/lib/email/build-backoffice-resend-tags"
import {
  appendBackofficeCampaignUnsubscribeFooter,
  buildBackofficeCampaignUnsubscribeUrl,
  buildBackofficeListUnsubscribeHeaders,
} from "@/lib/email/backoffice-campaign-unsubscribe-footer"
import {
  backofficeEmailLogRepository,
  type BackofficeEmailLogRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailLog/BackofficeEmailLogRepository"
import type {
  DispatchBackofficeEmailCampaignBatchParams,
  DispatchBackofficeEmailCampaignBatchResult,
  IBackofficeEmailCampaignDispatchService,
} from "./IBackofficeEmailCampaignDispatchService"

const BATCH_SIZE = 50

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function parseResendBatchSendItems(
  batchData: Array<{ id?: string }> | { data?: Array<{ id?: string }> } | null | undefined
): Array<{ id?: string }> {
  if (batchData == null) return []
  if (Array.isArray(batchData)) return batchData
  return batchData.data ?? []
}

export class BackofficeEmailCampaignDispatchService implements IBackofficeEmailCampaignDispatchService {
  constructor(
    private readonly logRepository: BackofficeEmailLogRepository = backofficeEmailLogRepository
  ) {}

  async dispatchBatch(
    params: DispatchBackofficeEmailCampaignBatchParams
  ): Promise<DispatchBackofficeEmailCampaignBatchResult> {
    const resend = assertResend()
    const result: DispatchBackofficeEmailCampaignBatchResult = { sent: 0, failed: 0 }
    const chunks = chunkArray(params.recipients, BATCH_SIZE)

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]

      try {
        const payload = chunk.map((recipient) => {
          const unsubscribeUrl = buildBackofficeCampaignUnsubscribeUrl(
            recipient.contactId,
            params.campaignId
          )
          const html = appendBackofficeCampaignUnsubscribeFooter(params.html, unsubscribeUrl)

          return {
            from: params.from,
            ...(params.replyTo ? { replyTo: params.replyTo } : {}),
            to: recipient.email,
            subject: params.subject,
            html,
            headers: buildBackofficeListUnsubscribeHeaders(unsubscribeUrl),
            tags: buildBackofficeCampaignResendTags({
              campaignId: params.campaignId,
              dispatchId: params.dispatchId,
              contactId: recipient.contactId,
            }),
          }
        })

        const batchResult = await resend.batch.send(payload, {
          idempotencyKey: buildResendBatchIdempotencyKey(
            "backoffice-email-campaign",
            `${params.campaignId}/${params.dispatchNumber}/${chunkIndex}`
          ),
        })

        if (batchResult.error) {
          console.error(
            "[BackofficeEmailCampaignDispatchService][dispatchBatch] Erro da API Resend:",
            batchResult.error
          )
          await Promise.all(
            chunk.map((recipient) =>
              this.logRepository.markFailed(recipient.logId, batchResult.error?.message ?? "Erro no envio")
            )
          )
          result.failed += chunk.length
          continue
        }

        const items = parseResendBatchSendItems(batchResult.data)
        await Promise.all(
          chunk.map(async (recipient, idx) => {
            const item = items[idx]
            if (item?.id) {
              await this.logRepository.markSent(recipient.logId, item.id)
              result.sent += 1
            } else {
              await this.logRepository.markFailed(recipient.logId, "Sem resendEmailId na resposta")
              result.failed += 1
            }
          })
        )
      } catch (error) {
        console.error("[BackofficeEmailCampaignDispatchService][dispatchBatch]", error)
        await Promise.all(
          chunk.map((recipient) =>
            this.logRepository.markFailed(
              recipient.logId,
              error instanceof Error ? error.message : "Erro desconhecido"
            )
          )
        )
        result.failed += chunk.length
      }
    }

    return result
  }
}

export const backofficeEmailCampaignDispatchService = new BackofficeEmailCampaignDispatchService()

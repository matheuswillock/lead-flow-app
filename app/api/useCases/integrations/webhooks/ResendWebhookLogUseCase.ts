import type { ITeamWebhookEventLogRepository } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookEventLogRepository"
import { teamWebhookEventLogRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository"
import type { ITeamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookRepository"
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository"
import type { IWebhookHttpDeliveryService } from "@/app/api/services/teamWebhook/WebhookHttpDeliveryService"
import { webhookHttpDeliveryService } from "@/app/api/services/teamWebhook/WebhookHttpDeliveryService"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { Output } from "@/lib/output"

export class ResendWebhookLogUseCase {
  constructor(
    private readonly webhookRepository: Pick<
      ITeamWebhookRepository,
      "findByIdWithCtx" | "touchUsage"
    > = teamWebhookRepository,
    private readonly eventLogRepository: Pick<
      ITeamWebhookEventLogRepository,
      "findById" | "create"
    > = teamWebhookEventLogRepository,
    private readonly deliveryService: IWebhookHttpDeliveryService = webhookHttpDeliveryService,
  ) {}

  async execute(access: TeamAccess, webhookId: string, logId: string): Promise<Output> {
    const webhook = await this.webhookRepository.findByIdWithCtx(
      { profileId: access.profileId, teamId: access.teamId },
      webhookId,
    )

    if (!webhook || webhook.direction !== "outbound") {
      return new Output(false, [], ["Webhook de saída não encontrado"], null)
    }
    if (webhook.status === "disabled") {
      return new Output(false, [], ["Ative o webhook antes de reenviar"], null)
    }
    if (!webhook.targetUrl) {
      return new Output(false, [], ["URL de destino não configurada"], null)
    }

    const originalLog = await this.eventLogRepository.findById({
      id: logId,
      webhookId,
      teamId: access.teamId,
    })
    if (!originalLog || originalLog.direction !== "outbound") {
      return new Output(false, [], ["Log de webhook não encontrado"], null)
    }
    if (originalLog.requestPayload === null) {
      return new Output(false, [], ["Este registro não possui payload para reenvio"], null)
    }

    const result = await this.deliveryService.deliver({
      targetUrl: webhook.targetUrl,
      preset: webhook.destinationPreset ?? "generic",
      body: originalLog.requestPayload,
    })

    await this.eventLogRepository.create({
      teamId: access.teamId,
      webhookId,
      direction: "outbound",
      result: result.ok ? "success" : "failure",
      eventKey: originalLog.eventKey,
      method: "POST",
      endpoint: webhook.targetUrl,
      statusCode: result.statusCode,
      requestPayload: originalLog.requestPayload,
      responsePayload: result.responseBody,
      errorMessage: result.errorMessage,
    })
    await this.webhookRepository.touchUsage(webhookId, result.ok)

    return new Output(true, ["Tentativa de reenvio registrada"], [], {
      ok: result.ok,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })
  }
}

export const resendWebhookLogUseCase = new ResendWebhookLogUseCase()

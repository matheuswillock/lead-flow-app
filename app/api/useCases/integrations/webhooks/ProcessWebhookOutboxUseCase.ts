import { Output } from "@/lib/output";
import { teamWebhookOutboxRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { teamWebhookEventLogRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository";
import { webhookHttpDeliveryService } from "@/app/api/services/teamWebhook/WebhookHttpDeliveryService";
import { wrapOutboundPayloadForPreset } from "@/lib/webhooks/webhookPayloadPresets";
import {
  computeWebhookOutboxNextAttemptAt,
  shouldRetryWebhookOutbox,
} from "@/lib/webhooks/webhookOutboxBackoff";
import type { OutboundWebhookEnvelope } from "@/lib/webhooks/webhookPayloadPresets";

const BATCH_SIZE = 25;

export class ProcessWebhookOutboxUseCase {
  async execute(): Promise<Output> {
    try {
      const claimed = await teamWebhookOutboxRepository.claimDue(BATCH_SIZE);
      let delivered = 0;
      let failed = 0;
      let paused = 0;

      for (const row of claimed) {
        const webhook = await teamWebhookRepository.findForDelivery(row.webhookId);

        if (!webhook || webhook.status !== "active" || !webhook.targetUrl) {
          await teamWebhookOutboxRepository.markFailed(
            row.id,
            row.attemptCount + 1,
            null,
            "Webhook inativo ou sem URL"
          );
          failed += 1;
          continue;
        }

        const envelope = row.payload as unknown as OutboundWebhookEnvelope;
        const body = wrapOutboundPayloadForPreset(
          webhook.destinationPreset ?? "generic",
          envelope
        );

        const result = await webhookHttpDeliveryService.deliver({
          targetUrl: webhook.targetUrl,
          preset: webhook.destinationPreset ?? "generic",
          body,
        });

        await teamWebhookEventLogRepository.create({
          teamId: row.teamId,
          webhookId: row.webhookId,
          direction: "outbound",
          result: result.ok ? "success" : "failure",
          eventKey: row.eventKey,
          method: "POST",
          endpoint: webhook.targetUrl,
          statusCode: result.statusCode,
          requestPayload: body,
          responsePayload: result.responseBody,
          errorMessage: result.errorMessage,
        });

        if (result.ok) {
          await teamWebhookOutboxRepository.markDelivered(row.id);
          await teamWebhookRepository.resetFailureStreak(row.webhookId);
          delivered += 1;
          continue;
        }

        const attemptCount = row.attemptCount + 1;
        const updated = await teamWebhookRepository.incrementFailureStreak(row.webhookId);

        if (updated.failureStreak >= updated.failureThreshold) {
          await teamWebhookRepository.markPausedByFailures(row.webhookId);
          await teamWebhookOutboxRepository.cancelPendingForWebhook(row.webhookId);
          await this.notifyAutoPaused(webhook);
          paused += 1;
        }

        const nextAttemptAt = shouldRetryWebhookOutbox(attemptCount)
          ? computeWebhookOutboxNextAttemptAt(attemptCount)
          : null;

        await teamWebhookOutboxRepository.markFailed(
          row.id,
          attemptCount,
          nextAttemptAt,
          result.errorMessage ?? "Falha na entrega"
        );
        failed += 1;
      }

      console.info("[TeamWebhookOutbox][POST] Processamento concluído", {
        claimed: claimed.length,
        delivered,
        failed,
        paused,
      });

      return new Output(true, ["Outbox processado"], [], {
        claimed: claimed.length,
        delivered,
        failed,
        paused,
      });
    } catch (error) {
      console.error("[TeamWebhookOutbox][POST] Erro:", error);
      return new Output(false, [], ["Erro ao processar outbox de webhooks"], null);
    }
  }

  private async notifyAutoPaused(webhook: {
    id: string;
    teamId: string;
    name: string;
    updatedByProfileId: string;
  }): Promise<void> {
    try {
      const masterId = await teamWebhookRepository.findTeamMasterId(webhook.teamId);
      const recipientProfileId = masterId ?? webhook.updatedByProfileId;
      await teamWebhookRepository.createAutoPausedNotification({
        recipientProfileId,
        teamId: webhook.teamId,
        webhookId: webhook.id,
        webhookName: webhook.name,
      });
    } catch (error) {
      console.error("[TeamWebhookOutbox] Falha ao notificar auto-pause:", error);
    }
  }
}

export const processWebhookOutboxUseCase = new ProcessWebhookOutboxUseCase();

import type { TeamWebhookDestinationPreset } from "@prisma/client";
import { Output } from "@/lib/output";
import {
  teamWebhookOutboxRepository,
  type TeamWebhookOutboxRepository,
} from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository";
import type { TeamWebhookOutboxClaimRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookOutboxRepository";
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
const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 16;

function resolveTeamWebhookOutboxConcurrency(): number {
  const raw = process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY;
  if (!raw) return DEFAULT_CONCURRENCY;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CONCURRENCY;
  return Math.min(parsed, MAX_CONCURRENCY);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type RowOutcome = "delivered" | "failed" | "paused";

export class ProcessWebhookOutboxUseCase {
  constructor(
    private readonly outboxRepository: Pick<
      TeamWebhookOutboxRepository,
      | "claimDue"
      | "markDelivered"
      | "markFailed"
      | "requeueIfProcessing"
      | "cancelPendingForWebhook"
    > = teamWebhookOutboxRepository,
    private readonly webhookRepository: typeof teamWebhookRepository = teamWebhookRepository,
    private readonly eventLogRepository: typeof teamWebhookEventLogRepository = teamWebhookEventLogRepository,
    private readonly deliveryService: typeof webhookHttpDeliveryService = webhookHttpDeliveryService
  ) {}

  async execute(): Promise<Output> {
    let claimedIds: string[] = [];
    const concurrency = resolveTeamWebhookOutboxConcurrency();
    try {
      const claimed = await this.outboxRepository.claimDue(BATCH_SIZE);
      claimedIds = claimed.map((row) => row.id);
      let delivered = 0;
      let failed = 0;
      let paused = 0;

      for (const chunk of chunkArray(claimed, concurrency)) {
        await Promise.all(
          chunk.map(async (row) => {
            const outcome = await this.processRow(row);
            if (outcome === "delivered") delivered += 1;
            if (outcome === "failed" || outcome === "paused") failed += 1;
            if (outcome === "paused") paused += 1;
          })
        );
      }

      console.info("[TeamWebhookOutbox][POST] Processamento concluído", {
        claimed: claimed.length,
        delivered,
        failed,
        paused,
        concurrency,
      });

      return new Output(true, ["Outbox processado"], [], {
        claimed: claimed.length,
        delivered,
        failed,
        paused,
        concurrency,
      });
    } catch (error) {
      console.error("[TeamWebhookOutbox][POST] Erro:", error);
      await this.outboxRepository.requeueIfProcessing(claimedIds).catch((requeueError) => {
        console.error("[TeamWebhookOutbox][POST] Falha ao reenfileirar lote:", requeueError);
      });
      return new Output(false, [], ["Erro ao processar outbox de webhooks"], null);
    }
  }

  private async processRow(row: TeamWebhookOutboxClaimRow): Promise<RowOutcome> {
    try {
      const webhook = await this.webhookRepository.findForDelivery(row.webhookId);

      if (!webhook || webhook.status !== "active" || !webhook.targetUrl) {
        await this.outboxRepository.markFailed(
          row.id,
          row.attemptCount + 1,
          null,
          "Webhook inativo ou sem URL"
        );
        return "failed";
      }

      const envelope = row.payload as unknown as OutboundWebhookEnvelope;
      const preset: TeamWebhookDestinationPreset = webhook.destinationPreset ?? "generic";
      const body = wrapOutboundPayloadForPreset(preset, envelope);

      const result = await this.deliveryService.deliver({
        targetUrl: webhook.targetUrl,
        preset,
        body,
      });

      await this.eventLogRepository.create({
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
        await this.outboxRepository.markDelivered(row.id);
        await this.webhookRepository.resetFailureStreak(row.webhookId);
        return "delivered";
      }

      const attemptCount = row.attemptCount + 1;
      const updated = await this.webhookRepository.incrementFailureStreak(row.webhookId);

      let wasPaused = false;
      if (updated.failureStreak >= updated.failureThreshold) {
        await this.webhookRepository.markPausedByFailures(row.webhookId);
        await this.outboxRepository.cancelPendingForWebhook(row.webhookId);
        await this.notifyAutoPaused(webhook);
        wasPaused = true;
      }

      const nextAttemptAt = shouldRetryWebhookOutbox(attemptCount)
        ? computeWebhookOutboxNextAttemptAt(attemptCount)
        : null;

      await this.outboxRepository.markFailed(
        row.id,
        attemptCount,
        nextAttemptAt,
        result.errorMessage ?? "Falha na entrega"
      );
      return wasPaused ? "paused" : "failed";
    } catch (rowError) {
      console.error("[TeamWebhookOutbox][POST] Falha ao processar item:", {
        outboxId: row.id,
        error: rowError,
      });
      await this.outboxRepository.requeueIfProcessing([row.id]).catch((requeueError) => {
        console.error("[TeamWebhookOutbox][POST] Falha ao reenfileirar item:", requeueError);
      });
      return "failed";
    }
  }

  private async notifyAutoPaused(webhook: {
    id: string;
    teamId: string;
    name: string;
    updatedByProfileId: string;
  }): Promise<void> {
    try {
      const masterId = await this.webhookRepository.findTeamMasterId(webhook.teamId);
      const recipientProfileId = masterId ?? webhook.updatedByProfileId;
      await this.webhookRepository.createAutoPausedNotification({
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

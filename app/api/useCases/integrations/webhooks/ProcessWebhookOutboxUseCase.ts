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
import { decryptWebhookSigningSecret } from "@/lib/webhooks/webhookSigningSecurity";
import {
  computeWebhookOutboxNextAttemptAt,
  shouldRetryWebhookOutbox,
} from "@/lib/webhooks/webhookOutboxBackoff";
import type { OutboundWebhookEnvelope } from "@/lib/webhooks/webhookPayloadPresets";

const BATCH_SIZE = 25;
const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 16;
const MISSING_SIGNING_SECRET_BASE_DELAY_MS = 15 * 60 * 1000;
const MISSING_SIGNING_SECRET_MAX_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * Achado da 3ª revisão final (Opus): reagendar TODO evento "sem segredo" no mesmo
 * intervalo fixo (15min) para sempre significa que um único webhook antigo com fila
 * acumulada volta a vencer a cada ciclo do cron (`* / 5 * * * *`, `BATCH_SIZE=25` por
 * ciclo) e disputa espaço com webhooks já assinados de TODAS as contas — com mais de
 * ~75 eventos parados, ele passa a monopolizar a capacidade global do outbox. O
 * atraso cresce exponencialmente a cada ciclo (mesmo evento, sem contar pro
 * failureStreak nem pro TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS) até um teto de 24h, então um
 * webhook parado converge para ocupar no máximo 1 claim por dia em vez de 1 a cada
 * 15min — sem nunca virar dead-letter, e sem nunca deixar de tentar de vez.
 */
function computeMissingSigningSecretRetryDelayMs(deferCount: number): number {
  const delay = MISSING_SIGNING_SECRET_BASE_DELAY_MS * 2 ** Math.max(0, deferCount - 1);
  return Math.min(delay, MISSING_SIGNING_SECRET_MAX_DELAY_MS);
}

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
      const signingSecret = webhook.signingSecretCipher
        ? decryptWebhookSigningSecret(webhook.signingSecretCipher)
        : null;

      if (webhook.signingSecretCipher && !signingSecret) {
        // Achado de code review (Codex, PR #1220): cifra PRESENTE mas ilegível (chave de
        // cifra do servidor trocada, dado corrompido) é um bug de configuração real, não
        // um estado esperado — nunca sai sem assinatura em silêncio, dead-letter imediato
        // e conta para o auto-pause, do mesmo jeito que um webhook sem URL de destino.
        const errorMessage = "Segredo de assinatura ilegível — entrega bloqueada por segurança";
        await this.eventLogRepository.create({
          teamId: row.teamId,
          webhookId: row.webhookId,
          direction: "outbound",
          result: "failure",
          eventKey: row.eventKey,
          method: "POST",
          endpoint: webhook.targetUrl,
          statusCode: null,
          requestPayload: body,
          responsePayload: null,
          errorMessage,
        });

        const updated = await this.webhookRepository.incrementFailureStreak(row.webhookId);
        let wasPausedForBadSecret = false;
        if (updated.failureStreak >= updated.failureThreshold) {
          await this.webhookRepository.markPausedByFailures(row.webhookId);
          await this.outboxRepository.cancelPendingForWebhook(row.webhookId);
          await this.notifyAutoPaused(webhook);
          wasPausedForBadSecret = true;
        }
        await this.outboxRepository.markFailed(row.id, row.attemptCount + 1, null, errorMessage);
        return wasPausedForBadSecret ? "paused" : "failed";
      }

      if (!signingSecret) {
        // Achados acumulados de 2 revisões finais (Opus) sobre este mesmo ramo:
        // (1) reaproveitar o backoff de falha HTTP comum ainda esgotava
        // TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS (~81min) e dead-letterava/auto-pausava um
        // webhook legado sozinho; (2) um intervalo FIXO de reagendamento (15min pra
        // sempre) deixava um único webhook parado monopolizar a capacidade global do
        // cron (a cada 5min, BATCH_SIZE=25 — ver vercel.json) e atrasar sem teto a
        // entrega de webhooks já assinados de TODAS as contas. Cifra NUNCA gravada
        // (`signingSecretCipher` nulo, estado de TODO webhook de saída criado antes
        // desta migration) não é uma falha de ENTREGA: é um estado de CONFIGURAÇÃO da
        // conta. Por isso este evento NUNCA conta para o failureStreak e NUNCA vira
        // dead-letter só por falta de segredo — mas o reagendamento agora cresce
        // exponencialmente (15min → ... → teto de 24h, ver
        // computeMissingSigningSecretRetryDelayMs) para que um webhook parado convirja
        // a ocupar no máximo ~1 claim/dia, não 1 a cada 15min. Depois da rotação —
        // visível na tela de detalhe —, a próxima claim decifra normalmente e a
        // entrega HTTP real volta a valer o backoff/streak padrão.
        const errorMessage =
          "Segredo de assinatura não configurado — entrega em espera até a rotação";
        await this.eventLogRepository.create({
          teamId: row.teamId,
          webhookId: row.webhookId,
          direction: "outbound",
          result: "failure",
          eventKey: row.eventKey,
          method: "POST",
          endpoint: webhook.targetUrl,
          statusCode: null,
          requestPayload: body,
          responsePayload: null,
          errorMessage,
        });

        // attemptCount aqui é reaproveitado só para calcular o backoff exponencial
        // deste caso específico — nunca é comparado contra
        // TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS nem usado para decidir dead-letter/streak
        // (ver função acima).
        const deferCount = row.attemptCount + 1;
        const nextAttemptAt = new Date(
          Date.now() + computeMissingSigningSecretRetryDelayMs(deferCount)
        );
        await this.outboxRepository.markFailed(row.id, deferCount, nextAttemptAt, errorMessage);
        return "failed";
      }

      const result = await this.deliveryService.deliver({
        targetUrl: webhook.targetUrl,
        preset,
        body,
        signingSecret,
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
      const willRetry = shouldRetryWebhookOutbox(attemptCount);
      const nextAttemptAt = willRetry ? computeWebhookOutboxNextAttemptAt(attemptCount) : null;

      // DA3/W13 — o contador de falha é por EVENTO, não por tentativa HTTP: só
      // incrementa quando este evento já esgotou as TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS
      // tentativas (nextAttemptAt nulo, o outbox vira dead-letter para esta linha).
      let wasPaused = false;
      if (!willRetry) {
        const updated = await this.webhookRepository.incrementFailureStreak(row.webhookId);
        if (updated.failureStreak >= updated.failureThreshold) {
          await this.webhookRepository.markPausedByFailures(row.webhookId);
          await this.outboxRepository.cancelPendingForWebhook(row.webhookId);
          await this.notifyAutoPaused(webhook);
          wasPaused = true;
        }
      }

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

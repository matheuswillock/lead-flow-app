import type { Prisma, TeamWebhookEventKey, TeamWebhookOutboxStatus } from "@prisma/client";

export type EnqueueTeamWebhookOutboxInput = {
  teamId: string;
  webhookId: string;
  eventKey: TeamWebhookEventKey;
  payload: Prisma.InputJsonValue;
};

export type TeamWebhookOutboxClaimRow = {
  id: string;
  teamId: string;
  webhookId: string;
  eventKey: TeamWebhookEventKey;
  payload: Prisma.JsonValue;
  status: TeamWebhookOutboxStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  /**
   * Achado da 4ª revisão final (Opus, PR #1220): usado só para calcular o backoff de
   * "segredo de assinatura não configurado" a partir do tempo real de espera, sem
   * reaproveitar `attemptCount` — ver `ProcessWebhookOutboxUseCase.processRow`. Coluna
   * já existente em `TeamWebhookOutbox` (`createdAt`); sem migration nova.
   */
  createdAt: Date;
};

export interface ITeamWebhookOutboxRepository {
  enqueue(input: EnqueueTeamWebhookOutboxInput): Promise<void>;
  claimDue(limit: number): Promise<TeamWebhookOutboxClaimRow[]>;
  requeueIfProcessing(ids: string[]): Promise<void>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string, attemptCount: number, nextAttemptAt: Date | null, lastError: string): Promise<void>;
  cancelPendingForWebhook(webhookId: string): Promise<void>;
}

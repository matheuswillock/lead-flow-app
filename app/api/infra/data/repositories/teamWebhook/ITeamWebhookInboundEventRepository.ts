import type { Prisma, TeamWebhookInboundEventStatus } from "@prisma/client";

export type ReceiveInboundEventInput = {
  webhookId: string;
  teamId: string;
  contractVersion: number;
  /** `Idempotency-Key` (ou `external_id`); `null` = cada requisição é um evento novo. */
  idempotencyKey: string | null;
  /** SHA-256 do corpo bruto. */
  requestHash: string;
  payload: Prisma.InputJsonValue;
};

export type ReceiveInboundEventResult = {
  eventId: string;
  /** `false` quando a mesma chave já existia: devolve o evento original sem reprocessar. */
  created: boolean;
  /** Mesma chave com corpo diferente. */
  idempotencyKeyReused: boolean;
};

export type InboundEventRow = {
  id: string;
  webhookId: string;
  teamId: string;
  contractVersion: number;
  idempotencyKey: string | null;
  requestHash: string;
  payload: Prisma.JsonValue;
  status: TeamWebhookInboundEventStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  resultCode: string | null;
  leadId: string | null;
  result: Prisma.JsonValue | null;
  idempotencyKeyReused: boolean;
  lastError: string | null;
  receivedAt: Date;
  processedAt: Date | null;
};

export type InboundEventOutcome = {
  resultCode: string;
  leadId?: string | null;
  result?: Prisma.InputJsonValue | null;
};

export interface ITeamWebhookInboundEventRepository {
  /** Grava o evento recebido, aplicando a idempotência pela unique `(webhookId, idempotencyKey)`. */
  receive(input: ReceiveInboundEventInput): Promise<ReceiveInboundEventResult>;
  /** Claim atômico de um evento `pending` (uso imediato, logo após o 202). */
  claimById(eventId: string): Promise<InboundEventRow | null>;
  /** Claim em lote dos eventos vencidos (cron de retry), `FOR UPDATE SKIP LOCKED`. */
  claimDue(limit: number): Promise<InboundEventRow[]>;
  markProcessed(eventId: string, outcome: InboundEventOutcome): Promise<void>;
  /** `nextAttemptAt === null` = dead-letter (`failed`). */
  markFailed(eventId: string, attemptCount: number, nextAttemptAt: Date | null, lastError: string): Promise<void>;
  /** Eventos terminais mais antigos que a retenção (7 dias, D8). Devolve quantos apagou. */
  purgeTerminalOlderThan(cutoff: Date): Promise<number>;
  listForWebhook(
    ctx: { teamId: string; webhookId: string },
    params: { page: number; pageSize: number },
  ): Promise<{ items: InboundEventRow[]; total: number }>;
}

import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  InboundEventOutcome,
  InboundEventRow,
  ITeamWebhookInboundEventRepository,
  ReceiveInboundEventInput,
  ReceiveInboundEventResult,
} from "./ITeamWebhookInboundEventRepository";

/** Evento preso em `processing` além disto é tratado como lease abandonado (worker morreu). */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

const CLAIM_RETURNING = Prisma.sql`
  e.id,
  e."webhookId" AS "webhookId",
  e."teamId" AS "teamId",
  e."contractVersion" AS "contractVersion",
  e."idempotencyKey" AS "idempotencyKey",
  e."requestHash" AS "requestHash",
  e.payload,
  e.status,
  e."attemptCount" AS "attemptCount",
  e."nextAttemptAt" AS "nextAttemptAt",
  e."resultCode" AS "resultCode",
  e."leadId" AS "leadId",
  e.result,
  e."idempotencyKeyReused" AS "idempotencyKeyReused",
  e."lastError" AS "lastError",
  e."receivedAt" AS "receivedAt",
  e."processedAt" AS "processedAt"
`;

type RawEventRow = Omit<InboundEventRow, "attemptCount"> & { attemptCount: number | bigint };

function toRow(row: RawEventRow): InboundEventRow {
  return { ...row, attemptCount: Number(row.attemptCount) };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class TeamWebhookInboundEventRepository implements ITeamWebhookInboundEventRepository {
  async receive(input: ReceiveInboundEventInput): Promise<ReceiveInboundEventResult> {
    try {
      const created = await prisma.teamWebhookInboundEvent.create({
        data: {
          webhookId: input.webhookId,
          teamId: input.teamId,
          contractVersion: input.contractVersion,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          payload: input.payload,
          status: "pending",
        },
        select: { id: true },
      });
      return { eventId: created.id, created: true, idempotencyKeyReused: false };
    } catch (error) {
      // Sem chave não há unique para violar; qualquer outro erro é falha real e propaga,
      // para o chamador responder 5xx em vez de aceitar um evento que não foi gravado.
      if (!input.idempotencyKey || !isUniqueViolation(error)) throw error;

      const existing = await prisma.teamWebhookInboundEvent.findUnique({
        where: {
          webhookId_idempotencyKey: { webhookId: input.webhookId, idempotencyKey: input.idempotencyKey },
        },
        select: { id: true, requestHash: true },
      });
      if (!existing) throw error;

      const reused = existing.requestHash !== input.requestHash;
      if (reused) {
        await prisma.teamWebhookInboundEvent.update({
          where: { id: existing.id },
          data: { idempotencyKeyReused: true },
        });
      }
      return { eventId: existing.id, created: false, idempotencyKeyReused: reused };
    }
  }

  async claimById(eventId: string): Promise<InboundEventRow | null> {
    const claimed = await prisma.teamWebhookInboundEvent.updateMany({
      where: { id: eventId, status: "pending" },
      data: { status: "processing", lockedAt: new Date(), attemptCount: { increment: 1 } },
    });
    if (claimed.count === 0) return null;

    const rows = await prisma.$queryRaw<RawEventRow[]>`
      SELECT ${CLAIM_RETURNING}
      FROM corretor_studio_team_webhook_inbound_events e
      WHERE e.id = ${eventId}::uuid
    `;
    return rows[0] ? toRow(rows[0]) : null;
  }

  async claimDue(limit: number): Promise<InboundEventRow[]> {
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0) return [];

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

    // Lease abandonado: o worker morreu no meio do processamento.
    await prisma.teamWebhookInboundEvent.updateMany({
      where: { status: "processing", lockedAt: { lt: staleBefore } },
      data: { status: "pending", lastError: "Lease de processamento expirado; reenfileirado", nextAttemptAt: now },
    });

    const rows = await prisma.$queryRaw<RawEventRow[]>`
      WITH claimed AS (
        SELECT id
        FROM corretor_studio_team_webhook_inbound_events
        WHERE status = 'pending'::team_webhook_inbound_event_status
          AND "nextAttemptAt" <= ${now}
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE corretor_studio_team_webhook_inbound_events e
      SET
        status = 'processing'::team_webhook_inbound_event_status,
        "lockedAt" = ${now},
        "attemptCount" = e."attemptCount" + 1
      FROM claimed
      WHERE e.id = claimed.id
      RETURNING ${CLAIM_RETURNING}
    `;
    return rows.map(toRow);
  }

  async markProcessed(eventId: string, outcome: InboundEventOutcome): Promise<void> {
    await prisma.teamWebhookInboundEvent.update({
      where: { id: eventId },
      data: {
        status: "processed",
        resultCode: outcome.resultCode,
        leadId: outcome.leadId ?? null,
        result: outcome.result ?? Prisma.JsonNull,
        lastError: null,
        lockedAt: null,
        processedAt: new Date(),
      },
    });
  }

  async markFailed(
    eventId: string,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string,
  ): Promise<void> {
    await prisma.teamWebhookInboundEvent.update({
      where: { id: eventId },
      data: {
        status: nextAttemptAt ? "pending" : "failed",
        attemptCount,
        nextAttemptAt: nextAttemptAt ?? new Date(),
        lastError,
        lockedAt: null,
        ...(nextAttemptAt ? {} : { processedAt: new Date() }),
      },
    });
  }

  async purgeTerminalOlderThan(cutoff: Date): Promise<number> {
    const deleted = await prisma.teamWebhookInboundEvent.deleteMany({
      where: { status: { in: ["processed", "failed"] }, receivedAt: { lt: cutoff } },
    });
    return deleted.count;
  }

  async listForWebhook(
    ctx: { teamId: string; webhookId: string },
    params: { page: number; pageSize: number },
  ): Promise<{ items: InboundEventRow[]; total: number }> {
    const where = { teamId: ctx.teamId, webhookId: ctx.webhookId };
    const [items, total] = await Promise.all([
      prisma.teamWebhookInboundEvent.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (Math.max(1, params.page) - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.teamWebhookInboundEvent.count({ where }),
    ]);
    return { items, total };
  }
}

export const teamWebhookInboundEventRepository = new TeamWebhookInboundEventRepository();

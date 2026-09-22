import { prisma } from "@/app/api/infra/data/prisma";
import type { Prisma, TeamWebhookEventKey, TeamWebhookOutboxStatus } from "@prisma/client";
import type {
  EnqueueTeamWebhookOutboxInput,
  ITeamWebhookOutboxRepository,
  TeamWebhookOutboxClaimRow,
} from "./ITeamWebhookOutboxRepository";

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

type ClaimRawRow = {
  id: string;
  teamId: string;
  webhookId: string;
  eventKey: TeamWebhookEventKey;
  payload: Prisma.JsonValue;
  status: TeamWebhookOutboxStatus;
  attemptCount: number | bigint;
  nextAttemptAt: Date;
};

export class TeamWebhookOutboxRepository implements ITeamWebhookOutboxRepository {
  async enqueue(input: EnqueueTeamWebhookOutboxInput): Promise<void> {
    await prisma.teamWebhookOutbox.create({
      data: {
        teamId: input.teamId,
        webhookId: input.webhookId,
        eventKey: input.eventKey,
        payload: input.payload,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: new Date(),
      },
    });
  }

  /**
   * Claim atômico via `FOR UPDATE SKIP LOCKED` (padrão D9).
   * Evita N `updateMany` sequenciais e corrida entre crons sobrepostos.
   */
  async claimDue(limit: number): Promise<TeamWebhookOutboxClaimRow[]> {
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0) return [];

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

    // Recover rows stranded in processing after crashes / mid-batch failures.
    await prisma.teamWebhookOutbox.updateMany({
      where: {
        status: "processing",
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: "pending",
        lastError: "Lease de processamento expirado; reenfileirado",
        nextAttemptAt: now,
      },
    });

    const rows = await prisma.$queryRaw<ClaimRawRow[]>`
      WITH claimed AS (
        SELECT id
        FROM corretor_studio_team_webhook_outbox
        WHERE status = 'pending'::team_webhook_outbox_status
          AND "nextAttemptAt" <= ${now}
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE corretor_studio_team_webhook_outbox o
      SET
        status = 'processing'::team_webhook_outbox_status,
        "updatedAt" = ${now}
      FROM claimed
      WHERE o.id = claimed.id
      RETURNING
        o.id,
        o."teamId" AS "teamId",
        o."webhookId" AS "webhookId",
        o."eventKey" AS "eventKey",
        o.payload,
        o.status,
        o."attemptCount" AS "attemptCount",
        o."nextAttemptAt" AS "nextAttemptAt"
    `;

    return rows.map((row) => ({
      id: row.id,
      teamId: row.teamId,
      webhookId: row.webhookId,
      eventKey: row.eventKey,
      payload: row.payload,
      status: row.status,
      attemptCount: Number(row.attemptCount),
      nextAttemptAt: row.nextAttemptAt,
    }));
  }

  async requeueIfProcessing(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.teamWebhookOutbox.updateMany({
      where: {
        id: { in: ids },
        status: "processing",
      },
      data: {
        status: "pending",
        nextAttemptAt: new Date(),
        lastError: "Reenfileirado após falha no processamento do lote",
      },
    });
  }

  async markDelivered(id: string): Promise<void> {
    await prisma.teamWebhookOutbox.update({
      where: { id },
      data: { status: "delivered", lastError: null },
    });
  }

  async markFailed(
    id: string,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string
  ): Promise<void> {
    await prisma.teamWebhookOutbox.update({
      where: { id },
      data: {
        attemptCount,
        lastError,
        status: nextAttemptAt ? "pending" : "failed",
        nextAttemptAt: nextAttemptAt ?? new Date(),
      },
    });
  }

  async cancelPendingForWebhook(webhookId: string): Promise<void> {
    await prisma.teamWebhookOutbox.updateMany({
      where: {
        webhookId,
        status: { in: ["pending", "processing"] },
      },
      data: { status: "cancelled" },
    });
  }
}

export const teamWebhookOutboxRepository = new TeamWebhookOutboxRepository();

import { prisma } from "@/app/api/infra/data/prisma";
import type {
  EnqueueTeamWebhookOutboxInput,
  ITeamWebhookOutboxRepository,
  TeamWebhookOutboxClaimRow,
} from "./ITeamWebhookOutboxRepository";

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

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

  async claimDue(limit: number): Promise<TeamWebhookOutboxClaimRow[]> {
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

    const due = await prisma.teamWebhookOutbox.findMany({
      where: {
        status: "pending",
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: {
        id: true,
        teamId: true,
        webhookId: true,
        eventKey: true,
        payload: true,
        status: true,
        attemptCount: true,
        nextAttemptAt: true,
      },
    });

    if (due.length === 0) {
      return [];
    }

    const claimed: TeamWebhookOutboxClaimRow[] = [];
    for (const row of due) {
      const updated = await prisma.teamWebhookOutbox.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "processing", updatedAt: new Date() },
      });
      if (updated.count === 1) {
        claimed.push(row);
      }
    }

    return claimed;
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

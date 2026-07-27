import { prisma } from "@/app/api/infra/data/prisma";
import type {
  EnqueueTeamWebhookOutboxInput,
  ITeamWebhookOutboxRepository,
  TeamWebhookOutboxClaimRow,
} from "./ITeamWebhookOutboxRepository";

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

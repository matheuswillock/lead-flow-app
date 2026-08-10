import { prisma } from "@/app/api/infra/data/prisma";
import type {
  EmailContactRadarSyncOutboxClaimRow,
  IEmailContactRadarSyncOutboxRepository,
  UpsertRadarSyncOutboxEntry,
} from "./IEmailContactRadarSyncOutboxRepository";

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

export class EmailContactRadarSyncOutboxRepository
  implements IEmailContactRadarSyncOutboxRepository
{
  async upsertPendingForContacts(entries: UpsertRadarSyncOutboxEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const now = new Date();
    await Promise.all(
      entries.map((entry) =>
        prisma.emailContactRadarSyncOutbox.upsert({
          where: { emailContactId: entry.emailContactId },
          create: {
            emailContactId: entry.emailContactId,
            teamId: entry.teamId,
            emailImportJobId: entry.emailImportJobId,
            status: "pending",
            attemptCount: 0,
            nextAttemptAt: now,
          },
          update: {
            teamId: entry.teamId,
            emailImportJobId: entry.emailImportJobId,
            status: "pending",
            attemptCount: 0,
            nextAttemptAt: now,
            lastError: null,
          },
        })
      )
    );
  }

  async claimDue(limit: number): Promise<EmailContactRadarSyncOutboxClaimRow[]> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

    await prisma.emailContactRadarSyncOutbox.updateMany({
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

    const due = await prisma.emailContactRadarSyncOutbox.findMany({
      where: {
        status: "pending",
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: {
        id: true,
        emailContactId: true,
        teamId: true,
        emailImportJobId: true,
        attemptCount: true,
      },
    });

    if (due.length === 0) {
      return [];
    }

    const claimed: EmailContactRadarSyncOutboxClaimRow[] = [];
    for (const row of due) {
      const updated = await prisma.emailContactRadarSyncOutbox.updateMany({
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
    await prisma.emailContactRadarSyncOutbox.updateMany({
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

  async markSent(id: string): Promise<void> {
    await prisma.emailContactRadarSyncOutbox.update({
      where: { id },
      data: { status: "sent", lastError: null },
    });
  }

  async markFailedWithRetry(
    id: string,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string
  ): Promise<void> {
    await prisma.emailContactRadarSyncOutbox.update({
      where: { id },
      data: {
        attemptCount,
        lastError,
        status: nextAttemptAt ? "pending" : "failed",
        nextAttemptAt: nextAttemptAt ?? new Date(),
      },
    });
  }

  async countPendingByImportJobId(emailImportJobId: string): Promise<number> {
    return prisma.emailContactRadarSyncOutbox.count({
      where: {
        emailImportJobId,
        status: { in: ["pending", "processing"] },
      },
    });
  }
}

export const emailContactRadarSyncOutboxRepository =
  new EmailContactRadarSyncOutboxRepository();

import { prisma } from "@/app/api/infra/data/prisma";
import { EMAIL_CONTACT_RADAR_SYNC_OUTBOX_MAX_ATTEMPTS } from "@/lib/email/email-contact-radar-sync-outbox-backoff";
import type {
  EmailContactRadarSyncOutboxClaimRow,
  IEmailContactRadarSyncOutboxRepository,
  UpsertRadarSyncOutboxEntry,
} from "./IEmailContactRadarSyncOutboxRepository";

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

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
            generation: { increment: 1 },
          },
        })
      )
    );
  }

  private async recoverStaleProcessingClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
    const staleRows = await prisma.emailContactRadarSyncOutbox.findMany({
      where: {
        status: "processing",
        updatedAt: { lt: staleBefore },
      },
      select: { id: true, attemptCount: true },
    });

    for (const row of staleRows) {
      const nextAttemptCount = row.attemptCount + 1;
      const exhausted = nextAttemptCount >= EMAIL_CONTACT_RADAR_SYNC_OUTBOX_MAX_ATTEMPTS;

      await prisma.emailContactRadarSyncOutbox.updateMany({
        where: { id: row.id, status: "processing" },
        data: {
          status: exhausted ? "failed" : "pending",
          attemptCount: nextAttemptCount,
          generation: { increment: 1 },
          lastError: exhausted
            ? "Lease de processamento expirado; tentativas esgotadas"
            : "Lease de processamento expirado; reenfileirado",
          nextAttemptAt: now,
        },
      });
    }
  }

  async claimDue(limit: number): Promise<EmailContactRadarSyncOutboxClaimRow[]> {
    const now = new Date();
    await this.recoverStaleProcessingClaims(now);

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
        generation: true,
      },
    });

    if (due.length === 0) {
      return [];
    }

    const claimed: EmailContactRadarSyncOutboxClaimRow[] = [];
    for (const row of due) {
      const updated = await prisma.emailContactRadarSyncOutbox.updateMany({
        where: { id: row.id, status: "pending", generation: row.generation },
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
        generation: { increment: 1 },
      },
    });
  }

  async markSent(id: string, generation: number): Promise<boolean> {
    const updated = await prisma.emailContactRadarSyncOutbox.updateMany({
      where: { id, status: "processing", generation },
      data: { status: "sent", lastError: null },
    });
    return updated.count === 1;
  }

  async markFailedWithRetry(
    id: string,
    generation: number,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string
  ): Promise<boolean> {
    const updated = await prisma.emailContactRadarSyncOutbox.updateMany({
      where: { id, status: "processing", generation },
      data: {
        attemptCount,
        lastError,
        status: nextAttemptAt ? "pending" : "failed",
        nextAttemptAt: nextAttemptAt ?? new Date(),
      },
    });
    return updated.count === 1;
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

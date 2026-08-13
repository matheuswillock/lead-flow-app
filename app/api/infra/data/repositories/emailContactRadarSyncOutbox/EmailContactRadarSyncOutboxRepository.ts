import { prisma } from "@/app/api/infra/data/prisma";
import { EMAIL_CONTACT_RADAR_SYNC_OUTBOX_MAX_ATTEMPTS } from "@/lib/email/email-contact-radar-sync-outbox-backoff";
import type {
  EmailContactRadarSyncOutboxBacklogSnapshot,
  EmailContactRadarSyncOutboxClaimRow,
  IEmailContactRadarSyncOutboxRepository,
  UpsertRadarSyncOutboxEntry,
} from "./IEmailContactRadarSyncOutboxRepository";

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

type ClaimRawRow = {
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
  generation: number;
};

type BacklogRawRow = {
  status: "pending" | "processing";
  total: number | bigint;
  oldestAgeSeconds: number | null;
};

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
            emailImportJobId: entry.emailImportJobId ?? null,
            status: "pending",
            attemptCount: 0,
            nextAttemptAt: now,
          },
          update: {
            teamId: entry.teamId,
            emailImportJobId: entry.emailImportJobId ?? null,
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

  /**
   * Enfileira sync Radar para contatos da lista que ainda não têm identity
   * `email_contact_id` (ex.: materialização / lista criada fora do import D9).
   */
  async enqueueMissingForList(teamId: string, listId: string): Promise<number> {
    const missing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c.id
      FROM "corretor_studio_email_contacts" c
      INNER JOIN "corretor_studio_email_contact_lists" l ON l.id = c."listId"
      WHERE l."teamId" = ${teamId}::uuid
        AND c."listId" = ${listId}::uuid
        AND NOT EXISTS (
          SELECT 1
          FROM "corretor_studio_radar_identities" i
          WHERE i."teamId" = ${teamId}::uuid
            AND i.type = 'email_contact_id'
            AND i."normalizedValue" = c.id::text
        )
    `;

    await this.upsertPendingForContacts(
      missing.map((row) => ({
        emailContactId: row.id,
        teamId,
        emailImportJobId: null,
      }))
    );
    return missing.length;
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

  /**
   * Claim atômico via `FOR UPDATE SKIP LOCKED`.
   * Não incrementa `attemptCount` no claim (falha/stale recovery fazem isso).
   * Não incrementa `generation` no claim (upsert/stale/requeue invalidam leases).
   */
  async claimDue(limit: number): Promise<EmailContactRadarSyncOutboxClaimRow[]> {
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0) return [];

    const now = new Date();
    await this.recoverStaleProcessingClaims(now);

    const rows = await prisma.$queryRaw<ClaimRawRow[]>`
      WITH claimed AS (
        SELECT id
        FROM corretor_studio_email_contact_radar_sync_outbox
        WHERE status = 'pending'::email_contact_radar_sync_outbox_status
          AND "nextAttemptAt" <= ${now}
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE corretor_studio_email_contact_radar_sync_outbox o
      SET
        status = 'processing'::email_contact_radar_sync_outbox_status,
        "updatedAt" = ${now}
      FROM claimed
      WHERE o.id = claimed.id
      RETURNING
        o.id,
        o."emailContactId" AS "emailContactId",
        o."teamId" AS "teamId",
        o."emailImportJobId" AS "emailImportJobId",
        o."attemptCount" AS "attemptCount",
        o.generation
    `;

    return rows.map((row) => ({
      id: row.id,
      emailContactId: row.emailContactId,
      teamId: row.teamId,
      emailImportJobId: row.emailImportJobId,
      attemptCount: Number(row.attemptCount),
      generation: Number(row.generation),
    }));
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

  async getBacklogSnapshot(): Promise<EmailContactRadarSyncOutboxBacklogSnapshot> {
    const rows = await prisma.$queryRaw<BacklogRawRow[]>`
      SELECT
        status::text AS status,
        COUNT(*)::int AS total,
        EXTRACT(EPOCH FROM MAX(now() - "createdAt"))::float AS "oldestAgeSeconds"
      FROM corretor_studio_email_contact_radar_sync_outbox
      WHERE status IN (
        'pending'::email_contact_radar_sync_outbox_status,
        'processing'::email_contact_radar_sync_outbox_status
      )
      GROUP BY status
    `;

    let pending = 0;
    let processing = 0;
    let maxPendingAgeSeconds: number | null = null;

    for (const row of rows) {
      const total = Number(row.total);
      const age =
        row.oldestAgeSeconds == null || !Number.isFinite(row.oldestAgeSeconds)
          ? null
          : Math.max(0, Math.round(row.oldestAgeSeconds));

      if (row.status === "pending") {
        pending = total;
        maxPendingAgeSeconds = age;
      } else if (row.status === "processing") {
        processing = total;
      }
    }

    return { pending, processing, maxPendingAgeSeconds };
  }
}

export const emailContactRadarSyncOutboxRepository =
  new EmailContactRadarSyncOutboxRepository();

import type { PrismaClient } from "@prisma/client";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { RadarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository";
import {
  emailContactRadarSyncOutboxRepository,
  type EmailContactRadarSyncOutboxRepository,
} from "@/app/api/infra/data/repositories/emailContactRadarSyncOutbox/EmailContactRadarSyncOutboxRepository";
import type { EmailContactRadarSyncOutboxClaimRow } from "@/app/api/infra/data/repositories/emailContactRadarSyncOutbox/IEmailContactRadarSyncOutboxRepository";
import { RadarService } from "@/app/api/services/radar/RadarService";
import { syncEmailContactToRadarUseCase } from "@/app/api/useCases/radar/SyncEmailContactToRadarUseCase";
import { computeEmailContactRadarSyncOutboxNextAttemptAt } from "@/lib/email/email-contact-radar-sync-outbox-backoff";

const BATCH_SIZE = 50;
const RADAR_SYNC_CONCURRENCY = 8;

export class ProcessEmailContactRadarSyncOutboxUseCase {
  private readonly radarService: RadarService;

  constructor(
    private readonly outboxRepository: EmailContactRadarSyncOutboxRepository = emailContactRadarSyncOutboxRepository,
    db: PrismaClient = prisma
  ) {
    this.radarService = new RadarService(new RadarRepository(db));
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  async execute(): Promise<Output> {
    let claimedIds: string[] = [];

    try {
      const claimed = await this.outboxRepository.claimDue(BATCH_SIZE);
      claimedIds = claimed.map((row) => row.id);

      let sent = 0;
      let retried = 0;
      let failed = 0;

      for (const chunk of this.chunkArray(claimed, RADAR_SYNC_CONCURRENCY)) {
        await Promise.all(
          chunk.map(async (row) => {
            const outcome = await this.processRow(row);
            if (outcome === "sent") sent += 1;
            if (outcome === "retried") retried += 1;
            if (outcome === "failed") failed += 1;
          })
        );
      }

      console.info("[ProcessEmailContactRadarSyncOutboxUseCase] Lote processado", {
        claimed: claimed.length,
        sent,
        retried,
        failed,
      });

      return new Output(
        true,
        [`${sent} sync(s) concluído(s), ${retried} reenfileirado(s), ${failed} falha(s) definitiva(s)`],
        [],
        { claimed: claimed.length, sent, retried, failed }
      );
    } catch (error) {
      console.error("[ProcessEmailContactRadarSyncOutboxUseCase][execute]", error);
      await this.outboxRepository.requeueIfProcessing(claimedIds).catch((requeueError) => {
        console.error(
          "[ProcessEmailContactRadarSyncOutboxUseCase] Falha ao reenfileirar lote:",
          requeueError
        );
      });
      return new Output(false, [], ["Erro ao processar outbox de sync Radar"], null);
    }
  }

  private async processRow(
    row: EmailContactRadarSyncOutboxClaimRow
  ): Promise<"sent" | "retried" | "failed"> {
    try {
      const syncResult = await syncEmailContactToRadarUseCase.execute(
        {
          emailContactId: row.emailContactId,
          teamId: row.teamId,
        },
        { radarService: this.radarService }
      );

      if (!syncResult.isValid) {
        return this.handleFailure(row, syncResult.errorMessages.join("; ") || "Falha no sync Radar");
      }

      const syncErrors = (syncResult.result as { errors?: string[] } | null)?.errors;
      if (Array.isArray(syncErrors) && syncErrors.length > 0) {
        return this.handleFailure(row, syncErrors.join("; "));
      }

      await this.outboxRepository.markSent(row.id);
      return "sent";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      return this.handleFailure(row, message);
    }
  }

  private async handleFailure(
    row: EmailContactRadarSyncOutboxClaimRow,
    lastError: string
  ): Promise<"retried" | "failed"> {
    const attemptCount = row.attemptCount + 1;
    const nextAttemptAt = computeEmailContactRadarSyncOutboxNextAttemptAt(attemptCount);
    await this.outboxRepository.markFailedWithRetry(
      row.id,
      attemptCount,
      nextAttemptAt,
      lastError
    );
    return nextAttemptAt ? "retried" : "failed";
  }
}

export const processEmailContactRadarSyncOutboxUseCase =
  new ProcessEmailContactRadarSyncOutboxUseCase();

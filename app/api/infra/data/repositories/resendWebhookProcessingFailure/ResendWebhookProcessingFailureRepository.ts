import { prisma } from "@/app/api/infra/data/prisma";
import type { Prisma } from "@prisma/client";
import {
  computeResendWebhookProcessingFailureNextAttemptAt,
  RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS,
  shouldRetryResendWebhookProcessingFailure,
} from "@/lib/email/resend-webhook-processing-failure-backoff";
import type {
  IResendWebhookProcessingFailureRepository,
  ResendWebhookProcessingFailureClaimRow,
  UpsertResendWebhookProcessingFailureInput,
} from "./IResendWebhookProcessingFailureRepository";

type ClaimRawRow = {
  id: string;
  svixId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  attemptCount: number | bigint;
};

type StaleRecoveryRawRow = {
  id: string;
  status: "pending" | "failed";
};

function formatProcessingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

export class ResendWebhookProcessingFailureRepository
  implements IResendWebhookProcessingFailureRepository
{
  async upsertFromProcessingFailure(
    input: UpsertResendWebhookProcessingFailureInput
  ): Promise<void> {
    const existing = await prisma.resendWebhookProcessingFailure.findUnique({
      where: { svixId: input.svixId },
      select: { status: true },
    });
    if (existing?.status === "resolved") {
      return;
    }

    const now = new Date();
    await prisma.resendWebhookProcessingFailure.upsert({
      where: { svixId: input.svixId },
      create: {
        svixId: input.svixId,
        eventType: input.eventType,
        payload: input.payload,
        status: "pending",
        attemptCount: 1,
        nextAttemptAt: now,
        lastError: input.lastError,
        failureReason: input.failureReason,
      },
      update: {
        eventType: input.eventType,
        payload: input.payload,
        lastError: input.lastError,
        failureReason: input.failureReason,
        status: "pending",
        nextAttemptAt: now,
      },
    });
  }

  /**
   * Recuperação de leases abandonados via uma única query SQL atômica
   * (mesmo padrão de nomes físicos do `claimDue` abaixo), em vez do antigo
   * `findMany` + N `updateMany` sequenciais — com o lote de `claimDue`
   * podendo chegar a milhares de linhas, um único round-trip evita que a
   * fase de recovery vire o novo gargalo de latência do claim.
   */
  private async recoverStaleProcessingClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

    const recovered = await prisma.$queryRaw<StaleRecoveryRawRow[]>`
      UPDATE corretor_studio_resend_webhook_processing_failures
      SET
        "attemptCount" = "attemptCount" + 1,
        status = CASE
          WHEN "attemptCount" + 1 >= ${RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS}
          THEN 'failed'::resend_webhook_processing_failure_status
          ELSE 'pending'::resend_webhook_processing_failure_status
        END,
        "lastError" = CASE
          WHEN "attemptCount" + 1 >= ${RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS}
          THEN 'Lease de processamento expirado; tentativas esgotadas'
          ELSE 'Lease de processamento expirado; reenfileirado'
        END,
        "nextAttemptAt" = ${now}
      WHERE status = 'processing'::resend_webhook_processing_failure_status
        AND "updatedAt" < ${staleBefore}
      RETURNING id, status
    `;

    if (recovered.length > 0) {
      const requeued = recovered.filter((row) => row.status === "pending").length;
      const exhausted = recovered.filter((row) => row.status === "failed").length;
      console.info("[ResendWebhookProcessingFailureRepository] Leases abandonados recuperados", {
        total: recovered.length,
        requeued,
        exhausted,
      });
    }
  }

  /**
   * Claim atômico via `FOR UPDATE SKIP LOCKED` (mesmo padrão de
   * `TeamWebhookOutboxRepository`/`EmailContactRadarSyncOutboxRepository`).
   * Substitui o antigo `findMany` + N `updateMany` sequenciais — com
   * `limit` na casa dos milhares isso significava milhares de round-trips
   * ao Postgres só para reservar o lote, o que limitava o quanto o batch
   * podia crescer sem estourar o `maxDuration` do cron. Agora é 1 round-trip
   * só, e `SKIP LOCKED` também evita corrida caso o cron rode mais vezes
   * por hora e duas execuções se sobreponham.
   */
  async claimDue(limit: number): Promise<ResendWebhookProcessingFailureClaimRow[]> {
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0) return [];

    const now = new Date();
    await this.recoverStaleProcessingClaims(now);

    const rows = await prisma.$queryRaw<ClaimRawRow[]>`
      WITH claimed AS (
        SELECT id
        FROM corretor_studio_resend_webhook_processing_failures
        WHERE status = 'pending'::resend_webhook_processing_failure_status
          AND "nextAttemptAt" <= ${now}
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE corretor_studio_resend_webhook_processing_failures o
      SET
        status = 'processing'::resend_webhook_processing_failure_status,
        "updatedAt" = ${now}
      FROM claimed
      WHERE o.id = claimed.id
      RETURNING
        o.id,
        o."svixId" AS "svixId",
        o."eventType" AS "eventType",
        o.payload,
        o."attemptCount" AS "attemptCount"
    `;

    return rows.map((row) => ({
      id: row.id,
      svixId: row.svixId,
      eventType: row.eventType,
      payload: row.payload,
      attemptCount: Number(row.attemptCount),
    }));
  }

  async markResolved(id: string): Promise<void> {
    await prisma.resendWebhookProcessingFailure.updateMany({
      where: { id, status: "processing" },
      data: { status: "resolved", lastError: null },
    });
  }

  async markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string
  ): Promise<"retried" | "failed"> {
    const trimmedError = lastError.slice(0, 2000);
    if (!shouldRetryResendWebhookProcessingFailure(attemptCountAfterFailure)) {
      await prisma.resendWebhookProcessingFailure.updateMany({
        where: { id, status: "processing" },
        data: {
          status: "failed",
          attemptCount: attemptCountAfterFailure,
          lastError: trimmedError,
        },
      });
      return "failed";
    }

    const nextAttemptAt = computeResendWebhookProcessingFailureNextAttemptAt(
      attemptCountAfterFailure
    );
    await prisma.resendWebhookProcessingFailure.updateMany({
      where: { id, status: "processing" },
      data: {
        status: "pending",
        attemptCount: attemptCountAfterFailure,
        lastError: trimmedError,
        nextAttemptAt: nextAttemptAt ?? new Date(),
      },
    });
    return "retried";
  }

  async requeueIfProcessing(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.resendWebhookProcessingFailure.updateMany({
      where: {
        id: { in: ids },
        status: "processing",
      },
      data: {
        status: "pending",
        nextAttemptAt: new Date(),
      },
    });
  }
}

export const resendWebhookProcessingFailureRepository =
  new ResendWebhookProcessingFailureRepository();

export { formatProcessingError };

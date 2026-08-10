import { prisma } from "@/app/api/infra/data/prisma";
import {
  computeResendWebhookProcessingFailureNextAttemptAt,
  shouldRetryResendWebhookProcessingFailure,
} from "@/lib/email/resend-webhook-processing-failure-backoff";
import type {
  IResendWebhookProcessingFailureRepository,
  ResendWebhookProcessingFailureClaimRow,
  UpsertResendWebhookProcessingFailureInput,
} from "./IResendWebhookProcessingFailureRepository";

function formatProcessingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}

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
      },
      update: {
        eventType: input.eventType,
        payload: input.payload,
        lastError: input.lastError,
        status: "pending",
        nextAttemptAt: now,
      },
    });
  }

  async claimDue(limit: number): Promise<ResendWebhookProcessingFailureClaimRow[]> {
    const now = new Date();
    const due = await prisma.resendWebhookProcessingFailure.findMany({
      where: {
        status: "pending",
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: {
        id: true,
        svixId: true,
        eventType: true,
        payload: true,
        attemptCount: true,
      },
    });

    const claimed: ResendWebhookProcessingFailureClaimRow[] = [];
    for (const row of due) {
      const updated = await prisma.resendWebhookProcessingFailure.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "processing" },
      });
      if (updated.count === 1) {
        claimed.push(row);
      }
    }
    return claimed;
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

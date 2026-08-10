import type { Prisma } from "@prisma/client";

export type ResendWebhookProcessingFailureClaimRow = {
  id: string;
  svixId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  attemptCount: number;
};

export type UpsertResendWebhookProcessingFailureInput = {
  svixId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  lastError: string;
};

export interface IResendWebhookProcessingFailureRepository {
  upsertFromProcessingFailure(input: UpsertResendWebhookProcessingFailureInput): Promise<void>;
  claimDue(limit: number): Promise<ResendWebhookProcessingFailureClaimRow[]>;
  markResolved(id: string): Promise<void>;
  markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string
  ): Promise<"retried" | "failed">;
  requeueIfProcessing(ids: string[]): Promise<void>;
}

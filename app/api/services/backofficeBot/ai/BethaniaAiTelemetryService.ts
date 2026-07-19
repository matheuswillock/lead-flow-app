import { createHash } from "crypto";
import type {
  BackofficeBotAiAttemptStatus,
  BackofficeBotAiCapability,
  BackofficeBotAiInteractionStatus,
  BackofficeBotAiProvider,
} from "@prisma/client";
import { backofficeBotAiRepository } from "@/app/api/infra/data/repositories/backofficeBotAi/BackofficeBotAiRepository";
import { redactBethaniaAiTelemetry } from "@/lib/studio-bot/ai/redaction";

function hashPayload(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class BethaniaAiTelemetryService {
  async recordProviderTest(input: {
    provider: BackofficeBotAiProvider;
    model: string;
    status: BackofficeBotAiAttemptStatus;
    interactionStatus: BackofficeBotAiInteractionStatus;
    latencyMs: number;
    errorCode?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    httpStatus?: number | null;
    providerRequestId?: string | null;
    requestPreview: string;
    responsePreview?: string | null;
  }) {
    const interaction = await backofficeBotAiRepository.createInteraction({
      capability: "provider_test",
      status: input.interactionStatus,
      promptKey: "provider_test",
      promptVersion: "v0",
      isShadow: true,
      usedFallback: false,
      inputHash: hashPayload(redactBethaniaAiTelemetry(input.requestPreview)),
      outputHash: input.responsePreview
        ? hashPayload(redactBethaniaAiTelemetry(input.responsePreview))
        : null,
      errorCode: input.errorCode ?? null,
      latencyMs: input.latencyMs,
    });

    const attempt = await backofficeBotAiRepository.createAttempt({
      interactionId: interaction.id,
      sequence: 1,
      provider: input.provider,
      model: input.model,
      capability: "provider_test" as BackofficeBotAiCapability,
      status: input.status,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      latencyMs: input.latencyMs,
      httpStatus: input.httpStatus ?? null,
      errorCode: input.errorCode ?? null,
      providerRequestId: input.providerRequestId ?? null,
      requestSchemaVersion: "bethania-intent-v1",
      responseSchemaVersion: "bethania-intent-v1",
    });

    return { interaction, attempt };
  }
}

export const bethaniaAiTelemetryService = new BethaniaAiTelemetryService();

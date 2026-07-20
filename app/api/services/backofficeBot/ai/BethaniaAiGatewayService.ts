import type { BackofficeBotAiConfiguration as DbConfig } from "@prisma/client";
import {
  mayCallBethaniaAi,
  type BethaniaAiConfiguration,
} from "@/lib/studio-bot/ai/config";
import { backofficeBotAiRepository } from "@/app/api/infra/data/repositories/backofficeBotAi/BackofficeBotAiRepository";
import type {
  BethaniaAiGenerateInput,
  BethaniaAiGenerateResult,
  IBethaniaAiProvider,
} from "./IBethaniaAiProvider";
import { groqBethaniaAiProvider } from "./GroqBethaniaAiProvider";

function toGateConfig(row: DbConfig): BethaniaAiConfiguration {
  return {
    enabled: row.enabled,
    shadowMode: row.shadowMode,
    rolloutPercentage: row.rolloutPercentage,
    dailyUserLimit: row.dailyUserLimit,
    dailyGlobalLimit: row.dailyGlobalLimit,
    timeoutMs: row.timeoutMs,
    circuitBreakerFailureThreshold: row.circuitBreakerFailureThreshold,
    circuitBreakerResetSeconds: row.circuitBreakerResetSeconds,
    primaryModel: row.primaryModel,
    fallbackModel: row.fallbackModel,
  };
}

/**
 * Owns kill-switch / quota gates. Callers must not invoke the provider directly
 * for user traffic. Fase 0 only allows synthetic provider/test.
 */
export class BethaniaAiGatewayService {
  constructor(private readonly provider: IBethaniaAiProvider = groqBethaniaAiProvider) {}

  async generateForUser(input: {
    userLinkId: string;
    generate: BethaniaAiGenerateInput;
    force?: boolean;
  }): Promise<BethaniaAiGenerateResult | { ok: false; errorCode: "ai_disabled" | "quota_exceeded"; latencyMs: 0 }> {
    const configuration = await backofficeBotAiRepository.getConfiguration();
    if (!input.force && !configuration.enabled) {
      return { ok: false, errorCode: "ai_disabled", latencyMs: 0 };
    }

    const globalRequests = await backofficeBotAiRepository.countAttemptsToday();
    const allowed = mayCallBethaniaAi(
      toGateConfig(configuration),
      input.userLinkId,
      { userRequests: 0, globalRequests },
      false
    );
    if (!input.force && !allowed) {
      return { ok: false, errorCode: "quota_exceeded", latencyMs: 0 };
    }

    return this.provider.generate({
      ...input.generate,
      timeoutMs: Math.min(input.generate.timeoutMs, configuration.timeoutMs),
    });
  }

  /** Synthetic test — ignores rollout; still respects enabled unless force. */
  async generateSynthetic(input: BethaniaAiGenerateInput & { force?: boolean }) {
    const configuration = await backofficeBotAiRepository.getConfiguration();
    if (!input.force && !configuration.enabled) {
      return { ok: false as const, errorCode: "ai_disabled" as const, latencyMs: 0 };
    }
    return this.provider.generate({
      model: input.model || configuration.primaryModel,
      system: input.system,
      user: input.user,
      timeoutMs: Math.min(input.timeoutMs, configuration.timeoutMs),
    });
  }
}

export const bethaniaAiGatewayService = new BethaniaAiGatewayService();

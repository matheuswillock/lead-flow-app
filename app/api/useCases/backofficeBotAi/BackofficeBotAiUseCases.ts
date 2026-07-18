import { Output } from "@/lib/output";
import { backofficeBotAiRepository } from "@/app/api/infra/data/repositories/backofficeBotAi/BackofficeBotAiRepository";
import { bethaniaAiGatewayService } from "@/app/api/services/backofficeBot/ai/BethaniaAiGatewayService";
import { bethaniaAiTelemetryService } from "@/app/api/services/backofficeBot/ai/BethaniaAiTelemetryService";
import type { BackofficeBotAiProvider } from "@prisma/client";

function parseDateRange(from?: string | null, to?: string | null) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: start, to: end };
}

export class BackofficeBotAiConfigurationUseCase {
  async get() {
    try {
      const configuration = await backofficeBotAiRepository.getConfiguration();
      return new Output(true, [], [], configuration);
    } catch (error) {
      console.error("[BackofficeBotAiConfigurationUseCase][get]", error);
      return new Output(false, [], ["Erro ao carregar configuração da IA"], null);
    }
  }

  async patch(
    profileId: string,
    fullAccess: boolean,
    body: Record<string, unknown>
  ) {
    if (!fullAccess) {
      return new Output(false, [], ["Acesso restrito a MASTER"], null);
    }
    try {
      const allowed: Record<string, unknown> = {};
      const keys = [
        "enabled",
        "shadowMode",
        "rolloutPercentage",
        "primaryModel",
        "fallbackModel",
        "confidenceThreshold",
        "dailyUserLimit",
        "dailyGlobalLimit",
        "timeoutMs",
        "circuitBreakerFailureThreshold",
        "circuitBreakerResetSeconds",
        "retentionDays",
      ] as const;
      for (const key of keys) {
        if (key in body) allowed[key] = body[key];
      }
      if ("primaryProvider" in body && (body.primaryProvider === "groq" || body.primaryProvider === "ollama")) {
        allowed.primaryProvider = body.primaryProvider;
      }
      const configuration = await backofficeBotAiRepository.updateConfiguration(allowed, profileId);
      return new Output(true, ["Configuração atualizada"], [], configuration);
    } catch (error) {
      console.error("[BackofficeBotAiConfigurationUseCase][patch]", error);
      return new Output(false, [], ["Erro ao atualizar configuração da IA"], null);
    }
  }
}

export class BackofficeBotAiMetricsUseCase {
  async overview(from?: string | null, to?: string | null) {
    try {
      const range = parseDateRange(from, to);
      const configuration = await backofficeBotAiRepository.getConfiguration();
      const [interactions, attemptsByStatus, timeseries] = await Promise.all([
        backofficeBotAiRepository.countInteractions(range.from, range.to),
        backofficeBotAiRepository.countAttemptsByStatus(range.from, range.to),
        backofficeBotAiRepository.listDailyUsage(range.from, range.to),
      ]);
      const successes = attemptsByStatus.find((row) => row.status === "success")?._count ?? 0;
      const failures = attemptsByStatus
        .filter((row) => row.status !== "success" && row.status !== "skipped")
        .reduce((sum, row) => sum + row._count, 0);
      return new Output(true, [], [], {
        configuration: {
          enabled: configuration.enabled,
          shadowMode: configuration.shadowMode,
          rolloutPercentage: configuration.rolloutPercentage,
          primaryModel: configuration.primaryModel,
          fallbackModel: configuration.fallbackModel,
        },
        metrics: {
          interactions,
          successes,
          failures,
          attemptsByStatus,
        },
        timeseries,
        aiActive: configuration.enabled,
        message: configuration.enabled
          ? null
          : "IA não ativada — kill switch desligado (Fase 0).",
      });
    } catch (error) {
      console.error("[BackofficeBotAiMetricsUseCase][overview]", error);
      return new Output(false, [], ["Erro ao carregar métricas da IA"], null);
    }
  }

  async usage(input: {
    from?: string | null;
    to?: string | null;
    page?: number;
    pageSize?: number;
    provider?: string | null;
    model?: string | null;
    status?: string | null;
  }) {
    try {
      const range = parseDateRange(input.from, input.to);
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
      const result = await backofficeBotAiRepository.listAttempts({
        from: range.from,
        to: range.to,
        page,
        pageSize,
        provider: input.provider === "groq" || input.provider === "ollama" ? input.provider : undefined,
        model: input.model ?? undefined,
        status: (input.status as never) ?? undefined,
      });
      return new Output(true, [], [], { ...result, page, pageSize });
    } catch (error) {
      console.error("[BackofficeBotAiMetricsUseCase][usage]", error);
      return new Output(false, [], ["Erro ao listar uso da IA"], null);
    }
  }

  async users(input: { from?: string | null; to?: string | null; page?: number; pageSize?: number }) {
    try {
      const range = parseDateRange(input.from, input.to);
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
      const result = await backofficeBotAiRepository.listUsersUsage({
        from: range.from,
        to: range.to,
        page,
        pageSize,
      });
      return new Output(true, [], [], { ...result, page, pageSize });
    } catch (error) {
      console.error("[BackofficeBotAiMetricsUseCase][users]", error);
      return new Output(false, [], ["Erro ao listar usuários da IA"], null);
    }
  }

  async interaction(id: string) {
    try {
      const interaction = await backofficeBotAiRepository.findInteractionById(id);
      if (!interaction) {
        return new Output(false, [], ["Interação não encontrada"], null);
      }
      return new Output(true, [], [], {
        id: interaction.id,
        status: interaction.status,
        intent: interaction.intent,
        confidence: interaction.confidence,
        capability: interaction.capability,
        isShadow: interaction.isShadow,
        usedFallback: interaction.usedFallback,
        errorCode: interaction.errorCode,
        latencyMs: interaction.latencyMs,
        createdAt: interaction.createdAt,
        inputHash: interaction.inputHash,
        outputHash: interaction.outputHash,
        attempts: interaction.attempts.map((attempt) => ({
          id: attempt.id,
          sequence: attempt.sequence,
          provider: attempt.provider,
          model: attempt.model,
          status: attempt.status,
          latencyMs: attempt.latencyMs,
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens,
          totalTokens: attempt.totalTokens,
          errorCode: attempt.errorCode,
          httpStatus: attempt.httpStatus,
        })),
      });
    } catch (error) {
      console.error("[BackofficeBotAiMetricsUseCase][interaction]", error);
      return new Output(false, [], ["Erro ao carregar interação"], null);
    }
  }

  async exportCsv(fullAccess: boolean, from?: string | null, to?: string | null) {
    if (!fullAccess) {
      return new Output(false, [], ["Acesso restrito a MASTER"], null);
    }
    try {
      const range = parseDateRange(from, to);
      const maxMs = 31 * 24 * 60 * 60 * 1000;
      if (range.to.getTime() - range.from.getTime() > maxMs) {
        return new Output(false, [], ["Exportação limitada a 31 dias"], null);
      }
      const { items } = await backofficeBotAiRepository.listAttempts({
        from: range.from,
        to: range.to,
        page: 1,
        pageSize: 5000,
      });
      const header =
        "createdAt,provider,model,status,latencyMs,inputTokens,outputTokens,totalTokens,errorCode";
      const lines = items.map((row) =>
        [
          row.createdAt.toISOString(),
          row.provider,
          row.model,
          row.status,
          row.latencyMs ?? "",
          row.inputTokens ?? "",
          row.outputTokens ?? "",
          row.totalTokens ?? "",
          row.errorCode ?? "",
        ].join(",")
      );
      return new Output(true, [], [], { csv: [header, ...lines].join("\n") });
    } catch (error) {
      console.error("[BackofficeBotAiMetricsUseCase][exportCsv]", error);
      return new Output(false, [], ["Erro ao exportar uso da IA"], null);
    }
  }
}

export class BackofficeBotAiProviderTestUseCase {
  async run(fullAccess: boolean) {
    if (!fullAccess) {
      return new Output(false, [], ["Acesso restrito a MASTER"], null);
    }
    try {
      const configuration = await backofficeBotAiRepository.getConfiguration();
      const result = await bethaniaAiGatewayService.generateSynthetic({
        model: configuration.primaryModel,
        system:
          'Responda somente JSON válido no schema: {"intent":"unknown","confidence":0.5,"entities":{},"needsClarification":false,"clarificationField":"none"}',
        user: "ping sintético Bethânia (sem PII)",
        timeoutMs: configuration.timeoutMs,
        force: true,
      });

      if (!result.ok) {
        await bethaniaAiTelemetryService.recordProviderTest({
          provider: (configuration.primaryProvider ?? "groq") as BackofficeBotAiProvider,
          model: configuration.primaryModel,
          status:
            result.errorCode === "rate_limited"
              ? "rate_limited"
              : result.errorCode === "timeout"
                ? "timeout"
                : result.errorCode === "invalid_json"
                  ? "validation_error"
                  : "provider_error",
          interactionStatus: "failed",
          latencyMs: result.latencyMs,
          errorCode: result.errorCode,
          httpStatus: "httpStatus" in result ? result.httpStatus : null,
          requestPreview: "provider_test_ping",
        });
        return new Output(true, [], [], {
          ok: false,
          errorCode: result.errorCode,
          latencyMs: result.latencyMs,
        });
      }

      const recorded = await bethaniaAiTelemetryService.recordProviderTest({
        provider: configuration.primaryProvider,
        model: configuration.primaryModel,
        status: "success",
        interactionStatus: "resolved",
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        httpStatus: result.httpStatus,
        providerRequestId: result.providerRequestId,
        requestPreview: "provider_test_ping",
        responsePreview: JSON.stringify(result.response),
      });

      return new Output(true, ["Teste sintético concluído"], [], {
        ok: true,
        interactionId: recorded.interaction.id,
        attemptId: recorded.attempt.id,
        latencyMs: result.latencyMs,
        intent: result.response.intent,
        confidence: result.response.confidence,
      });
    } catch (error) {
      console.error("[BackofficeBotAiProviderTestUseCase][run]", error);
      return new Output(false, [], ["Erro ao testar provider da IA"], null);
    }
  }
}

export class BackofficeBotAiRollupUseCase {
  async run() {
    try {
      const configuration = await backofficeBotAiRepository.getConfiguration();
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      const attempts = await backofficeBotAiRepository.listAttempts({
        from,
        to,
        page: 1,
        pageSize: 5000,
      });

      const buckets = new Map<
        string,
        {
          day: Date;
          provider: BackofficeBotAiProvider;
          model: string;
          capability: (typeof attempts.items)[number]["capability"];
          requests: number;
          successes: number;
          failures: number;
          fallbacks: number;
          inputTokens: bigint;
          outputTokens: bigint;
          latencies: number[];
        }
      >();

      for (const attempt of attempts.items) {
        const day = new Date(Date.UTC(attempt.createdAt.getUTCFullYear(), attempt.createdAt.getUTCMonth(), attempt.createdAt.getUTCDate()));
        const key = `${day.toISOString()}|${attempt.provider}|${attempt.model}|${attempt.capability}`;
        const bucket = buckets.get(key) ?? {
          day,
          provider: attempt.provider,
          model: attempt.model,
          capability: attempt.capability,
          requests: 0,
          successes: 0,
          failures: 0,
          fallbacks: 0,
          inputTokens: BigInt(0),
          outputTokens: BigInt(0),
          latencies: [] as number[],
        };
        bucket.requests += 1;
        if (attempt.status === "success") bucket.successes += 1;
        else bucket.failures += 1;
        bucket.inputTokens += BigInt(attempt.inputTokens ?? 0);
        bucket.outputTokens += BigInt(attempt.outputTokens ?? 0);
        if (attempt.latencyMs != null) bucket.latencies.push(attempt.latencyMs);
        buckets.set(key, bucket);
      }

      for (const bucket of buckets.values()) {
        const sorted = [...bucket.latencies].sort((a, b) => a - b);
        const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : null;
        const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null;
        await backofficeBotAiRepository.upsertDailyUsage({
          day: bucket.day,
          provider: bucket.provider,
          model: bucket.model,
          capability: bucket.capability,
          requests: bucket.requests,
          successes: bucket.successes,
          failures: bucket.failures,
          fallbacks: bucket.fallbacks,
          inputTokens: bucket.inputTokens,
          outputTokens: bucket.outputTokens,
          estimatedCostUsd: 0,
          uniqueUsers: 0,
          latencyP50Ms: p50,
          latencyP95Ms: p95,
        });
      }

      const retentionBefore = new Date(
        Date.now() - configuration.retentionDays * 24 * 60 * 60 * 1000
      );
      const deleted = await backofficeBotAiRepository.deleteOldInteractions(retentionBefore);

      return new Output(true, [], [], {
        buckets: buckets.size,
        deletedInteractions: deleted,
      });
    } catch (error) {
      console.error("[BackofficeBotAiRollupUseCase][run]", error);
      return new Output(false, [], ["Erro no rollup da IA"], null);
    }
  }
}

export const backofficeBotAiConfigurationUseCase = new BackofficeBotAiConfigurationUseCase();
export const backofficeBotAiMetricsUseCase = new BackofficeBotAiMetricsUseCase();
export const backofficeBotAiProviderTestUseCase = new BackofficeBotAiProviderTestUseCase();
export const backofficeBotAiRollupUseCase = new BackofficeBotAiRollupUseCase();

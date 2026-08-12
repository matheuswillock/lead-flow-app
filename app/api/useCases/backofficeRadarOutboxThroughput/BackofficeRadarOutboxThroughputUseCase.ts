import { Output } from "@/lib/output";
import { backofficeRadarOutboxThroughputRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarOutboxThroughput/BackofficeRadarOutboxThroughputRepository";
import type { UpsertBackofficeRadarOutboxThroughputConfigInput } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarOutboxThroughput/IBackofficeRadarOutboxThroughputRepository";
import {
  clampRadarOutboxBatchSize,
  clampRadarOutboxConcurrency,
  estimateRadarOutboxThroughputPerHour,
  RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE,
  RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE,
  RADAR_OUTBOX_THROUGHPUT_LIMITS,
  RADAR_SYNC_MAX_CONCURRENCY,
  RADAR_SYNC_MIN_CONCURRENCY,
} from "@/lib/email/email-contact-radar-sync-outbox-config";
import { resolveEffectiveRadarOutboxThroughput } from "@/lib/email/resolve-radar-outbox-throughput";

export class BackofficeRadarOutboxThroughputUseCase {
  async get(): Promise<Output> {
    try {
      const effective = await resolveEffectiveRadarOutboxThroughput();
      const config = await backofficeRadarOutboxThroughputRepository.getActiveConfig();

      return new Output(true, [], [], {
        config: config
          ? {
              id: config.id,
              batchSize: config.batchSize,
              concurrency: config.concurrency,
              isActive: config.isActive,
              updatedByProfileId: config.updatedByProfileId,
              createdAt: config.createdAt.toISOString(),
              updatedAt: config.updatedAt.toISOString(),
            }
          : null,
        effective,
        limits: RADAR_OUTBOX_THROUGHPUT_LIMITS,
        howItWorks: {
          cronPath: "/api/v1/radar/cron/sync-email-contacts",
          cronCadence: "*/5 * * * *",
          cronRunsPerHour: RADAR_OUTBOX_THROUGHPUT_LIMITS.cronRunsPerHour,
          formula: "throughput_hora ≈ batchSize × 12 (cron a cada 5 min)",
          precedence: "backoffice (linha ativa) → env → defaults do código",
          connectionBudgetHint: "orçamento ≈ concurrency + 1 conexão por tick",
        },
      });
    } catch (error) {
      console.error("[BackofficeRadarOutboxThroughputUseCase][get]", error);
      return new Output(false, [], ["Erro ao carregar vazão do outbox Radar"], null);
    }
  }

  async upsert(
    input: UpsertBackofficeRadarOutboxThroughputConfigInput
  ): Promise<Output> {
    try {
      const validationError = this.validate(input);
      if (validationError) {
        return new Output(false, [], [validationError], null);
      }

      const batchSize = clampRadarOutboxBatchSize(input.batchSize);
      const concurrency = clampRadarOutboxConcurrency(input.concurrency);

      const config = await backofficeRadarOutboxThroughputRepository.upsertActiveConfig({
        batchSize,
        concurrency,
        updatedByProfileId: input.updatedByProfileId,
      });

      const theoreticalThroughputPerHour = estimateRadarOutboxThroughputPerHour(batchSize);

      return new Output(
        true,
        [
          `Vazão salva: batch ${batchSize}, concorrência ${concurrency} (~${theoreticalThroughputPerHour}/h)`,
        ],
        [],
        {
          config: {
            id: config.id,
            batchSize: config.batchSize,
            concurrency: config.concurrency,
            isActive: config.isActive,
            updatedByProfileId: config.updatedByProfileId,
            createdAt: config.createdAt.toISOString(),
            updatedAt: config.updatedAt.toISOString(),
          },
          effective: await resolveEffectiveRadarOutboxThroughput(),
          limits: RADAR_OUTBOX_THROUGHPUT_LIMITS,
        }
      );
    } catch (error) {
      console.error("[BackofficeRadarOutboxThroughputUseCase][upsert]", error);
      return new Output(false, [], ["Erro ao salvar vazão do outbox Radar"], null);
    }
  }

  private validate(input: UpsertBackofficeRadarOutboxThroughputConfigInput): string | null {
    if (
      !Number.isInteger(input.batchSize) ||
      input.batchSize < RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE ||
      input.batchSize > RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE
    ) {
      return `Batch deve ser inteiro entre ${RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE} e ${RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE}`;
    }

    if (
      !Number.isInteger(input.concurrency) ||
      input.concurrency < RADAR_SYNC_MIN_CONCURRENCY ||
      input.concurrency > RADAR_SYNC_MAX_CONCURRENCY
    ) {
      return `Concorrência deve ser inteiro entre ${RADAR_SYNC_MIN_CONCURRENCY} e ${RADAR_SYNC_MAX_CONCURRENCY}`;
    }

    return null;
  }
}

export const backofficeRadarOutboxThroughputUseCase =
  new BackofficeRadarOutboxThroughputUseCase();

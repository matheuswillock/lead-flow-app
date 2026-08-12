import { prisma } from "@/app/api/infra/data/prisma";
import {
  clampRadarOutboxBatchSize,
  clampRadarOutboxConcurrency,
  estimateRadarOutboxThroughputPerHour,
  RADAR_OUTBOX_THROUGHPUT_LIMITS,
  resolveRadarEmailContactSyncOutboxBatchSize,
  resolveRadarSyncConcurrency,
  type RadarOutboxThroughputLimits,
} from "@/lib/email/email-contact-radar-sync-outbox-config";

export type RadarOutboxThroughputSource = "backoffice" | "env";

export type EffectiveRadarOutboxThroughput = {
  batchSize: number;
  concurrency: number;
  source: RadarOutboxThroughputSource;
  theoreticalThroughputPerHour: number;
  limits: RadarOutboxThroughputLimits;
  updatedAt: string | null;
};

/**
 * Precedência: linha ativa no backoffice → env → defaults do código.
 * Sempre clampado aos min/max canônicos (não dá para “furar” o teto pela UI/DB).
 */
export async function resolveEffectiveRadarOutboxThroughput(): Promise<EffectiveRadarOutboxThroughput> {
  const row = await prisma.backofficeRadarOutboxThroughputConfig
    .findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        batchSize: true,
        concurrency: true,
        updatedAt: true,
      },
    })
    .catch((error) => {
      console.error("[resolveEffectiveRadarOutboxThroughput]", error);
      return null;
    });

  if (row) {
    const batchSize = clampRadarOutboxBatchSize(row.batchSize);
    const concurrency = clampRadarOutboxConcurrency(row.concurrency);
    return {
      batchSize,
      concurrency,
      source: "backoffice",
      theoreticalThroughputPerHour: estimateRadarOutboxThroughputPerHour(batchSize),
      limits: RADAR_OUTBOX_THROUGHPUT_LIMITS,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  const batchSize = resolveRadarEmailContactSyncOutboxBatchSize();
  const concurrency = resolveRadarSyncConcurrency();
  return {
    batchSize,
    concurrency,
    source: "env",
    theoreticalThroughputPerHour: estimateRadarOutboxThroughputPerHour(batchSize),
    limits: RADAR_OUTBOX_THROUGHPUT_LIMITS,
    updatedAt: null,
  };
}

import { prisma } from "@/app/api/infra/data/prisma";
import type {
  BackofficeRadarOutboxThroughputConfigRow,
  IBackofficeRadarOutboxThroughputRepository,
  UpsertBackofficeRadarOutboxThroughputConfigInput,
} from "./IBackofficeRadarOutboxThroughputRepository";

const configSelect = {
  id: true,
  batchSize: true,
  concurrency: true,
  isActive: true,
  updatedByProfileId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class BackofficeRadarOutboxThroughputRepository
  implements IBackofficeRadarOutboxThroughputRepository
{
  async getActiveConfig(): Promise<BackofficeRadarOutboxThroughputConfigRow | null> {
    return prisma.backofficeRadarOutboxThroughputConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: configSelect,
    });
  }

  async upsertActiveConfig(
    input: UpsertBackofficeRadarOutboxThroughputConfigInput
  ): Promise<BackofficeRadarOutboxThroughputConfigRow> {
    const existing = await this.getActiveConfig();
    if (existing) {
      return prisma.backofficeRadarOutboxThroughputConfig.update({
        where: { id: existing.id },
        data: {
          batchSize: input.batchSize,
          concurrency: input.concurrency,
          isActive: true,
          updatedByProfileId: input.updatedByProfileId ?? existing.updatedByProfileId,
        },
        select: configSelect,
      });
    }

    return prisma.backofficeRadarOutboxThroughputConfig.create({
      data: {
        batchSize: input.batchSize,
        concurrency: input.concurrency,
        isActive: true,
        updatedByProfileId: input.updatedByProfileId ?? null,
      },
      select: configSelect,
    });
  }
}

export const backofficeRadarOutboxThroughputRepository =
  new BackofficeRadarOutboxThroughputRepository();

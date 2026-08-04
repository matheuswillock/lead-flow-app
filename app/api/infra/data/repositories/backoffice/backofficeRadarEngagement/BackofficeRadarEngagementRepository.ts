import { prisma } from "@/app/api/infra/data/prisma";
import type {
  BackofficeRadarEngagementConfigRow,
  BackofficeRadarEngagementWeightRow,
  IBackofficeRadarEngagementRepository,
  UpsertBackofficeRadarEngagementConfigInput,
  UpsertBackofficeRadarEngagementWeightInput,
} from "./IBackofficeRadarEngagementRepository";

const weightSelect = {
  id: true,
  eventType: true,
  weight: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const configSelect = {
  id: true,
  windowRecentDays: true,
  windowMidDays: true,
  windowOldDays: true,
  recentMultiplier: true,
  oldMultiplier: true,
  hotThreshold: true,
  warmThreshold: true,
  lukewarmThreshold: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class BackofficeRadarEngagementRepository
  implements IBackofficeRadarEngagementRepository
{
  async listWeights(): Promise<BackofficeRadarEngagementWeightRow[]> {
    return prisma.backofficeRadarEngagementWeight.findMany({
      select: weightSelect,
      orderBy: [{ weight: "desc" }, { eventType: "asc" }],
    });
  }

  async upsertWeights(
    items: UpsertBackofficeRadarEngagementWeightInput[]
  ): Promise<BackofficeRadarEngagementWeightRow[]> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.backofficeRadarEngagementWeight.upsert({
          where: { eventType: item.eventType },
          create: {
            eventType: item.eventType,
            weight: item.weight,
            description: item.description ?? null,
            isActive: item.isActive ?? true,
          },
          update: {
            weight: item.weight,
            ...(item.description !== undefined ? { description: item.description } : {}),
            ...(item.isActive !== undefined ? { isActive: item.isActive } : {}),
          },
          select: weightSelect,
        })
      )
    );

    return this.listWeights();
  }

  async getActiveConfig(): Promise<BackofficeRadarEngagementConfigRow | null> {
    return prisma.backofficeRadarEngagementConfig.findFirst({
      where: { isActive: true },
      select: configSelect,
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsertActiveConfig(
    input: UpsertBackofficeRadarEngagementConfigInput
  ): Promise<BackofficeRadarEngagementConfigRow> {
    const existing = await this.getActiveConfig();

    if (existing) {
      return prisma.backofficeRadarEngagementConfig.update({
        where: { id: existing.id },
        data: {
          windowRecentDays: input.windowRecentDays,
          windowMidDays: input.windowMidDays,
          windowOldDays: input.windowOldDays,
          recentMultiplier: input.recentMultiplier,
          oldMultiplier: input.oldMultiplier,
          hotThreshold: input.hotThreshold,
          warmThreshold: input.warmThreshold,
          lukewarmThreshold: input.lukewarmThreshold,
          isActive: true,
        },
        select: configSelect,
      });
    }

    return prisma.backofficeRadarEngagementConfig.create({
      data: {
        windowRecentDays: input.windowRecentDays,
        windowMidDays: input.windowMidDays,
        windowOldDays: input.windowOldDays,
        recentMultiplier: input.recentMultiplier,
        oldMultiplier: input.oldMultiplier,
        hotThreshold: input.hotThreshold,
        warmThreshold: input.warmThreshold,
        lukewarmThreshold: input.lukewarmThreshold,
        isActive: true,
      },
      select: configSelect,
    });
  }
}

export const backofficeRadarEngagementRepository =
  new BackofficeRadarEngagementRepository();

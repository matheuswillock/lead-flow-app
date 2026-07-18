import type {
  BackofficeBotHostApplyStatus,
  BackofficeBotHostOpsJobStatus,
  BackofficeBotHostOpsJobType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export class BackofficeBotHostRepository {
  async getOrCreateSettings() {
    const existing = await prisma.backofficeBotHostSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    return prisma.backofficeBotHostSettings.create({ data: {} });
  }

  async updateSettings(
    id: string,
    data: {
      agentBaseUrl?: string | null;
      agentTokenHash?: string | null;
      n8nEnvEncrypted?: string | null;
      evolutionEnvEncrypted?: string | null;
      desiredHostVersion?: string | null;
      appliedHostVersion?: string | null;
      lastAppliedAt?: Date | null;
      lastApplyStatus?: BackofficeBotHostApplyStatus;
      lastApplyError?: string | null;
    }
  ) {
    return prisma.backofficeBotHostSettings.update({ where: { id }, data });
  }

  async createJob(input: {
    type: BackofficeBotHostOpsJobType;
    requestedByProfileId: string;
    payload?: Prisma.InputJsonValue;
  }) {
    return prisma.backofficeBotHostOpsJob.create({
      data: {
        type: input.type,
        requestedByProfileId: input.requestedByProfileId,
        payload: input.payload,
        status: "queued",
      },
    });
  }

  async updateJob(
    id: string,
    data: {
      status?: BackofficeBotHostOpsJobStatus;
      result?: Prisma.InputJsonValue;
      errorMessage?: string | null;
      startedAt?: Date | null;
      finishedAt?: Date | null;
    }
  ) {
    return prisma.backofficeBotHostOpsJob.update({ where: { id }, data });
  }

  async listJobs(limit = 30) {
    return prisma.backofficeBotHostOpsJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        payload: true,
        result: true,
        errorMessage: true,
        requestedByProfileId: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateChannelSecrets(secrets: {
    webhookSecret?: string;
    n8nOutboundSecret?: string;
  }) {
    const channel = await prisma.backofficeBotChannel.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!channel) return null;
    return prisma.backofficeBotChannel.update({
      where: { id: channel.id },
      data: {
        ...(secrets.webhookSecret ? { webhookSecret: secrets.webhookSecret } : {}),
        ...(secrets.n8nOutboundSecret
          ? { n8nOutboundSecret: secrets.n8nOutboundSecret }
          : {}),
      },
    });
  }
}

export const backofficeBotHostRepository = new BackofficeBotHostRepository();

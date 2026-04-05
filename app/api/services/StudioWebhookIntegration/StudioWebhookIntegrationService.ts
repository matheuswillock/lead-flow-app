import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  CreateStudioWebhookRequestLogInput,
  CreateLeadFromStudioWebhookInput,
  IStudioWebhookIntegrationService,
  StudioWebhookConfigSnapshot,
  StudioWebhookLeadResult,
  StudioWebhookRequestLogSnapshot,
  StudioWebhookTeamSnapshot,
  UpsertStudioWebhookConfigInput,
} from "./IStudioWebhookIntegrationService";

const toPrismaJsonValue = (
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return {
      serializationError: "unserializable_payload",
    } as Prisma.InputJsonValue;
  }
};

export class StudioWebhookIntegrationService implements IStudioWebhookIntegrationService {
  async getTeamWithMaster(teamId: string): Promise<StudioWebhookTeamSnapshot | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        masterId: true,
        master: {
          select: {
            id: true,
            supabaseId: true,
          },
        },
      },
    });
  }

  async getWebhookConfigByTeamId(teamId: string): Promise<StudioWebhookConfigSnapshot | null> {
    return prisma.teamStudioWebhookConfig.findUnique({
      where: { teamId },
      select: {
        id: true,
        teamId: true,
        tokenHash: true,
        tokenCipher: true,
        tokenPreview: true,
        expiryMode: true,
        expiresAt: true,
        lastUsedAt: true,
        updatedByProfileId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertWebhookConfig(input: UpsertStudioWebhookConfigInput): Promise<StudioWebhookConfigSnapshot> {
    return prisma.teamStudioWebhookConfig.upsert({
      where: { teamId: input.teamId },
      create: {
        teamId: input.teamId,
        tokenHash: input.tokenHash,
        tokenCipher: input.tokenCipher,
        tokenPreview: input.tokenPreview,
        expiryMode: input.expiryMode,
        expiresAt: input.expiresAt,
        updatedByProfileId: input.updatedByProfileId,
      },
      update: {
        tokenHash: input.tokenHash,
        tokenCipher: input.tokenCipher,
        tokenPreview: input.tokenPreview,
        expiryMode: input.expiryMode,
        expiresAt: input.expiresAt,
        updatedByProfileId: input.updatedByProfileId,
      },
      select: {
        id: true,
        teamId: true,
        tokenHash: true,
        tokenCipher: true,
        tokenPreview: true,
        expiryMode: true,
        expiresAt: true,
        lastUsedAt: true,
        updatedByProfileId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async touchWebhookLastUsed(teamId: string): Promise<void> {
    await prisma.teamStudioWebhookConfig.updateMany({
      where: { teamId },
      data: { lastUsedAt: new Date() },
    });
  }

  private async generateLeadCode(name: string): Promise<string> {
    const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const firstLetter = (clean[0] || "L").toUpperCase();
    const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const digitsLength = 4 + Math.floor(Math.random() * 3);
      const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join("");
      const code = `${firstLetter}${digits}${lastLetter}`;
      const existing = await prisma.lead.findUnique({
        where: { leadCode: code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }

    const fallbackDigits = Date.now().toString().slice(-6);
    return `${firstLetter}${fallbackDigits}${lastLetter}`;
  }

  async createLeadFromWebhook(input: CreateLeadFromStudioWebhookInput): Promise<StudioWebhookLeadResult> {
    const leadCode = await this.generateLeadCode(input.name);

    const lead = await prisma.lead.create({
      data: {
        manager: { connect: { id: input.managerId } },
        team: { connect: { id: input.teamId } },
        creator: { connect: { id: input.managerId } },
        updater: { connect: { id: input.managerId } },
        leadCode,
        status: "new_opportunity",
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        cnpj: input.cnpj || null,
        age: input.age || null,
        currentHealthPlan: input.currentHealthPlan || null,
        currentValue: typeof input.currentValue === "number" ? input.currentValue : null,
        referenceHospital: input.referenceHospital || null,
        currentTreatment: input.currentTreatment || null,
        activities: {
          create: {
            type: ActivityType.note,
            body: "Lead criado via webhook genérico",
            payload: {
              kind: "lead_creation",
              channel: "webhook",
              provider: "studio",
              source: input.source,
              metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
              submittedAt: new Date().toISOString(),
            },
            author: { connect: { id: input.managerId } },
          },
        },
      },
      select: {
        id: true,
        leadCode: true,
      },
    });

    return {
      id: lead.id,
      leadCode: lead.leadCode,
    };
  }

  async createWebhookRequestLog(input: CreateStudioWebhookRequestLogInput): Promise<void> {
    const normalizedEndpoint = input.endpoint.trim();

    await prisma.$transaction(async (tx) => {
      await tx.teamStudioWebhookRequestLog.create({
        data: {
          teamId: input.teamId,
          method: input.method.trim().toUpperCase(),
          endpoint: normalizedEndpoint,
          statusCode: input.statusCode,
          resultType: input.resultType,
          requestPayload: toPrismaJsonValue(input.requestPayload),
          responsePayload: toPrismaJsonValue(input.responsePayload),
          errorMessage: input.errorMessage ?? null,
        },
      });

      const logsToDelete = await tx.teamStudioWebhookRequestLog.findMany({
        where: {
          teamId: input.teamId,
          endpoint: normalizedEndpoint,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 15,
        select: { id: true },
      });

      if (logsToDelete.length > 0) {
        await tx.teamStudioWebhookRequestLog.deleteMany({
          where: {
            id: {
              in: logsToDelete.map((log) => log.id),
            },
          },
        });
      }
    });
  }

  async listLatestWebhookRequestLogs(teamId: string, limit: number): Promise<StudioWebhookRequestLogSnapshot[]> {
    const safeLimit = Math.max(1, Math.min(limit, 15));

    return prisma.teamStudioWebhookRequestLog.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      select: {
        id: true,
        teamId: true,
        method: true,
        endpoint: true,
        statusCode: true,
        resultType: true,
        requestPayload: true,
        responsePayload: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  }
}

export const studioWebhookIntegrationService = new StudioWebhookIntegrationService();

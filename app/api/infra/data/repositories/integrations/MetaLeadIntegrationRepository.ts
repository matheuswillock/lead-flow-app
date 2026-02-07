import { prisma } from "../../prisma";
import type { MetaLeadIntegration, Prisma } from "@prisma/client";

export class MetaLeadIntegrationRepository {
  async create(data: Prisma.MetaLeadIntegrationCreateInput): Promise<MetaLeadIntegration> {
    return prisma.metaLeadIntegration.create({ data });
  }

  async update(id: string, data: Prisma.MetaLeadIntegrationUpdateInput): Promise<MetaLeadIntegration> {
    return prisma.metaLeadIntegration.update({ where: { id }, data });
  }

  async findById(id: string): Promise<MetaLeadIntegration | null> {
    return prisma.metaLeadIntegration.findUnique({ where: { id } });
  }

  async findByManagerId(managerId: string): Promise<MetaLeadIntegration[]> {
    return prisma.metaLeadIntegration.findMany({
      where: { managerId },
      orderBy: { createdAt: "desc" }
    });
  }

  async findActiveByManagerId(managerId: string): Promise<MetaLeadIntegration | null> {
    return prisma.metaLeadIntegration.findFirst({
      where: { managerId, isActive: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async findByPageId(pageId: string): Promise<MetaLeadIntegration | null> {
    return prisma.metaLeadIntegration.findFirst({
      where: { pageId }
    });
  }

  async findByVerifyToken(verifyToken: string): Promise<MetaLeadIntegration | null> {
    return prisma.metaLeadIntegration.findFirst({
      where: { verifyToken }
    });
  }
}

export const metaLeadIntegrationRepository = new MetaLeadIntegrationRepository();

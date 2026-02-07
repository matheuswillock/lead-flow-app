import { prisma } from "../../prisma";
import type { WhatsAppIntegration, Prisma } from "@prisma/client";

export class WhatsAppIntegrationRepository {
  async create(data: Prisma.WhatsAppIntegrationCreateInput): Promise<WhatsAppIntegration> {
    return prisma.whatsAppIntegration.create({ data });
  }

  async update(id: string, data: Prisma.WhatsAppIntegrationUpdateInput): Promise<WhatsAppIntegration> {
    return prisma.whatsAppIntegration.update({ where: { id }, data });
  }

  async findById(id: string): Promise<WhatsAppIntegration | null> {
    return prisma.whatsAppIntegration.findUnique({ where: { id } });
  }

  async findByManagerId(managerId: string): Promise<WhatsAppIntegration[]> {
    return prisma.whatsAppIntegration.findMany({
      where: { managerId },
      orderBy: { createdAt: "desc" }
    });
  }

  async findActiveByManagerId(managerId: string): Promise<WhatsAppIntegration | null> {
    return prisma.whatsAppIntegration.findFirst({
      where: { managerId, isActive: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppIntegration | null> {
    return prisma.whatsAppIntegration.findFirst({
      where: { phoneNumberId }
    });
  }

  async findByVerifyToken(verifyToken: string): Promise<WhatsAppIntegration | null> {
    return prisma.whatsAppIntegration.findFirst({
      where: { verifyToken }
    });
  }
}

export const whatsAppIntegrationRepository = new WhatsAppIntegrationRepository();

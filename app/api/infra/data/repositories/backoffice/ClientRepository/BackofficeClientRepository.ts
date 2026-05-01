import type { BackofficeClient } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeClientRepository,
  CreateBackofficeClientInput,
} from "./IBackofficeClientRepository"

export class BackofficeClientRepository implements IBackofficeClientRepository {
  async create(data: CreateBackofficeClientInput): Promise<BackofficeClient> {
    return prisma.backofficeClient.create({
      data: {
        id: data.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj,
        notes: data.notes,
        createdByProfileId: data.createdByProfileId,
      },
    })
  }

  async findMany(params?: { isActive?: boolean }): Promise<BackofficeClient[]> {
    return prisma.backofficeClient.findMany({
      where: params?.isActive !== undefined ? { isActive: params.isActive } : undefined,
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficeClient | null> {
    return prisma.backofficeClient.findUnique({ where: { id } })
  }

  async updateAsaasCustomerId(id: string, asaasCustomerId: string): Promise<BackofficeClient> {
    return prisma.backofficeClient.update({
      where: { id },
      data: { asaasCustomerId },
    })
  }
}

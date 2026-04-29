import type { BackofficeLead, BackofficeLeadStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeLeadInput,
  IBackofficeLeadRepository,
  ListBackofficeLeadsParams,
  UpdateBackofficeLeadInput,
} from "./IBackofficeLeadRepository"

export class BackofficeLeadRepository implements IBackofficeLeadRepository {
  async create(data: CreateBackofficeLeadInput): Promise<BackofficeLead> {
    return prisma.backofficeLead.create({
      data: {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
        status: data.status,
        createdByProfileId: data.createdByProfileId ?? null,
      },
    })
  }

  async findMany(params?: ListBackofficeLeadsParams): Promise<BackofficeLead[]> {
    return prisma.backofficeLead.findMany({
      where: params?.status ? { status: params.status } : undefined,
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficeLead | null> {
    return prisma.backofficeLead.findUnique({ where: { id } })
  }

  async update(id: string, data: UpdateBackofficeLeadInput): Promise<BackofficeLead> {
    return prisma.backofficeLead.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
      },
    })
  }

  async updateStatus(id: string, status: BackofficeLeadStatus): Promise<BackofficeLead> {
    return prisma.backofficeLead.update({
      where: { id },
      data: {
        status,
        statusEnteredAt: new Date(),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeLead.delete({ where: { id } })
  }
}

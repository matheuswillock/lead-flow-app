import type { BackofficeEmailContactList } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeEmailContactListInput,
  IBackofficeEmailContactListRepository,
} from "./IBackofficeEmailContactListRepository"

export class BackofficeEmailContactListRepository implements IBackofficeEmailContactListRepository {
  async create(data: CreateBackofficeEmailContactListInput): Promise<BackofficeEmailContactList> {
    return prisma.backofficeEmailContactList.create({
      data: {
        name: data.name,
        isSystemDefault: data.isSystemDefault ?? false,
        createdByBackofficeUserId: data.createdByBackofficeUserId ?? null,
      },
    })
  }

  async findMany(): Promise<BackofficeEmailContactList[]> {
    return prisma.backofficeEmailContactList.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficeEmailContactList | null> {
    return prisma.backofficeEmailContactList.findUnique({ where: { id } })
  }

  async findSystemDefault(): Promise<BackofficeEmailContactList | null> {
    return prisma.backofficeEmailContactList.findFirst({
      where: { isSystemDefault: true },
    })
  }

  async getOrCreateSystemDefault(): Promise<BackofficeEmailContactList> {
    const existing = await this.findSystemDefault()
    if (existing) return existing
    return this.create({
      name: "Inscritos via Cadastro Rápido",
      isSystemDefault: true,
    })
  }

  async archive(id: string): Promise<BackofficeEmailContactList> {
    return prisma.backofficeEmailContactList.update({
      where: { id },
      data: { isArchived: true },
    })
  }

  async incrementTotalContacts(id: string, delta: number): Promise<void> {
    await prisma.backofficeEmailContactList.update({
      where: { id },
      data: { totalContacts: { increment: delta } },
    })
  }
}

export const backofficeEmailContactListRepository = new BackofficeEmailContactListRepository()
